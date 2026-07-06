import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'

export function cwdPath(...parts) {
  return path.join(process.cwd(), ...parts)
}

export function exists(filePath) {
  return fs.existsSync(filePath)
}

export function readJson(filePath, fallback = null) {
  if (!exists(filePath)) return fallback
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch (error) {
    return fallback
  }
}

export function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath))
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

export function writeText(filePath, content) {
  ensureDir(path.dirname(filePath))
  fs.writeFileSync(filePath, content, 'utf8')
}

export function readText(filePath, fallback = '') {
  if (!exists(filePath)) return fallback
  return fs.readFileSync(filePath, 'utf8')
}

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

export function listFiles(dir, options = {}) {
  const { maxDepth = 3, ignore = defaultIgnoreNames, maxEntries = 5000 } = options
  const results = []
  function walk(current, depth) {
    if (!exists(current) || depth > maxDepth || results.length >= maxEntries) return
    let entries = []
    try {
      entries = fs.readdirSync(current, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (results.length >= maxEntries) return
      if (ignore.has(entry.name)) continue
      const full = path.join(current, entry.name)
      if (entry.isSymbolicLink()) continue
      results.push(full)
      if (entry.isDirectory()) walk(full, depth + 1)
    }
  }
  walk(dir, 0)
  return results
}

export const defaultIgnoreNames = new Set([
  '.git', 'node_modules', 'dist', 'build', 'coverage', 'unpackage', '.next', '.nuxt', '.vite', '.cache',
  '.idea', '.vscode', 'tmp', 'temp', 'logs', '.turbo', '.parcel-cache'
])

export function toRelative(filePath) {
  return path.relative(process.cwd(), filePath).replaceAll(path.sep, '/') || '.'
}

export function timestamp() {
  return new Date().toISOString()
}

export function safeTimestamp() {
  return timestamp().replace(/[:.]/g, '-')
}

export function parseArgs(args) {
  const flags = new Map()
  const positionals = []
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (arg.startsWith('--')) {
      const [rawKey, rawValue] = arg.slice(2).split('=')
      if (rawValue !== undefined) flags.set(rawKey, rawValue)
      else if (args[i + 1] && !args[i + 1].startsWith('-')) flags.set(rawKey, args[++i])
      else flags.set(rawKey, true)
    } else if (arg.startsWith('-') && arg.length > 1) {
      for (const key of arg.slice(1)) flags.set(key, true)
    } else {
      positionals.push(arg)
    }
  }
  return { flags, positionals }
}

export function serveStatic(root, port = 4177) {
  const resolvedRoot = path.resolve(root)
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost')
    const urlPath = decodeURIComponent(url.pathname)

    if (req.method === 'POST' && urlPath === '/api/toggle') {
      readRequestJson(req).then((body) => {
        const slot = String(body.slot || '')
        const enabled = Boolean(body.enabled)
        const equipmentPath = cwdPath('.ai-toolops', 'equipment.json')
        const equipment = readJson(equipmentPath)
        if (!equipment?.slots?.[slot]) {
          res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' })
          res.end(JSON.stringify({ ok: false, error: '未知槽位' }))
          return
        }
        equipment.slots[slot].enabled = enabled
        equipment.slots[slot].updatedAt = timestamp()
        writeJson(equipmentPath, equipment)
        updateUiDataEquipment(equipment)
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ ok: true, slot, enabled }))
      }).catch((error) => {
        res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ ok: false, error: error.message }))
      })
      return
    }

    if (req.method === 'POST' && urlPath === '/api/reorder-tools') {
      readRequestJson(req).then((body) => {
        const slot = String(body.slot || '')
        const orderedTools = Array.isArray(body.tools) ? body.tools.map((item) => String(item || '').trim()).filter(Boolean) : []
        const equipmentPath = cwdPath('.ai-toolops', 'equipment.json')
        const equipment = readJson(equipmentPath)
        if (!equipment?.slots?.[slot]) {
          res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' })
          res.end(JSON.stringify({ ok: false, error: '未知槽位' }))
          return
        }
        const slotConfig = equipment.slots[slot]
        const existing = localUnique([...(Array.isArray(slotConfig.tools) ? slotConfig.tools : []), slotConfig.active])
        const unknown = orderedTools.filter((tool) => !existing.includes(tool))
        if (unknown.length) {
          res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
          res.end(JSON.stringify({ ok: false, error: `槽位不包含这些工具：${unknown.join(', ')}` }))
          return
        }
        const ordered = localUnique(orderedTools)
        const rest = existing.filter((tool) => !ordered.includes(tool))
        const next = [...ordered, ...rest]
        slotConfig.tools = next
        slotConfig.active = (slotConfig.slotType || 'exclusive_priority') === 'exclusive_priority' ? (next[0] || null) : null
        slotConfig.updatedAt = timestamp()
        writeJson(equipmentPath, equipment)
        updateUiDataEquipment(equipment)
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ ok: true, slot, tools: next, active: slotConfig.active }))
      }).catch((error) => {
        res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ ok: false, error: error.message }))
      })
      return
    }


    const candidate = path.resolve(path.join(resolvedRoot, urlPath === '/' ? 'index.html' : urlPath))
    const relative = path.relative(resolvedRoot, candidate)
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      res.writeHead(403)
      res.end('Forbidden')
      return
    }
    if (!exists(candidate) || fs.statSync(candidate).isDirectory()) {
      res.writeHead(404)
      res.end('Not found')
      return
    }
    const ext = path.extname(candidate)
    const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8' }
    res.writeHead(200, { 'content-type': types[ext] || 'text/plain; charset=utf-8' })
    res.end(fs.readFileSync(candidate))
  })
  server.listen(port, '127.0.0.1', () => {
    console.log(`AI ToolOps UI: http://127.0.0.1:${port}`)
  })
}



function updateUiDataEquipment(equipment) {
  const dataPath = cwdPath('.ai-toolops', 'ui', 'data.json')
  const data = readJson(dataPath)
  if (!data) return
  data.equipment = equipment
  writeJson(dataPath, data)
}

function localUnique(values) {
  const result = []
  for (const value of values || []) {
    const text = String(value || '').trim()
    if (!text || result.includes(text)) continue
    result.push(text)
  }
  return result
}

function readRequestJson(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => {
      data += chunk
      if (data.length > 10000) {
        reject(new Error('请求体过大'))
        req.destroy()
      }
    })
    req.on('end', () => {
      if (!data) return resolve({})
      try {
        resolve(JSON.parse(data))
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}
