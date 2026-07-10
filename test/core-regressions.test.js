import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { generateAdapterOutputs } from '../src/adapters/agentAdapters.js'
import { defaultAdapters } from '../src/core/adapterConfig.js'
import { runDoctor } from '../src/core/doctor.js'
import { generatePolicyOutputs } from '../src/core/policyGenerator.js'
import { serveStatic } from '../src/utils.js'

test('关闭 Adapter 会覆盖旧适配文件为关闭提示', () => {
  const config = defaultAdapters()
  config.adapters.claude.enabled = false
  const outputs = generateAdapterOutputs({ name: 'audit' }, { slots: {} }, config)
  assert.ok(outputs['claude.toolops.md'].includes('该适配器已在'))
})

test('没有检测契约的已注册工具不会冒充已安装', () => {
  const report = runDoctor(
    { name: 'audit', scripts: {}, agents: [], architecture: [], framework: ['unknown'], packageManager: 'unknown' },
    { slots: { demo: { label: 'Demo', tools: ['ghost'], active: 'ghost', enabled: true, slotType: 'exclusive_priority', category: 'external_tool' } } },
    { tools: { ghost: { label: 'Ghost', status: 'user-installed', capabilities: ['demo'] } } },
    { tools: {}, skills: {} }
  )
  const tool = report.slots[0].tools[0]
  assert.equal(tool.status, 'configured_unverified')
  assert.equal(tool.usable, false)
})

test('有效策略包含扫描后的 Skill 状态与规则文件', () => {
  const config = defaultAdapters()
  const outputs = generatePolicyOutputs(
    { name: 'audit' },
    { slots: {} },
    { tools: {} },
    { slots: [] },
    config,
    { skills: { demo: { label: 'Demo', enabled: true, scope: 'project', promptFile: '.codex/skills/demo/SKILL.md' } } }
  )
  assert.ok(outputs.effectivePolicy.includes('Demo (demo)'))
  assert.ok(outputs.agentRules.includes('已启用 Skills'))
  assert.ok(outputs.ruleFiles['skills.md'].includes('.codex/skills/demo/SKILL.md'))
})

test('UI 服务暴露插件扫描、Skill 启停与使用记录 API', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-toolops-ui-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><title>test</title>')
  const server = serveStatic(root, 0, {
    onPluginScan: () => ({ tools: 2, skills: 3 }),
    onSkillToggle: ({ skill, enabled }) => ({ skill, enabled }),
    onSkillUse: ({ skill }) => ({ skill, usageCount: 4, lastUsedAt: '2026-07-10T12:00:00.000Z' })
  })
  t.after(() => server.close())
  await new Promise((resolve) => server.once('listening', resolve))
  const port = server.address().port

  const scan = await fetch(`http://127.0.0.1:${port}/api/plugin-scan`, { method: 'POST' })
  assert.equal(scan.status, 200)
  assert.deepEqual(await scan.json(), { ok: true, tools: 2, skills: 3 })

  const toggle = await fetch(`http://127.0.0.1:${port}/api/skill-toggle`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ skill: 'demo', enabled: false })
  })
  assert.equal(toggle.status, 200)
  assert.equal((await toggle.json()).enabled, false)

  const usage = await fetch(`http://127.0.0.1:${port}/api/skill-use`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ skill: 'demo' })
  })
  assert.equal(usage.status, 200)
  assert.equal((await usage.json()).usageCount, 4)
})
