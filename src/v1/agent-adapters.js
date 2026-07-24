import fs from 'node:fs'
import path from 'node:path'
import { atomicWrite } from './config.js'
import { discoverAgentBindings, resolveAgent } from './agents.js'
import { createActionPlan, executeTransaction } from './transaction.js'
import { windowsPaths } from './windows-store.js'

const INSTRUCTION = '执行任务前运行 `ai-toolops context --project . --agent auto`，阅读并遵守输出的能力、工具状态和选择规则；命令不可用或必需能力缺失时先报告并执行建议的恢复步骤。'
const SUPPORTED = new Set(['codex', 'claude', 'roo'])

export function agentStatus(agentId, options = {}) {
  const id = normalizeAgent(agentId)
  const file = bindingFile(id, options.machine)
  const record = readJson(file)
  const discovered = discoverAgentBindings(id, {
    projectRoot: options.projectRoot,
    ...(options.agentOptions || {})
  })
  return {
    schemaVersion: 1,
    agentId: id,
    adapter: {
      method: 'manual-instruction',
      writesHostConfig: false,
      instruction: INSTRUCTION
    },
    binding: record || { status: 'unbound' },
    discovered: {
      configSources: discovered.sources,
      mcpServers: Object.keys(discovered.servers)
    }
  }
}

export function detectCurrentAgent(options = {}) {
  return resolveAgent(options.agent || 'auto', options.env || process.env)
}

export function planAgentBinding(action, agentId, options = {}) {
  if (!['bind', 'unbind'].includes(action)) throw new Error(`不支持的 Agent 操作：${action}`)
  const id = normalizeAgent(agentId)
  const file = bindingFile(id, options.machine)
  return createActionPlan({
    action: `agent-${action}`,
    providerId: `agent.${id}`,
    tool: id,
    changes: [{
      scope: 'machine',
      operation: action,
      target: file,
      method: 'manual-instruction'
    }],
    permissions: { writePaths: [file] },
    details: {
      agentId: id,
      bindingFile: file,
      instruction: INSTRUCTION,
      writesHostConfig: false
    }
  })
}

export function applyAgentBinding(plan, options = {}) {
  const file = plan.details.bindingFile
  let previous = null
  return executeTransaction(plan, async (transaction) => {
    previous = readJson(file)
    if (plan.action === 'agent-unbind') {
      fs.rmSync(file, { force: true })
      transaction.step('agent.binding.removed')
      return { agentId: plan.details.agentId, status: 'unbound' }
    }
    const record = {
      schemaVersion: 1,
      agentId: plan.details.agentId,
      status: 'bound',
      method: 'manual-instruction',
      instruction: plan.details.instruction,
      confirmedAt: new Date().toISOString()
    }
    atomicWrite(file, `${JSON.stringify(record, null, 2)}\n`)
    transaction.step('agent.binding.recorded')
    return record
  }, {
    machine: options.machine,
    dryRun: options.dryRun,
    confirmed: options.confirmed,
    rollback: async () => {
      if (previous) atomicWrite(file, `${JSON.stringify(previous, null, 2)}\n`)
      else fs.rmSync(file, { force: true })
      return { restored: Boolean(previous) }
    }
  })
}

export function bindingInstruction() {
  return INSTRUCTION
}

function bindingFile(agentId, machine) {
  return path.join(windowsPaths(machine || {}).agents, agentId, 'bindings.json')
}

function normalizeAgent(value) {
  const id = String(value || '').toLowerCase()
  if (!SUPPORTED.has(id)) throw new Error(`Agent Adapter 仅支持：${[...SUPPORTED].join(', ')}`)
  return id
}

function readJson(file) {
  if (!fs.existsSync(file)) return null
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}
