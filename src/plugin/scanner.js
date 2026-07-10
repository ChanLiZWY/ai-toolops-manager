import { readFile, readdirSync, existsSync, statSync } from 'node:fs'
import { join, basename } from 'node:path'
import { spawnSync } from 'node:child_process'
import { cwdPath, timestamp, writeJson, readJson } from '../utils.js'

const TOOLS_DIR = cwdPath('plugins', 'tools')
const SKILLS_DIR = cwdPath('plugins', 'skills')
const PLUGIN_REGISTRY_PATH = cwdPath('.ai-toolops', 'plugin-registry.json')

/**
 * 扫描 plugins/tools/ 目录下的所有 manifest.json，返回工具注册表
 */
export function scanToolPlugins() {
  const tools = {}
  const dir = TOOLS_DIR

  if (!existsSync(dir)) return tools

  const entries = readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const manifestPath = join(dir, entry.name, 'manifest.json')
    if (!existsSync(manifestPath)) continue

    try {
      const content = readFile(manifestPath, 'utf-8')
      const manifest = JSON.parse(content)
      if (!manifest.name) continue
      tools[manifest.name] = normalizeToolManifest(manifest)
    } catch (err) {
      console.error(`[plugin:scanner] 读取 ${entry.name}/manifest.json 失败:`, err.message)
    }
  }
  return tools
}

/**
 * 扫描 plugins/skills/ 目录下的所有 manifest.json，返回技能注册表
 */
export function scanSkillPlugins() {
  const skills = {}
  const dir = SKILLS_DIR

  if (!existsSync(dir)) return skills

  const entries = readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const manifestPath = join(dir, entry.name, 'manifest.json')
    if (!existsSync(manifestPath)) continue

    try {
      const content = readFile(manifestPath, 'utf-8')
      const manifest = JSON.parse(content)
      if (!manifest.name) continue
      skills[manifest.name] = normalizeSkillManifest(manifest)
    } catch (err) {
      console.error(`[plugin:scanner] 读取 ${entry.name}/manifest.json 失败:`, err.message)
    }
  }
  return skills
}

/**
 * 全量扫描并写入 plugin-registry.json
 */
export function scanAndWriteRegistry() {
  const tools = scanToolPlugins()
  const skills = scanSkillPlugins()
  const registry = {
    version: 2,
    updatedAt: timestamp(),
    tools,
    skills
  }
  writeJson(PLUGIN_REGISTRY_PATH, registry)
  return registry
}

/**
 * 从 registry 读取工具注册表（兼容旧版 tool-registry.json）
 */
export function readPluginRegistry() {
  if (existsSync(PLUGIN_REGISTRY_PATH)) {
    return readJson(PLUGIN_REGISTRY_PATH, { tools: {}, skills: {} })
  }
  // fallback: 扫描并生成
  return scanAndWriteRegistry()
}

/**
 * 检测工具是否已安装（基于 manifest 中的 detection 配置）
 */
export function detectToolInstalled(manifest) {
  if (!manifest || !manifest.detection) return { status: 'empty', usable: false }

  const { commands = [], files = [] } = manifest.detection

  // 检查命令是否存在
  for (const cmd of commands) {
    if (commandExists(cmd)) return { status: 'installed', usable: true }
  }

  // 检查项目文件是否存在
  for (const file of files) {
    if (existsSync(cwdPath(file))) return { status: 'project_provided', usable: true }
  }

  // 内置适配默认可用
  if (manifest.category === 'agent_adapter' || manifest.slotType === 'internal_adapter') {
    return { status: 'built_in', usable: true }
  }

  // 项目内置能力检查
  if (manifest.category === 'project_builtin') {
    return { status: existsSync(cwdPath('package.json')) ? 'project_provided' : 'configured_not_installed', usable: existsSync(cwdPath('package.json')) }
  }

  return { status: commands.length || files.length ? 'configured_not_installed' : 'configured_unverified', usable: false }
}

function commandExists(command) {
  const probe = process.platform === 'win32' ? 'where' : 'command'
  const args = process.platform === 'win32' ? [command] : ['-v', command]
  const result = spawnSync(probe, args, { shell: process.platform !== 'win32', stdio: 'ignore' })
  return result.status === 0
}

function normalizeToolManifest(manifest) {
  return {
    label: manifest.label || manifest.name,
    type: manifest.category || 'external_tool',
    status: manifest.detection?.commands?.length ? 'user-installed' : 'project-provided',
    capabilities: manifest.capabilities || [],
    installScope: 'local-or-agent-env',
    localFirst: true,
    cloudUpload: false,
    autoUpdate: false,
    installHint: manifest.install?.hint || '',
    useWhen: manifest.usage?.useWhen || [],
    avoidWhen: manifest.usage?.avoidWhen || [],
    score: manifest.score || {},
    _manifest: manifest
  }
}

function normalizeSkillManifest(manifest) {
  return {
    label: manifest.label || manifest.name,
    description: manifest.description || '',
    source: manifest.source || {},
    workflowStage: manifest.workflowStage || 'execution',
    requiredTools: manifest.requiredTools || [],
    recommendedTools: manifest.recommendedTools || [],
    promptFile: manifest.promptFile || '',
    enabled: manifest.enabled !== false,
    tokens: manifest.tokens || 0,
    useWhen: manifest.useWhen || [],
    skipWhen: manifest.skipWhen || [],
    _manifest: manifest
  }
}