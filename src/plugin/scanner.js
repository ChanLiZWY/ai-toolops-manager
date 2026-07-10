import { existsSync, readFileSync, readdirSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { timestamp, writeJson, readJson } from '../utils.js'
import { findConfiguredMcp, scanMcpServers } from '../scanner/mcpScanner.js'
import { classifySkill } from '../core/skillTaxonomy.js'

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const SKILL_DIR_NAMES = ['.codex', '.claude', '.roo', '.agents']
const IGNORE_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage'])

function projectPath(projectRoot, ...parts) {
  return path.join(path.resolve(projectRoot || process.cwd()), ...parts)
}

function registryPath(projectRoot) {
  return projectPath(projectRoot, '.ai-toolops', 'plugin-registry.json')
}

function skillStatePath(projectRoot) {
  return projectPath(projectRoot, '.ai-toolops', 'skills.json')
}

function uniquePaths(items) {
  const seen = new Set()
  return items.filter((item) => {
    const key = path.resolve(item.path).toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function readManifest(manifestPath) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  if (!manifest?.name) throw new Error('manifest 缺少 name')
  return manifest
}

function manifestDirectories(kind, options = {}) {
  const projectRoot = path.resolve(options.projectRoot || process.cwd())
  const result = []
  if (options.includePackage !== false) result.push(path.join(PACKAGE_ROOT, 'plugins', kind))
  const projectPlugins = path.join(projectRoot, 'plugins', kind)
  if (path.resolve(projectPlugins).toLowerCase() !== path.resolve(result[0] || '').toLowerCase()) result.push(projectPlugins)
  return [...new Set(result.map((item) => path.resolve(item)))]
}

function scanManifestPlugins(kind, normalize, options = {}) {
  const plugins = {}
  for (const dir of manifestDirectories(kind, options)) {
    if (!existsSync(dir)) continue
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) continue
      const manifestPath = path.join(dir, entry.name, 'manifest.json')
      if (!existsSync(manifestPath)) continue
      try {
        const manifest = readManifest(manifestPath)
        plugins[manifest.name] = normalize(manifest, {
          directoryName: entry.name,
          manifestPath,
          scope: dir.startsWith(PACKAGE_ROOT) ? 'bundled' : 'project'
        })
      } catch (error) {
        console.error(`[plugin:scanner] 读取 ${manifestPath} 失败: ${error.message}`)
      }
    }
  }
  return plugins
}

/** 扫描工具包与项目 plugins/tools 下的 manifest.json。 */
export function scanToolPlugins(options = {}) {
  return scanManifestPlugins('tools', normalizeToolManifest, options)
}

function skillRoots(options = {}) {
  const projectRoot = path.resolve(options.projectRoot || process.cwd())
  const roots = SKILL_DIR_NAMES.map((name) => ({
    path: path.join(projectRoot, name, 'skills'),
    scope: 'project',
    agent: name.slice(1)
  }))

  if (options.includeGlobal !== false) {
    const home = os.homedir()
    const codexHome = path.resolve(process.env.CODEX_HOME || path.join(home, '.codex'))
    const claudeHome = path.resolve(process.env.CLAUDE_HOME || path.join(home, '.claude'))
    const rooHome = path.resolve(process.env.ROO_HOME || path.join(home, '.roo'))
    roots.push(
      { path: path.join(codexHome, 'skills'), scope: 'user', agent: 'codex' },
      { path: path.join(claudeHome, 'skills'), scope: 'user', agent: 'claude' },
      { path: path.join(rooHome, 'skills'), scope: 'user', agent: 'roo' },
      { path: path.join(home, '.agents', 'skills'), scope: 'user', agent: 'agents' },
      { path: path.join(codexHome, 'plugins', 'cache'), scope: 'plugin_cache', agent: 'codex', maxDepth: 7 }
    )
  }

  return uniquePaths(roots)
}

function findSkillFiles(root, maxDepth = 3) {
  const files = []
  function walk(current, depth) {
    if (depth > maxDepth || files.length >= 2000 || !existsSync(current)) return
    let entries
    try {
      entries = readdirSync(current, { withFileTypes: true })
    } catch {
      return
    }
    const skillFile = entries.find((entry) => entry.isFile() && entry.name.toLowerCase() === 'skill.md')
    if (skillFile) {
      files.push(path.join(current, skillFile.name))
      return
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.isSymbolicLink() || IGNORE_DIRS.has(entry.name)) continue
      walk(path.join(current, entry.name), depth + 1)
    }
  }
  walk(root, 0)
  return files
}

function parseFrontMatter(content) {
  const match = String(content || '').match(/^---\s*\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return {}
  const result = {}
  for (const line of match[1].split(/\r?\n/)) {
    const item = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/)
    if (!item) continue
    result[item[1]] = item[2].trim().replace(/^(['"])(.*)\1$/, '$2')
  }
  return result
}

function normalizeSkillFile(skillFile, root, projectRoot) {
  const content = readFileSync(skillFile, 'utf8')
  const meta = parseFrontMatter(content)
  const name = String(meta.name || path.basename(path.dirname(skillFile))).trim()
  const relativeToProject = path.relative(projectRoot, skillFile)
  const insideProject = relativeToProject && !relativeToProject.startsWith('..') && !path.isAbsolute(relativeToProject)
  return {
    name,
    label: meta.label || name,
    description: meta.description || '',
    descriptionZh: meta.descriptionZh || '',
    source: { type: 'skill_file', scope: root.scope, agent: root.agent, path: skillFile },
    scope: root.scope,
    agent: root.agent,
    workflowStage: meta.workflowStage || 'execution',
    requiredTools: [],
    recommendedTools: [],
    promptFile: insideProject ? relativeToProject.replaceAll(path.sep, '/') : skillFile,
    installed: true,
    enabled: true,
    tokens: 0,
    useWhen: [],
    skipWhen: [],
    category: meta.category || '',
    tags: String(meta.tags || '').split(',').map((item) => item.trim()).filter(Boolean),
    sources: [{ scope: root.scope, agent: root.agent, path: skillFile }]
  }
}

function sourcePriority(scope) {
  return { project: 4, user: 3, plugin_cache: 2, bundled: 1 }[scope] || 0
}

function mergeSkill(skills, candidate) {
  const existing = skills[candidate.name]
  if (!existing) {
    skills[candidate.name] = candidate
    return
  }
  const sources = [...(existing.sources || []), ...(candidate.sources || [])]
  const preferred = sourcePriority(candidate.scope) > sourcePriority(existing.scope) ? candidate : existing
  skills[candidate.name] = {
    ...preferred,
    description: preferred.description || existing.description || candidate.description || '',
    requiredTools: preferred.requiredTools?.length ? preferred.requiredTools : (existing.requiredTools || candidate.requiredTools || []),
    recommendedTools: preferred.recommendedTools?.length ? preferred.recommendedTools : (existing.recommendedTools || candidate.recommendedTools || []),
    sources: uniquePaths(sources.map((item) => ({ ...item, path: item.path })))
  }
}

/** 扫描 manifest Skill，以及项目/用户/插件缓存中的标准 SKILL.md。 */
export function scanSkillPlugins(options = {}) {
  const projectRoot = path.resolve(options.projectRoot || process.cwd())
  const skills = {}
  const manifestSkills = scanManifestPlugins('skills', normalizeSkillManifest, options)
  for (const skill of Object.values(manifestSkills)) mergeSkill(skills, skill)

  for (const root of skillRoots(options)) {
    for (const skillFile of findSkillFiles(root.path, root.maxDepth || 3)) {
      try {
        mergeSkill(skills, normalizeSkillFile(skillFile, root, projectRoot))
      } catch (error) {
        console.error(`[skill:scanner] 读取 ${skillFile} 失败: ${error.message}`)
      }
    }
  }

  const state = readSkillState({ projectRoot })
  for (const [name, skill] of Object.entries(skills)) {
    const saved = state.skills?.[name] || {}
    Object.assign(skill, classifySkill(skill))
    skill.enabled = saved.enabled ?? skill.enabled !== false
    skill.usageCount = Math.max(0, Number(saved.usageCount || 0))
    skill.lastUsedAt = saved.lastUsedAt || ''
  }
  return skills
}

export function readSkillState(options = {}) {
  return readJson(skillStatePath(options.projectRoot), { version: 2, updatedAt: '', skills: {} }) || { version: 2, updatedAt: '', skills: {} }
}

function syncSkillState(skills, options = {}) {
  const projectRoot = options.projectRoot || process.cwd()
  const state = readSkillState({ projectRoot })
  state.version = 2
  state.skills ||= {}
  for (const [name, skill] of Object.entries(skills)) {
    const current = state.skills[name] || {}
    state.skills[name] = {
      ...current,
      enabled: current.enabled ?? skill.enabled !== false,
      sourcePath: skill.promptFile || skill.source?.path || '',
      scope: skill.scope || skill.source?.scope || '',
      agent: skill.agent || skill.source?.agent || '',
      usageCount: Math.max(0, Number(current.usageCount ?? skill.usageCount ?? 0)),
      lastUsedAt: current.lastUsedAt || skill.lastUsedAt || '',
      lastSeenAt: timestamp()
    }
    skill.enabled = state.skills[name].enabled !== false
    skill.usageCount = state.skills[name].usageCount
    skill.lastUsedAt = state.skills[name].lastUsedAt
  }
  state.updatedAt = timestamp()
  writeJson(skillStatePath(projectRoot), state)
  return state
}

/** 全量扫描并写入 plugin-registry.json，同时保留 Skill 启停选择。 */
export function scanAndWriteRegistry(options = {}) {
  const projectRoot = path.resolve(options.projectRoot || process.cwd())
  const tools = scanToolPlugins({ ...options, projectRoot })
  const skills = scanSkillPlugins({ ...options, projectRoot })
  syncSkillState(skills, { projectRoot })
  const registry = { version: 3, updatedAt: timestamp(), tools, skills }
  writeJson(registryPath(projectRoot), registry)
  return registry
}

export function readPluginRegistry(options = {}) {
  const projectRoot = path.resolve(options.projectRoot || process.cwd())
  const file = registryPath(projectRoot)
  if (options.refresh === true || !existsSync(file)) return scanAndWriteRegistry({ ...options, projectRoot })
  return readJson(file, { version: 3, tools: {}, skills: {} }) || { version: 3, tools: {}, skills: {} }
}

export function setSkillEnabled(skillName, enabled, options = {}) {
  const projectRoot = path.resolve(options.projectRoot || process.cwd())
  const registry = readPluginRegistry({ ...options, projectRoot, refresh: true })
  if (!registry.skills?.[skillName]) throw new Error(`未知 Skill：${skillName}`)
  const state = readSkillState({ projectRoot })
  state.skills ||= {}
  state.skills[skillName] = {
    ...(state.skills[skillName] || {}),
    enabled: Boolean(enabled),
    sourcePath: registry.skills[skillName].promptFile || registry.skills[skillName].source?.path || '',
    scope: registry.skills[skillName].scope || '',
    agent: registry.skills[skillName].agent || '',
    updatedAt: timestamp()
  }
  state.updatedAt = timestamp()
  writeJson(skillStatePath(projectRoot), state)
  registry.skills[skillName].enabled = Boolean(enabled)
  registry.updatedAt = timestamp()
  writeJson(registryPath(projectRoot), registry)
  return { registry, state, skill: registry.skills[skillName] }
}

export function recordSkillUsage(skillName, options = {}) {
  const projectRoot = path.resolve(options.projectRoot || process.cwd())
  const registry = readPluginRegistry({ ...options, projectRoot })
  if (!registry.skills?.[skillName]) throw new Error(`未知 Skill：${skillName}`)
  const state = readSkillState({ projectRoot })
  state.version = 2
  state.skills ||= {}
  const current = state.skills[skillName] || {}
  const usedAt = timestamp()
  const usageCount = Math.max(0, Number(current.usageCount || registry.skills[skillName].usageCount || 0)) + 1
  state.skills[skillName] = {
    ...current,
    enabled: current.enabled ?? registry.skills[skillName].enabled !== false,
    sourcePath: registry.skills[skillName].promptFile || registry.skills[skillName].source?.path || '',
    scope: registry.skills[skillName].scope || '',
    agent: registry.skills[skillName].agent || '',
    usageCount,
    lastUsedAt: usedAt,
    updatedAt: usedAt
  }
  state.updatedAt = usedAt
  writeJson(skillStatePath(projectRoot), state)
  registry.skills[skillName].usageCount = usageCount
  registry.skills[skillName].lastUsedAt = usedAt
  registry.updatedAt = usedAt
  writeJson(registryPath(projectRoot), registry)
  return { registry, state, skill: registry.skills[skillName] }
}

/** 根据 manifest detection 检测工具是否已安装。 */
export function detectToolInstalled(manifest, options = {}) {
  if (!manifest || !manifest.detection) return { status: 'configured_unverified', usable: false }
  const commands = process.platform === 'win32'
    ? [...(manifest.detection.windowsCommands || []), ...(manifest.detection.commands || [])]
    : (manifest.detection.commands || [])
  const files = manifest.detection.files || []

  for (const command of commands) {
    if (commandExists(command)) return { status: 'installed', usable: true }
  }
  for (const file of files) {
    if (existsSync(projectPath(process.cwd(), file))) return { status: 'project_provided', usable: true }
  }
  const mcpAliases = manifest.detection.mcpServers || []
  if (mcpAliases.length) {
    const match = findConfiguredMcp(options.mcpScan || scanMcpServers(), mcpAliases)
    if (match) return { status: 'installed', usable: true, detectedBy: 'mcp_config', source: match.sources[0] || '' }
  }
  if (manifest.category === 'agent_adapter' || manifest.slotType === 'internal_adapter') return { status: 'built_in', usable: true }
  return { status: commands.length || files.length ? 'configured_not_installed' : 'configured_unverified', usable: false }
}

function commandExists(command) {
  const probe = process.platform === 'win32' ? 'where' : 'command'
  const args = process.platform === 'win32' ? [command] : ['-v', command]
  const result = spawnSync(probe, args, { shell: process.platform !== 'win32', stdio: 'ignore' })
  if (result.status === 0) return true
  if (process.platform !== 'win32') return false

  // Codex/IDE Shell 的 PATH 可能比交互式 PowerShell 更窄；同时检查常见 npm shim 目录。
  const searchDirs = [
    ...(process.env.PATH || '').split(path.delimiter),
    process.env.APPDATA ? path.join(process.env.APPDATA, 'npm') : '',
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Programs') : ''
  ].filter(Boolean)
  const ext = path.extname(command)
  const extensions = ext ? [''] : (process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(';')
  return searchDirs.some((dir) => extensions.some((suffix) => existsSync(path.join(dir, `${command}${suffix.toLowerCase()}`)) || existsSync(path.join(dir, `${command}${suffix.toUpperCase()}`))))
}

function normalizeToolManifest(manifest, source) {
  return {
    name: manifest.name,
    label: manifest.label || manifest.name,
    description: manifest.description || '',
    descriptionZh: manifest.descriptionZh || '',
    type: manifest.category || 'external_tool',
    status: 'configured',
    capabilities: manifest.capabilities || [],
    installScope: 'local-or-agent-env',
    localFirst: true,
    cloudUpload: false,
    autoUpdate: false,
    installHint: manifest.install?.hint || '',
    useWhen: manifest.usage?.useWhen || [],
    avoidWhen: manifest.usage?.avoidWhen || [],
    score: manifest.score || {},
    source,
    _manifest: manifest
  }
}

function normalizeSkillManifest(manifest, source) {
  const promptPath = manifest.promptFile
    ? path.resolve(path.dirname(source.manifestPath), '..', '..', '..', manifest.promptFile)
    : ''
  return {
    name: manifest.name,
    label: manifest.label || manifest.name,
    description: manifest.description || '',
    source: { ...(manifest.source || {}), scope: source.scope, path: source.manifestPath },
    scope: source.scope,
    agent: manifest.agent || '',
    workflowStage: manifest.workflowStage || 'execution',
    requiredTools: manifest.requiredTools || [],
    recommendedTools: manifest.recommendedTools || [],
    promptFile: existsSync(promptPath) ? promptPath : (manifest.promptFile || ''),
    installed: true,
    enabled: manifest.enabled !== false,
    tokens: manifest.tokens || 0,
    useWhen: manifest.useWhen || [],
    skipWhen: manifest.skipWhen || [],
    category: manifest.category || '',
    tags: manifest.tags || [],
    sources: [{ scope: source.scope, agent: manifest.agent || '', path: source.manifestPath }],
    _manifest: manifest
  }
}
