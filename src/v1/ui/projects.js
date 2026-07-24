import fs from 'node:fs'
import path from 'node:path'
import { atomicWrite, readProjectConfig } from '../config.js'
import { windowsPaths } from '../windows-store.js'

const UI_STATE_SCHEMA_VERSION = 1
const MAX_RECENT_PROJECTS = 8

export function readUiProjects(machine = {}) {
  const file = windowsPaths(machine).uiState
  const fallback = { schemaVersion: UI_STATE_SCHEMA_VERSION, recentProjects: [] }
  if (!fs.existsSync(file)) return { file, state: fallback }
  try {
    const value = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (value?.schemaVersion !== UI_STATE_SCHEMA_VERSION || !Array.isArray(value.recentProjects)) {
      return { file, state: fallback }
    }
    return {
      file,
      state: {
        schemaVersion: UI_STATE_SCHEMA_VERSION,
        recentProjects: normalizeRecent(value.recentProjects)
      }
    }
  } catch {
    return { file, state: fallback }
  }
}

export function rememberUiProject(projectRoot, machine = {}) {
  const root = validateUiProject(projectRoot)
  const current = readUiProjects(machine)
  const recentProjects = normalizeRecent([
    { root, lastOpenedAt: new Date().toISOString() },
    ...current.state.recentProjects
  ]).slice(0, MAX_RECENT_PROJECTS)
  const state = { schemaVersion: UI_STATE_SCHEMA_VERSION, recentProjects }
  atomicWrite(current.file, `${JSON.stringify(state, null, 2)}\n`)
  return state
}

export function validateUiProject(projectRoot) {
  const root = path.resolve(String(projectRoot || '').trim())
  if (!String(projectRoot || '').trim()) throw new Error('请选择项目目录')
  let stat
  try {
    stat = fs.statSync(root)
  } catch {
    throw new Error(`项目目录不存在：${root}`)
  }
  if (!stat.isDirectory()) throw new Error(`项目路径不是目录：${root}`)
  const config = readProjectConfig(root, { allowMissing: true })
  if (!config.initialized) {
    throw new Error(`该目录尚未初始化：${root}。请先在项目目录运行 ai-toolops init`)
  }
  if (config.errors.length) throw new Error(`项目配置无效：${config.errors.join('；')}`)
  return root
}

export function projectListView(currentRoot, machine = {}) {
  const current = path.resolve(currentRoot)
  return {
    current: projectView(current),
    recent: readUiProjects(machine).state.recentProjects
      .filter((item) => !samePath(item.root, current))
      .map((item) => projectView(item.root, item.lastOpenedAt))
  }
}

function normalizeRecent(items) {
  const result = []
  for (const item of items) {
    if (!item || typeof item.root !== 'string' || !path.isAbsolute(item.root)) continue
    const root = path.resolve(item.root)
    if (!fs.existsSync(root) || !readProjectConfig(root, { allowMissing: true }).initialized) continue
    if (result.some((existing) => samePath(existing.root, root))) continue
    result.push({
      root,
      lastOpenedAt: typeof item.lastOpenedAt === 'string' ? item.lastOpenedAt : null
    })
  }
  return result
}

function projectView(root, lastOpenedAt = null) {
  return {
    name: path.basename(root) || root,
    root,
    initialized: readProjectConfig(root, { allowMissing: true }).initialized,
    exists: fs.existsSync(root),
    lastOpenedAt
  }
}

function samePath(left, right) {
  return process.platform === 'win32'
    ? left.toLowerCase() === right.toLowerCase()
    : left === right
}
