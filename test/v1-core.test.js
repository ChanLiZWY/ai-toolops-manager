import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  defaultLock,
  defaultPolicy,
  readProjectConfig,
  validatePolicy,
  writeProjectConfig
} from '../src/v1/config.js'
import { discoverAgentBindings, resolveAgent } from '../src/v1/agents.js'
import { resolveContext } from '../src/v1/resolver.js'
import { runDoctorV1 } from '../src/v1/doctor.js'
import { analyzeMigration } from '../src/v1/migration.js'
import { agentStatus, applyAgentBinding, planAgentBinding } from '../src/v1/agent-adapters.js'

function tempRoot(name = '项目 空格') {
  return fs.mkdtempSync(path.join(os.tmpdir(), `ai-toolops-${name}-`))
}

test('项目配置拒绝 Windows 绝对路径、健康状态和凭据', () => {
  const policy = defaultPolicy()
  policy.installPath = 'C:\\Users\\someone\\tool.exe'
  policy.health = 'healthy'
  policy.credential = 'secret'
  const errors = validatePolicy(policy)
  assert.ok(errors.some((item) => item.includes('绝对路径')))
  assert.ok(errors.some((item) => item.includes('health')))
  assert.ok(errors.some((item) => item.includes('credential')))
})

test('中文和空格项目路径只生成 policy 与 lock', () => {
  const root = tempRoot()
  writeProjectConfig(root, defaultPolicy(), defaultLock())
  const config = readProjectConfig(root)
  assert.equal(config.initialized, true)
  assert.deepEqual(fs.readdirSync(config.configRoot).sort(), ['policy.yaml', 'toolops.lock.json'])
  assert.deepEqual(config.errors, [])
})

test('Agent auto 无可信证据时安全回退 generic', () => {
  assert.deepEqual(resolveAgent('auto', {}), {
    requested: 'auto',
    resolved: 'generic',
    confidence: 'unknown',
    evidence: []
  })
  assert.equal(resolveAgent('auto', { AI_TOOLOPS_AGENT: 'claude' }).resolved, 'claude')
})

test('MCP 配置按 Agent 隔离扫描', () => {
  const root = tempRoot('agent')
  const home = path.join(root, 'home')
  const codexHome = path.join(home, '.codex')
  fs.mkdirSync(codexHome, { recursive: true })
  fs.writeFileSync(path.join(codexHome, 'config.toml'), '[mcp_servers.only_codex]\ncommand = "x"\n[mcp_servers.codebase_memory]\ncommand = "x"\n')
  fs.writeFileSync(path.join(home, '.claude.json'), JSON.stringify({ mcpServers: { only_claude: { command: 'x' } } }))
  const codex = discoverAgentBindings('codex', { projectRoot: root, homeDir: home, codexHome })
  const claude = discoverAgentBindings('claude', { projectRoot: root, homeDir: home, claudeHome: path.join(home, '.claude') })
  assert.ok(codex.servers['only-codex'])
  assert.ok(codex.servers['codebase-memory'])
  assert.equal(codex.servers['only-claude'], undefined)
  assert.ok(claude.servers['only-claude'])
  assert.equal(claude.servers['only-codex'], undefined)

  const policy = defaultPolicy()
  policy.capabilities = {
    code_graph: { required: false, providers: ['codebase-memory-mcp'] }
  }
  writeProjectConfig(root, policy, defaultLock())
  const context = resolveContext({
    projectRoot: root,
    agent: 'codex',
    machine: { home: path.join(root, 'machine') },
    agentOptions: { homeDir: home, codexHome }
  })
  assert.equal(context.capabilities[0].status.resolution, 'ready')
  assert.equal(context.capabilities[0].status.binding, 'bound')
})

test('context 与 doctor 默认只读', () => {
  const root = tempRoot('readonly')
  const machineHome = path.join(root, 'machine')
  writeProjectConfig(root, defaultPolicy(), defaultLock())
  const before = treeSnapshot(root)
  const context = resolveContext({ projectRoot: root, agent: 'generic', machine: { home: machineHome }, env: {} })
  const doctor = runDoctorV1({ projectRoot: root, agent: 'generic', machine: { home: machineHome }, env: {} })
  const after = treeSnapshot(root)
  assert.deepEqual(after, before)
  assert.equal(context.agent.resolved, 'generic')
  assert.equal(Array.isArray(doctor.checks), true)
  assert.equal(fs.existsSync(machineHome), false)
})

test('旧项目迁移预检只输出计划并丢弃低价值状态', () => {
  const root = tempRoot('migration')
  const legacy = path.join(root, '.ai-toolops')
  fs.mkdirSync(legacy, { recursive: true })
  fs.writeFileSync(path.join(legacy, 'equipment.json'), JSON.stringify({
    slots: {
      exact_search: { enabled: true, required: true, tools: ['rg'], active: 'rg' },
      architecture_context: { enabled: true, tools: ['project-architecture-docs'] },
      build_validation: { enabled: true, tools: ['package-scripts'] },
      agent_compatibility: { enabled: true, tools: ['codex-adapter', 'claude-adapter', 'roo-adapter'] }
    }
  }))
  fs.writeFileSync(path.join(legacy, 'skills.json'), JSON.stringify({ usage: { demo: 3 } }))
  const before = treeSnapshot(root)
  const report = analyzeMigration(root)
  assert.deepEqual(treeSnapshot(root), before)
  assert.deepEqual(report.preview.policy.capabilities.exact_search.providers, ['rg'])
  assert.equal(report.preview.policy.capabilities.architecture_context, undefined)
  assert.equal(report.preview.policy.capabilities.build_validation, undefined)
  assert.equal(report.preview.policy.capabilities.agent_compatibility, undefined)
  assert.ok(report.dropped.some((item) => item.startsWith('equipment.json slots.architecture_context')))
  assert.ok(report.dropped.some((item) => item.startsWith('equipment.json slots.build_validation')))
  assert.ok(report.dropped.some((item) => item.startsWith('equipment.json slots.agent_compatibility')))
  assert.ok(report.dropped.some((item) => item.startsWith('skills.json')))
  assert.deepEqual(report.writes, [])
})

test('Agent bind 只写机器绑定记录且彼此隔离', async () => {
  const root = tempRoot('agent-bind')
  const machine = { home: path.join(root, 'machine') }
  const codexPlan = planAgentBinding('bind', 'codex', { machine })
  assert.equal(codexPlan.details.writesHostConfig, false)
  const dry = await applyAgentBinding(codexPlan, { machine, dryRun: true })
  assert.equal(dry.dryRun, true)
  assert.equal(fs.existsSync(machine.home), false)
  await applyAgentBinding(codexPlan, { machine, confirmed: true })
  assert.equal(agentStatus('codex', { projectRoot: root, machine }).binding.status, 'bound')
  assert.equal(agentStatus('claude', { projectRoot: root, machine }).binding.status, 'unbound')
  const unbind = planAgentBinding('unbind', 'codex', { machine })
  await applyAgentBinding(unbind, { machine, confirmed: true })
  assert.equal(agentStatus('codex', { projectRoot: root, machine }).binding.status, 'unbound')
})

function treeSnapshot(root) {
  const result = {}
  function visit(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      const relative = path.relative(root, full).replaceAll(path.sep, '/')
      if (entry.isDirectory()) visit(full)
      else result[relative] = fs.readFileSync(full).toString('base64')
    }
  }
  visit(root)
  return result
}
