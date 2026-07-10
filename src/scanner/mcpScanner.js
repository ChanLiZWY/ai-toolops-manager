import { existsSync, readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

function addCandidate(result, file, format) {
  const resolved = path.resolve(file)
  if (!result.some((item) => item.path.toLowerCase() === resolved.toLowerCase())) result.push({ path: resolved, format })
}

function configCandidates(options = {}) {
  const projectRoot = path.resolve(options.projectRoot || process.cwd())
  const home = path.resolve(options.homeDir || os.homedir())
  const appData = options.appData || process.env.APPDATA || path.join(home, 'AppData', 'Roaming')
  const codexHome = path.resolve(options.codexHome || process.env.CODEX_HOME || path.join(home, '.codex'))
  const claudeHome = path.resolve(options.claudeHome || process.env.CLAUDE_HOME || path.join(home, '.claude'))
  const items = []

  for (const [file, format] of [
    [path.join(projectRoot, '.codex', 'config.toml'), 'toml'],
    [path.join(projectRoot, '.mcp.json'), 'json'],
    [path.join(projectRoot, '.vscode', 'mcp.json'), 'json'],
    [path.join(projectRoot, '.roo', 'mcp.json'), 'json'],
    [path.join(projectRoot, '.claude', 'mcp.json'), 'json'],
    [path.join(codexHome, 'config.toml'), 'toml'],
    [path.join(home, '.claude.json'), 'json'],
    [path.join(claudeHome, 'settings.json'), 'json'],
    [path.join(appData, 'Claude', 'claude_desktop_config.json'), 'json'],
    [path.join(appData, 'Code', 'User', 'mcp.json'), 'json'],
    [path.join(appData, 'Cursor', 'User', 'mcp.json'), 'json'],
    [path.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'), 'json'],
    [path.join(home, '.config', 'Code', 'User', 'mcp.json'), 'json']
  ]) addCandidate(items, file, format)

  return items.filter((item) => existsSync(item.path))
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
    if (!node || typeof node !== 'object' || depth > 12 || seen.has(node)) return
    seen.add(node)
    for (const [key, child] of Object.entries(node)) {
      const isServerMap = ['mcpServers', 'mcp_servers'].includes(key) || (depth === 0 && key === 'servers')
      if (isServerMap && child && typeof child === 'object' && !Array.isArray(child)) {
        names.push(...Object.keys(child))
      }
      walk(child, depth + 1)
    }
  }
  walk(value)
  return names
}

export function normalizeMcpName(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

/** 只读取服务名与配置来源，不返回 command、args、env 或密钥。 */
export function scanMcpServers(options = {}) {
  const servers = {}
  for (const candidate of configCandidates(options)) {
    try {
      const content = readFileSync(candidate.path, 'utf8')
      const names = candidate.format === 'toml' ? namesFromToml(content) : namesFromJson(JSON.parse(content))
      for (const name of names) {
        const normalized = normalizeMcpName(name)
        if (!normalized) continue
        servers[normalized] ||= { name, normalized, sources: [] }
        if (!servers[normalized].sources.includes(candidate.path)) servers[normalized].sources.push(candidate.path)
      }
    } catch {
      // 单个 Agent 配置损坏或无权限时跳过，Doctor 继续检查其他来源。
    }
  }
  return { scannedAt: new Date().toISOString(), servers }
}

export function findConfiguredMcp(mcpScan, aliases = []) {
  const servers = mcpScan?.servers || {}
  for (const alias of aliases) {
    const normalized = normalizeMcpName(alias)
    if (servers[normalized]) return servers[normalized]
  }
  return null
}
