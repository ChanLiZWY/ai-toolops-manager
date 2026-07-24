import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const AGENTS = new Set(['generic', 'codex', 'claude', 'roo'])

export function resolveAgent(requested = 'auto', env = process.env) {
  const normalized = String(requested || 'auto').toLowerCase()
  if (normalized !== 'auto') {
    if (!AGENTS.has(normalized)) throw new Error(`不支持的 Agent：${requested}`)
    return { requested: normalized, resolved: normalized, confidence: 'explicit', evidence: ['--agent'] }
  }
  const explicit = String(env.AI_TOOLOPS_AGENT || '').toLowerCase()
  if (AGENTS.has(explicit)) return { requested: 'auto', resolved: explicit, confidence: 'trusted', evidence: ['AI_TOOLOPS_AGENT'] }
  if (env.CODEX_THREAD_ID || env.CODEX_TASK_ID) return { requested: 'auto', resolved: 'codex', confidence: 'trusted', evidence: ['CODEX_THREAD_ID'] }
  if (env.CLAUDECODE || env.CLAUDE_CODE_ENTRYPOINT) return { requested: 'auto', resolved: 'claude', confidence: 'trusted', evidence: ['CLAUDECODE'] }
  if (env.ROO_CODE || env.ROO_AGENT_ID) return { requested: 'auto', resolved: 'roo', confidence: 'trusted', evidence: ['ROO_CODE'] }
  return { requested: 'auto', resolved: 'generic', confidence: 'unknown', evidence: [] }
}

export function discoverAgentBindings(agentId, options = {}) {
  const projectRoot = path.resolve(options.projectRoot || process.cwd())
  const home = path.resolve(options.homeDir || os.homedir())
  const appData = options.appData || process.env.APPDATA || path.join(home, 'AppData', 'Roaming')
  const candidates = bindingCandidates(agentId, { projectRoot, home, appData, ...options })
  const servers = {}
  const sources = []
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate.path)) continue
    sources.push(candidate.path)
    try {
      const content = fs.readFileSync(candidate.path, 'utf8')
      const names = candidate.format === 'toml' ? namesFromToml(content) : namesFromJson(JSON.parse(content))
      for (const name of names) {
        const normalized = normalizeName(name)
        if (!normalized) continue
        servers[normalized] ||= { name, normalized, sources: [] }
        servers[normalized].sources.push(candidate.path)
      }
    } catch {
      // A malformed host config is reported through sources without leaking its content.
    }
  }
  return { agentId, sources, servers }
}

function bindingCandidates(agentId, options) {
  const { projectRoot, home, appData } = options
  if (agentId === 'codex') {
    const codexHome = path.resolve(options.codexHome || process.env.CODEX_HOME || path.join(home, '.codex'))
    return [
      { path: path.join(projectRoot, '.codex', 'config.toml'), format: 'toml' },
      { path: path.join(codexHome, 'config.toml'), format: 'toml' }
    ]
  }
  if (agentId === 'claude') {
    const claudeHome = path.resolve(options.claudeHome || process.env.CLAUDE_HOME || path.join(home, '.claude'))
    return [
      { path: path.join(projectRoot, '.mcp.json'), format: 'json' },
      { path: path.join(projectRoot, '.claude', 'mcp.json'), format: 'json' },
      { path: path.join(home, '.claude.json'), format: 'json' },
      { path: path.join(claudeHome, 'settings.json'), format: 'json' },
      { path: path.join(appData, 'Claude', 'claude_desktop_config.json'), format: 'json' }
    ]
  }
  if (agentId === 'roo') {
    return [
      { path: path.join(projectRoot, '.roo', 'mcp.json'), format: 'json' },
      { path: path.join(appData, 'Code', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline', 'settings', 'mcp_settings.json'), format: 'json' }
    ]
  }
  return []
}

function namesFromToml(content) {
  const names = []
  const pattern = /^\s*\[mcp_servers\.(?:"([^"]+)"|'([^']+)'|([^\]\s]+))\]\s*$/gm
  let match
  while ((match = pattern.exec(content))) names.push(match[1] || match[2] || match[3])
  return names
}

function namesFromJson(value) {
  const names = []
  const seen = new Set()
  function walk(node, depth = 0) {
    if (!node || typeof node !== 'object' || depth > 10 || seen.has(node)) return
    seen.add(node)
    for (const [key, child] of Object.entries(node)) {
      if (['mcpServers', 'mcp_servers', 'servers'].includes(key) && child && typeof child === 'object' && !Array.isArray(child)) {
        names.push(...Object.keys(child))
      }
      walk(child, depth + 1)
    }
  }
  walk(value)
  return names
}

export function normalizeName(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
}
