import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { atomicWrite } from './config.js'

export const INVENTORY_SCHEMA_VERSION = 1

export function windowsPaths(options = {}) {
  const localAppData = options.localAppData || process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local')
  const root = path.resolve(options.home || process.env.AI_TOOLOPS_HOME || path.join(localAppData, 'ai-toolops'))
  return {
    root,
    inventory: path.join(root, 'inventory.json'),
    uiState: path.join(root, 'ui.json'),
    tools: path.join(root, 'tools'),
    bin: path.join(root, 'bin'),
    cache: path.join(root, 'cache'),
    receipts: path.join(root, 'receipts'),
    migrations: path.join(root, 'migrations'),
    agents: path.join(root, 'agents')
  }
}

export function emptyInventory() {
  return {
    schemaVersion: INVENTORY_SCHEMA_VERSION,
    tools: {},
    updatedAt: null
  }
}

export function readInventory(options = {}) {
  const paths = windowsPaths(options)
  if (!fs.existsSync(paths.inventory)) return { paths, inventory: emptyInventory(), errors: [] }
  try {
    const inventory = JSON.parse(fs.readFileSync(paths.inventory, 'utf8'))
    const errors = validateInventory(inventory)
    return { paths, inventory, errors }
  } catch (error) {
    return { paths, inventory: emptyInventory(), errors: [`inventory.json 无法解析：${error.message}`] }
  }
}

export function writeInventory(inventory, options = {}) {
  const paths = windowsPaths(options)
  const errors = validateInventory(inventory)
  if (errors.length) throw new Error(`电脑库存无效：${errors.join('；')}`)
  const next = { ...inventory, updatedAt: new Date().toISOString() }
  atomicWrite(paths.inventory, `${JSON.stringify(next, null, 2)}\n`)
  return { paths, inventory: next }
}

export function validateInventory(inventory) {
  const errors = []
  if (!inventory || typeof inventory !== 'object') return ['inventory 必须是对象']
  if (inventory.schemaVersion !== INVENTORY_SCHEMA_VERSION) errors.push(`inventory schemaVersion 必须为 ${INVENTORY_SCHEMA_VERSION}`)
  if (!inventory.tools || typeof inventory.tools !== 'object' || Array.isArray(inventory.tools)) errors.push('inventory.tools 必须是对象')
  return errors
}

export function ensureWindowsLayout(options = {}) {
  const paths = windowsPaths(options)
  for (const dir of [paths.root, paths.tools, paths.bin, paths.cache, paths.receipts, paths.migrations, paths.agents]) {
    fs.mkdirSync(dir, { recursive: true })
  }
  if (!fs.existsSync(paths.inventory)) writeInventory(emptyInventory(), options)
  return paths
}
