import fs from 'node:fs'
import { spawn } from 'node:child_process'
import { atomicWrite, readProjectConfig } from '../config.js'
import { windowsPaths } from '../windows-store.js'

const SESSION_SCHEMA_VERSION = 1

export function writeUiSession(session, machine = {}) {
  const file = windowsPaths(machine).uiSession
  const value = {
    schemaVersion: SESSION_SCHEMA_VERSION,
    pid: process.pid,
    port: session.port,
    token: session.token,
    url: session.url,
    startedAt: new Date().toISOString()
  }
  atomicWrite(file, `${JSON.stringify(value, null, 2)}\n`)
  return value
}

export function clearUiSession(token, machine = {}) {
  const file = windowsPaths(machine).uiSession
  const current = readUiSession(machine)
  if (current?.token === token) fs.rmSync(file, { force: true })
}

export function readUiSession(machine = {}) {
  const file = windowsPaths(machine).uiSession
  if (!fs.existsSync(file)) return null
  try {
    const value = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (
      value?.schemaVersion !== SESSION_SCHEMA_VERSION ||
      !Number.isInteger(value.pid) ||
      value.pid <= 0 ||
      !Number.isInteger(value.port) ||
      value.port < 1 ||
      value.port > 65535 ||
      typeof value.token !== 'string' ||
      value.token.length < 20 ||
      typeof value.url !== 'string' ||
      !isLocalSessionUrl(value.url, value.port)
    ) return null
    return value
  } catch {
    return null
  }
}

function isLocalSessionUrl(value, port) {
  try {
    const url = new URL(value)
    return (
      url.protocol === 'http:' &&
      url.hostname === '127.0.0.1' &&
      Number(url.port) === port &&
      url.pathname === '/' &&
      !url.username &&
      !url.password
    )
  } catch {
    return false
  }
}

export async function reuseUiSession(options = {}) {
  const session = readUiSession(options.machine)
  if (!session) return null
  try {
    const headers = {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-ai-toolops-token': session.token
    }
    const status = await request(`${session.url}api/session`, { headers }, options.fetchImpl)
    if (!status.ok || status.pid !== session.pid) throw new Error('stale session')

    if (options.switchProject) {
      const project = readProjectConfig(options.projectRoot, { allowMissing: true })
      if (!project.initialized || project.errors.length) {
        throw new Error(`无法切换到项目：${project.errors.join('；') || '项目尚未初始化'}`)
      }
      await request(`${session.url}api/project/select`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ project: project.projectRoot })
      }, options.fetchImpl)
    }

    if (options.open !== false) openBrowser(session.url)
    return { reused: true, url: session.url, pid: session.pid }
  } catch (error) {
    if (options.switchProject && error.message.startsWith('无法切换到项目：')) throw error
    clearUiSession(session.token, options.machine)
    return null
  }
}

export function openBrowser(url) {
  const child = spawn('explorer.exe', [url], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true
  })
  child.unref()
}

async function request(url, init, fetchImpl = fetch) {
  const response = await fetchImpl(url, {
    ...init,
    signal: AbortSignal.timeout(2500)
  })
  const value = await response.json()
  if (!response.ok) throw new Error(value.error || `HTTP ${response.status}`)
  return value
}
