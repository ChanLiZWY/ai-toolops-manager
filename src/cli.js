import path from 'node:path'
import readline from 'node:readline/promises'
import { parseArgs } from './args.js'
import {
  defaultLock,
  defaultPolicy,
  projectPaths,
  readProjectConfig,
  serializePolicy,
  writeProjectConfig
} from './v1/config.js'
import { resolveContext, renderContext } from './v1/resolver.js'
import { runDoctorV1 } from './v1/doctor.js'
import { analyzeMigration } from './v1/migration.js'
import { applyLifecycle, bootstrapLocked, installedTools, planLifecycle } from './v1/lifecycle.js'
import {
  applyMigration,
  applyMigrationRollback,
  planMigration,
  planMigrationRollback
} from './v1/migration-executor.js'
import {
  agentStatus,
  applyAgentBinding,
  detectCurrentAgent,
  planAgentBinding
} from './v1/agent-adapters.js'
import { applySelfUpdate, planSelfUpdate } from './v1/self-update.js'
import { startUiServer } from './v1/ui/server.js'

const VERSION = '1.0.0'
const LEGACY_CONTEXT_ALIASES = new Set(['generate-agent-rules', 'sync-agent-rules'])
const REMOVED_LEGACY_COMMANDS = new Set(['equip', 'unequip', 'toggle', 'reorder-tools', 'register-tool', 'create-slot', 'adapters', 'plugin', 'skill', 'rollback'])

export async function main(args) {
  const { flags, positionals } = parseArgs(args)
  const projectRoot = path.resolve(String(flags.get('project') || process.cwd()))
  const command = positionals[0] || 'ui'
  if (command === '--version' || command === '-v' || command === 'version' || flags.get('version') || flags.get('v')) return output(VERSION, flags)
  if (command === 'help' || flags.get('help') || flags.get('h')) return help()
  if (command === 'init') return initCommand({ projectRoot, flags })
  if (command === 'context') return contextCommand({ projectRoot, flags })
  if (command === 'doctor') return doctorCommand({ projectRoot, flags })
  if (command === 'install') return lifecycleCommand('install', positionals[1], { projectRoot, flags })
  if (command === 'update') return updateCommand(positionals[1], { projectRoot, flags })
  if (command === 'uninstall') return lifecycleCommand('uninstall', positionals[1], { projectRoot, flags })
  if (command === 'bootstrap') return bootstrapCommand({ projectRoot, flags })
  if (command === 'config') return configCommand(positionals.slice(1), { projectRoot, flags })
  if (command === 'migrate') return migrateCommand({ projectRoot, flags, action: positionals[1], id: positionals[2] })
  if (command === 'ui') return uiCommand({ projectRoot, flags })
  if (command === 'agent') return agentCommand(positionals.slice(1), { projectRoot, flags })
  if (command === 'setup') {
    deprecation('setup', 'init')
    return initCommand({ projectRoot, flags })
  }
  if (command === 'scan') {
    deprecation('scan', 'doctor')
    return doctorCommand({ projectRoot, flags })
  }
  if (LEGACY_CONTEXT_ALIASES.has(command)) {
    deprecation(command, 'context')
    return contextCommand({ projectRoot, flags })
  }
  if (REMOVED_LEGACY_COMMANDS.has(command)) {
    throw new Error(`旧命令 ${command} 不再直接修改项目 JSON。请运行 ai-toolops migrate --dry-run，并使用 init/install/config/agent 新命令。`)
  }
  throw new Error(`未知命令：${command}。运行 ai-toolops help 查看可用命令。`)
}

function initCommand({ projectRoot, flags }) {
  assertWindows()
  const current = readProjectConfig(projectRoot, { allowMissing: true })
  if (current.initialized) {
    const result = { ok: current.errors.length === 0, changed: false, message: current.errors.length ? current.errors.join('；') : '项目已经初始化', files: [relative(projectRoot, current.policy), relative(projectRoot, current.lock)] }
    return output(result, flags)
  }
  const legacy = analyzeMigration(projectRoot)
  if (legacy.legacyFiles.length) {
    throw new Error('检测到旧版 .ai-toolops 配置。请先运行 ai-toolops migrate --dry-run；Phase 2 提供正式迁移。')
  }
  const policy = defaultPolicy()
  const lock = defaultLock()
  const paths = projectPaths(projectRoot)
  const plan = {
    action: 'init',
    dryRun: Boolean(flags.get('dry-run')),
    writes: [
      { path: relative(projectRoot, paths.policy), content: serializePolicy(policy) },
      { path: relative(projectRoot, paths.lock), content: `${JSON.stringify(lock, null, 2)}\n` }
    ]
  }
  if (flags.get('dry-run')) return output(plan, flags)
  writeProjectConfig(projectRoot, policy, lock)
  return output({ ok: true, changed: true, message: '项目初始化完成', files: plan.writes.map((item) => item.path) }, flags)
}

function contextCommand({ projectRoot, flags }) {
  const context = resolveContext({
    projectRoot,
    agent: String(flags.get('agent') || 'auto')
  })
  if (flags.get('strict') && context.capabilities.some((item) => item.required && item.status.resolution !== 'ready')) process.exitCode = 1
  return output(flags.get('json') ? context : renderContext(context), flags, { alreadySelected: true })
}

function doctorCommand({ projectRoot, flags }) {
  const report = runDoctorV1({
    projectRoot,
    agent: String(flags.get('agent') || 'auto')
  })
  if (flags.get('strict') && !report.healthy) process.exitCode = 1
  if (flags.get('json')) return output(report, flags)
  const lines = [`AI ToolOps Doctor: ${report.healthy ? 'healthy' : 'needs-attention'}`]
  for (const check of report.checks) {
    lines.push(`${check.level === 'ok' ? 'OK' : check.level.toUpperCase()} ${check.id} - ${check.message}`)
    if (check.recovery) lines.push(`  恢复：${check.recovery}`)
  }
  return output(`${lines.join('\n')}\n`, flags, { alreadySelected: true })
}

async function lifecycleCommand(action, tool, { projectRoot, flags }) {
  if (!tool) throw new Error(`用法：ai-toolops ${action} <tool>`)
  const plan = planLifecycle(action, tool, {
    projectRoot,
    version: flagString(flags, 'version'),
    source: flagString(flags, 'source'),
    checksum: flagString(flags, 'checksum')
  })
  if (flags.get('dry-run')) return output({ dryRun: true, plan }, flags)
  const confirmed = await confirmPlan(plan, flags)
  return output(await applyLifecycle(plan, { confirmed }), flags)
}

async function updateCommand(tool, { projectRoot, flags }) {
  if (tool === 'self') {
    const plan = planSelfUpdate({
      source: flagString(flags, 'source'),
      checksum: flagString(flags, 'checksum'),
      checksumSource: flagString(flags, 'checksum-source'),
      target: flagString(flags, 'target')
    })
    if (flags.get('dry-run')) return output({ dryRun: true, plan }, flags)
    return output(await applySelfUpdate(plan, { confirmed: await confirmPlan(plan, flags), launchHelper: true }), flags)
  }
  const targets = flags.get('all') ? Object.keys(installedTools()) : [tool].filter(Boolean)
  if (!targets.length) throw new Error('用法：ai-toolops update <tool> 或 ai-toolops update --all')
  const plans = targets.map((target) => planLifecycle('update', target, {
    projectRoot,
    version: flagString(flags, 'version'),
    source: flagString(flags, 'source'),
    checksum: flagString(flags, 'checksum')
  }))
  if (flags.get('dry-run')) return output({ dryRun: true, plans }, flags)
  const results = []
  for (const plan of plans) results.push(await applyLifecycle(plan, { confirmed: await confirmPlan(plan, flags) }))
  return output({ plans, results }, flags)
}

async function bootstrapCommand({ projectRoot, flags }) {
  if (!flags.get('locked')) throw new Error('v1 只支持 ai-toolops bootstrap --locked')
  if (flags.get('dry-run')) return output(await bootstrapLocked({ projectRoot, dryRun: true }), flags)
  const preview = await bootstrapLocked({ projectRoot, dryRun: true })
  if (!preview.plans.length) return output({ ok: true, changed: false, message: '锁定工具均已满足' }, flags)
  const confirmed = await confirmPlans(preview.plans, flags)
  return output(await bootstrapLocked({ projectRoot, confirmed }), flags)
}

async function configCommand(args, { projectRoot, flags }) {
  const [area, action, tool] = args
  if (area !== 'external-tool' || action !== 'add' || !tool || !flags.get('path')) {
    throw new Error('用法：ai-toolops config external-tool add <name> --path <绝对路径>')
  }
  const plan = planLifecycle('register', tool, {
    projectRoot,
    providerId: 'external-command',
    externalPath: String(flags.get('path'))
  })
  if (flags.get('dry-run')) return output({ dryRun: true, plan }, flags)
  return output(await applyLifecycle(plan, { confirmed: await confirmPlan(plan, flags) }), flags)
}

async function migrateCommand({ projectRoot, flags, action, id }) {
  if (flags.get('dry-run') || action === 'preview') return output(analyzeMigration(projectRoot), flags)
  if (action === 'rollback') {
    const plan = planMigrationRollback(projectRoot, id)
    return output(await applyMigrationRollback(plan, { confirmed: await confirmPlan(plan, flags) }), flags)
  }
  if (action) throw new Error('用法：ai-toolops migrate --dry-run | ai-toolops migrate --yes | ai-toolops migrate rollback [id] --yes')
  const plan = planMigration(projectRoot)
  return output(await applyMigration(plan, { confirmed: await confirmPlan(plan, flags) }), flags)
}

async function agentCommand(args, { projectRoot, flags }) {
  const [action, agentId] = args
  if (action === 'detect') return output(detectCurrentAgent({ agent: agentId || flags.get('agent') || 'auto' }), flags)
  if (action === 'status') {
    if (agentId) return output(agentStatus(agentId, { projectRoot }), flags)
    return output(['codex', 'claude', 'roo'].map((id) => agentStatus(id, { projectRoot })), flags)
  }
  if (!['bind', 'unbind'].includes(action) || !agentId) {
    throw new Error('用法：ai-toolops agent detect | status [agent] | bind|unbind <codex|claude|roo>')
  }
  const plan = planAgentBinding(action, agentId)
  if (flags.get('dry-run')) return output({ dryRun: true, plan }, flags)
  return output(await applyAgentBinding(plan, { confirmed: await confirmPlan(plan, flags) }), flags)
}

function uiCommand({ projectRoot, flags }) {
  const result = startUiServer({
    projectRoot,
    agent: String(flags.get('agent') || 'auto'),
    port: Number(flags.get('port') || process.env.AI_TOOLOPS_UI_PORT || 4177),
    open: !flags.get('no-open') && process.env.AI_TOOLOPS_UI_NO_OPEN !== '1',
    onListening: ({ url }) => console.log(`AI ToolOps UI: ${url}`)
  })
  return result
}

function phasePending(command, phase) {
  throw new Error(`${command} 将在 ${phase} 实现；当前版本不会用提示词冒充真实操作。`)
}

async function confirmPlan(plan, flags) {
  return confirmPlans([plan], flags)
}

async function confirmPlans(plans, flags) {
  if (flags.get('yes')) return true
  if (!process.stdin.isTTY || flags.get('json')) {
    throw new Error('非交互变更必须使用 --yes；预览使用 --dry-run')
  }
  console.log(JSON.stringify({ plans }, null, 2))
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  try {
    const answer = await rl.question('应用以上变更？输入 yes 继续：')
    if (answer.trim().toLowerCase() !== 'yes') throw new Error('用户取消操作')
    return true
  } finally {
    rl.close()
  }
}

function flagString(flags, key) {
  const value = flags.get(key)
  return value === true || value === undefined ? undefined : String(value)
}

function assertWindows() {
  if (process.platform !== 'win32') throw new Error(`Windows v1 不支持当前平台：${process.platform}`)
  if (process.arch !== 'x64') throw new Error(`Windows v1 不支持当前架构：${process.arch}`)
}

function output(value, flags, options = {}) {
  if (options.alreadySelected) {
    process.stdout.write(typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`)
    return value
  }
  if (flags?.get('json') || typeof value !== 'string') console.log(typeof value === 'string' ? JSON.stringify({ value }, null, 2) : JSON.stringify(value, null, 2))
  else process.stdout.write(value.endsWith('\n') ? value : `${value}\n`)
  return value
}

function deprecation(oldCommand, nextCommand) {
  console.error(`DEPRECATED: ${oldCommand} 将在下一版本删除，请改用 ai-toolops ${nextCommand}。`)
}

function relative(root, file) {
  return path.relative(root, file).replaceAll(path.sep, '/')
}

function help() {
  const text = `AI ToolOps Manager ${VERSION}

Windows 10/11 x64 local-first tool manager.

Double-click ai-toolops.exe or run ai-toolops without arguments to open the local UI.
Run ai-toolops --help to display this help.

Commands:
  ai-toolops init [--dry-run]                   初始化项目意图和锁文件
  ai-toolops context [--agent auto] [--json]   输出当前 Agent 的能力上下文
  ai-toolops doctor [--strict] [--json]        只读检查项目、电脑和 Agent 状态
  ai-toolops install <tool> [--dry-run]         安装工具
  ai-toolops update [tool|--all|self]           更新工具或 ToolOps
  ai-toolops uninstall <tool>                   卸载工具
  ai-toolops bootstrap --locked                 按锁文件恢复电脑环境
  ai-toolops migrate --dry-run                  预检旧项目迁移
  ai-toolops agent ...                          管理 Agent 隔离绑定
  ai-toolops config ...                         管理高级项目策略
  ai-toolops ui                                 打开本地管理界面

Common options:
  --project <path>  --agent <auto|generic|codex|claude|roo>  --json  --dry-run  --yes
`
  process.stdout.write(text)
  return text
}
