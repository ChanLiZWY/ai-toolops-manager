import crypto from 'node:crypto'
import http from 'node:http'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { resolveContext } from '../resolver.js'
import { runDoctorV1 } from '../doctor.js'
import { readProjectConfig } from '../config.js'
import { readInventory } from '../windows-store.js'
import { readReceipts } from '../transaction.js'
import { applyLifecycle, planLifecycle } from '../lifecycle.js'
import { agentStatus, applyAgentBinding, bindingInstruction, planAgentBinding } from '../agent-adapters.js'
import { projectListView, rememberUiProject, validateUiProject } from './projects.js'
import { clearUiSession, openBrowser, reuseUiSession, writeUiSession } from './session.js'
import { applyReleaseUpdate, checkLatestRelease, planReleaseUpdate } from '../release-update.js'
import { UI_HTML } from './html.js'
import { UI_CSS } from './styles.js'
import { UI_APP_JS } from './app.js'
import { VERSION } from '../../version.js'

export async function openUi(options = {}) {
  if (options.singleInstance !== false) {
    const reused = await reuseUiSession(options)
    if (reused) {
      options.onListening?.({ url: reused.url, reused: true })
      return reused
    }
  }
  const started = startUiServer(options)
  try {
    await waitForListening(started.server)
    return started
  } catch (error) {
    if (options.singleInstance === false || error.code !== 'EADDRINUSE') throw error
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await delay(100)
      const reused = await reuseUiSession(options)
      if (reused) {
        options.onListening?.({ url: reused.url, reused: true })
        return reused
      }
    }
    throw new Error(`UI 端口已被占用，且无法确认现有 AI ToolOps 会话：${options.port ?? 4177}`)
  }
}

export function startUiServer(options = {}) {
  let projectRoot = path.resolve(options.projectRoot || process.cwd())
  const machine = options.machine
  const agent = options.agent || 'auto'
  const pickDirectory = options.pickDirectory || pickProjectDirectory
  const token = crypto.randomBytes(24).toString('base64url')
  const plans = new Map()
  if (readProjectConfig(projectRoot, { allowMissing: true }).initialized) {
    try {
      rememberUiProject(projectRoot, machine)
    } catch {
      // An invalid initial project is still shown so the UI can explain how to recover.
    }
  }
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://127.0.0.1')
      if (!validHost(req.headers.host)) return sendJson(res, 403, { error: 'Host 不允许' })
      setSecurityHeaders(res)
      if (req.method === 'GET' && url.pathname === '/') return sendText(res, 200, UI_HTML.replace('__TOKEN__', token), 'text/html; charset=utf-8')
      if (req.method === 'GET' && url.pathname === '/styles.css') return sendText(res, 200, UI_CSS, 'text/css; charset=utf-8')
      if (req.method === 'GET' && url.pathname === '/app.js') return sendText(res, 200, UI_APP_JS, 'text/javascript; charset=utf-8')
      if (url.pathname.startsWith('/api/') && req.headers['x-ai-toolops-token'] !== token) return sendJson(res, 403, { error: '会话令牌无效，请从 ai-toolops ui 重新打开页面' })
      if (req.method === 'GET' && url.pathname === '/api/state') return sendJson(res, 200, buildState({ projectRoot, machine, agent }))
      if (req.method === 'GET' && url.pathname === '/api/session') {
        return sendJson(res, 200, { ok: true, pid: process.pid, projectRoot })
      }
      if (req.method === 'POST' && url.pathname === '/api/project/select') {
        const body = await readJsonBody(req)
        projectRoot = validateUiProject(body.project)
        rememberUiProject(projectRoot, machine)
        plans.clear()
        return sendJson(res, 200, { state: buildState({ projectRoot, machine, agent }) })
      }
      if (req.method === 'POST' && url.pathname === '/api/project/browse') {
        const selected = await pickDirectory()
        return sendJson(res, 200, { selected })
      }
      if (req.method === 'POST' && url.pathname === '/api/update/check') {
        const release = await checkLatestRelease({ fetchImpl: options.fetchImpl })
        if (release.status !== 'update-available') return sendJson(res, 200, { release })
        const plan = planReleaseUpdate(release, { machine, target: options.executable })
        plans.set(plan.id, { plan, expiresAt: Date.now() + 10 * 60 * 1000 })
        purgePlans(plans)
        return sendJson(res, 200, { release, plan })
      }
      if (req.method === 'POST' && url.pathname === '/api/plan') {
        const body = await readJsonBody(req)
        const plan = buildPlan(body, { projectRoot, machine })
        plans.set(plan.id, { plan, expiresAt: Date.now() + 10 * 60 * 1000 })
        purgePlans(plans)
        return sendJson(res, 200, { plan })
      }
      if (req.method === 'POST' && url.pathname === '/api/apply') {
        const body = await readJsonBody(req)
        const cached = plans.get(String(body.planId || ''))
        if (!cached || cached.expiresAt < Date.now()) return sendJson(res, 404, { error: '操作计划不存在或已过期，请重新预览' })
        plans.delete(cached.plan.id)
        let result
        if (cached.plan.providerId === 'core.release-update') {
          result = await applyReleaseUpdate(cached.plan, {
            machine,
            confirmed: true,
            launchHelper: options.launchUpdateHelper !== false,
            fetchImpl: options.fetchImpl
          })
          if (options.launchUpdateHelper !== false) {
            res.once('finish', () => {
              options.onUpdateScheduled?.(result)
              setTimeout(() => server.close(), 100)
            })
          }
        } else {
          result = cached.plan.providerId.startsWith('agent.')
            ? await applyAgentBinding(cached.plan, { machine, confirmed: true })
            : await applyLifecycle(cached.plan, { machine, confirmed: true })
        }
        return sendJson(res, 200, { ok: true, result })
      }
      return sendJson(res, 404, { error: 'Not found' })
    } catch (error) {
      return sendJson(res, 400, { error: error.message, receipt: error.receiptFile || null })
    }
  })
  server.listen(Number(options.port ?? 4177), '127.0.0.1')
  server.on('listening', () => {
    const address = server.address()
    const url = `http://127.0.0.1:${address.port}/`
    if (options.singleInstance !== false) writeUiSession({ port: address.port, token, url }, machine)
    options.onListening?.({ url, token })
    if (options.open !== false) openBrowser(url)
  })
  server.on('close', () => clearUiSession(token, machine))
  return { server, token }
}

export function buildState(options = {}) {
  const context = resolveContext(options)
  const doctor = runDoctorV1(options)
  const machine = readInventory(options.machine || {})
  return {
    schemaVersion: 1,
    app: { version: VERSION },
    context,
    doctor: { healthy: doctor.healthy, checks: doctor.checks },
    inventory: machine.inventory,
    agents: ['codex', 'claude', 'roo'].map((id) => agentStatus(id, options)),
    receipts: readReceipts({ machine: options.machine }).slice(0, 50),
    instruction: bindingInstruction(),
    ui: projectListView(context.project.root, options.machine)
  }
}

export function pickProjectDirectory() {
  const script = [
    'Add-Type -AssemblyName System.Windows.Forms',
    '$dialog = New-Object System.Windows.Forms.FolderBrowserDialog',
    "$dialog.Description = '选择已初始化的 AI ToolOps 项目目录'",
    '$dialog.ShowNewFolderButton = $false',
    'if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {',
    '  [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($dialog.SelectedPath))',
    '}'
  ].join('\n')
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-Command', script], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`无法打开项目选择窗口：${stderr.trim() || `PowerShell ${code}`}`))
      const encoded = stdout.trim()
      if (!encoded) return resolve(null)
      try {
        resolve(Buffer.from(encoded, 'base64').toString('utf8'))
      } catch {
        reject(new Error('项目选择窗口返回了无效路径'))
      }
    })
  })
}

function buildPlan(body, options) {
  const action = String(body.action || '')
  if (['agent-bind', 'agent-unbind'].includes(action)) return planAgentBinding(action === 'agent-bind' ? 'bind' : 'unbind', body.agent, options)
  if (action === 'external-register') {
    return planLifecycle('register', String(body.tool || ''), {
      ...options,
      providerId: 'external-command',
      externalPath: String(body.path || '')
    })
  }
  if (!['install', 'update', 'repair', 'uninstall'].includes(action)) throw new Error(`UI 不支持的操作：${action}`)
  const tool = String(body.tool || '')
  const inventory = readInventory(options.machine || {}).inventory
  return planLifecycle(action, tool, {
    ...options,
    providerId: inventory.tools?.[tool]?.providerId
  })
}

function validHost(host = '') {
  const value = String(host).toLowerCase()
  return value.startsWith('127.0.0.1:') || value === '127.0.0.1' || value.startsWith('localhost:')
}

function setSecurityHeaders(res) {
  res.setHeader('cache-control', 'no-store')
  res.setHeader('x-content-type-options', 'nosniff')
  res.setHeader('x-frame-options', 'DENY')
  res.setHeader('referrer-policy', 'no-referrer')
  res.setHeader('content-security-policy', "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'")
}

function sendJson(res, status, value) {
  sendText(res, status, `${JSON.stringify(value)}\n`, 'application/json; charset=utf-8')
}

function sendText(res, status, value, contentType) {
  res.writeHead(status, { 'content-type': contentType })
  res.end(value)
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let content = ''
    req.on('data', (chunk) => {
      content += chunk
      if (content.length > 65536) {
        reject(new Error('请求体超过 64 KiB'))
        req.destroy()
      }
    })
    req.on('end', () => {
      try {
        resolve(content ? JSON.parse(content) : {})
      } catch {
        reject(new Error('请求 JSON 无效'))
      }
    })
    req.on('error', reject)
  })
}

function purgePlans(plans) {
  for (const [id, item] of plans) if (item.expiresAt < Date.now()) plans.delete(id)
}

function waitForListening(server) {
  if (server.listening) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const listening = () => {
      server.off('error', failed)
      resolve()
    }
    const failed = (error) => {
      server.off('listening', listening)
      reject(error)
    }
    server.once('listening', listening)
    server.once('error', failed)
  })
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}
