import fs from 'node:fs'
import path from 'node:path'
import { getProvider } from './providers/registry.js'
import { readProjectConfig, writeProjectConfig } from './config.js'
import { executeTransaction } from './transaction.js'
import { readInventory, windowsPaths, writeInventory } from './windows-store.js'

export function planLifecycle(action, tool, options = {}) {
  const providerId = options.providerId || (options.externalPath ? 'external-command' : tool)
  const provider = getProvider(providerId)
  const machine = readInventory(options.machine || {})
  const project = readProjectConfig(options.projectRoot, { allowMissing: false })
  if (!project.initialized || project.errors.length) throw new Error(project.errors.join('；') || '项目尚未初始化')
  const plan = provider.plan(action, {
    ...options,
    tool,
    version: options.version || machine.inventory.tools?.[tool]?.version,
    source: options.source || machine.inventory.tools?.[tool]?.artifact?.url,
    checksum: options.checksum || machine.inventory.tools?.[tool]?.artifact?.sha256,
    path: options.externalPath,
    machine: options.machine,
    inventory: machine.inventory,
    inventoryFile: machine.paths.inventory
  })
  plan.details.projectRoot = project.projectRoot
  plan.permissions.writePaths = unique([...plan.permissions.writePaths, project.lock, machine.paths.inventory])
  return plan
}

export async function applyLifecycle(plan, options = {}) {
  const provider = getProvider(plan.providerId)
  const machineState = readInventory(options.machine || {})
  const previousInventory = structuredClone(machineState.inventory)
  const project = readProjectConfig(plan.details.projectRoot, { allowMissing: false })
  const previousLock = structuredClone(project.lock)
  let providerResult = null
  return executeTransaction(plan, async (transaction) => {
    transaction.step('provider.apply.started')
    providerResult = await provider.apply(plan, { machine: options.machine, transaction })
    transaction.step('provider.apply.completed', { changed: providerResult.changed !== false })
    const inventory = structuredClone(previousInventory)
    if (providerResult.removeInventory) delete inventory.tools[plan.tool]
    else if (providerResult.entry) inventory.tools[plan.tool] = providerResult.entry
    writeInventory(inventory, options.machine || {})
    transaction.step('inventory.committed')
    const lock = structuredClone(previousLock)
    if (plan.action === 'uninstall') delete lock.tools[plan.tool]
    else if (providerResult.entry?.source === 'managed') {
      lock.tools[plan.tool] = {
        provider: plan.providerId,
        version: providerResult.entry.version,
        artifact: providerResult.entry.artifact || null
      }
    }
    writeProjectConfig(project.projectRoot, project.policy, lock)
    transaction.step('project.lock.committed')
    if (typeof provider.finalize === 'function') await provider.finalize(plan, providerResult, { machine: options.machine })
    return { tool: plan.tool, entry: providerResult.entry || null, removed: Boolean(providerResult.removeInventory) }
  }, {
    machine: options.machine,
    dryRun: options.dryRun,
    confirmed: options.confirmed,
    rollback: async (transaction) => {
      writeInventory(previousInventory, options.machine || {})
      writeProjectConfig(project.projectRoot, project.policy, previousLock)
      const providerRollback = await provider.rollback(plan, providerResult, { machine: options.machine, transaction })
      return { inventory: 'restored', lock: 'restored', provider: providerRollback }
    }
  })
}

export async function bootstrapLocked(options = {}) {
  const project = readProjectConfig(options.projectRoot, { allowMissing: false })
  if (!project.initialized || project.errors.length) throw new Error(project.errors.join('；') || '项目尚未初始化')
  const machine = readInventory(options.machine || {})
  const plans = []
  for (const [tool, locked] of Object.entries(project.lock.tools || {})) {
    const current = machine.inventory.tools?.[tool]
    if (current?.version === locked.version && current.health !== 'broken') continue
    plans.push(planLifecycle(current ? 'update' : 'install', tool, {
      projectRoot: project.projectRoot,
      machine: options.machine,
      version: locked.version,
      source: locked.artifact?.url,
      checksum: locked.artifact?.sha256,
      providerId: locked.provider
    }))
  }
  if (options.dryRun) return { dryRun: true, plans }
  const results = []
  for (const plan of plans) results.push(await applyLifecycle(plan, { ...options, confirmed: options.confirmed }))
  return { plans, results }
}

export function installedTools(options = {}) {
  return readInventory(options.machine || {}).inventory.tools || {}
}

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}
