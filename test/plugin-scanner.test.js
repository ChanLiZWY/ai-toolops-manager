import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  readPluginRegistry,
  detectToolInstalled,
  scanAndWriteRegistry,
  scanSkillPlugins,
  scanToolPlugins,
  recordSkillUsage,
  setSkillEnabled
} from '../src/plugin/scanner.js'
import { findConfiguredMcp, scanMcpServers } from '../src/scanner/mcpScanner.js'

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-toolops-test-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  return root
}

test('扫描 manifest 与标准 SKILL.md', (t) => {
  const root = fixture(t)
  const toolDir = path.join(root, 'plugins', 'tools', 'demo-tool')
  const skillDir = path.join(root, '.codex', 'skills', 'demo-skill')
  fs.mkdirSync(toolDir, { recursive: true })
  fs.mkdirSync(skillDir, { recursive: true })
  fs.writeFileSync(path.join(toolDir, 'manifest.json'), JSON.stringify({
    name: 'demo-tool',
    label: 'Demo Tool',
    capabilities: ['demo'],
    detection: { commands: [], files: ['demo.config.json'] }
  }))
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '---\nname: demo-skill\ndescription: Demo skill\n---\n# Demo\n')

  const options = { projectRoot: root, includePackage: false, includeGlobal: false }
  assert.deepEqual(Object.keys(scanToolPlugins(options)), ['demo-tool'])
  const skills = scanSkillPlugins(options)
  assert.equal(skills['demo-skill'].description, 'Demo skill')
  assert.ok(skills['demo-skill'].descriptionZh)
  assert.ok(skills['demo-skill'].category)
  assert.ok(skills['demo-skill'].tags.length > 0)
  assert.equal(skills['demo-skill'].scope, 'project')

  const registry = scanAndWriteRegistry(options)
  assert.equal(registry.tools['demo-tool'].label, 'Demo Tool')
  assert.equal(registry.skills['demo-skill'].enabled, true)
})

test('Skill 启停会持久化并拒绝未知名称', (t) => {
  const root = fixture(t)
  const skillDir = path.join(root, '.codex', 'skills', 'demo-skill')
  fs.mkdirSync(skillDir, { recursive: true })
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '---\nname: demo-skill\n---\n')
  const options = { projectRoot: root, includePackage: false, includeGlobal: false }

  scanAndWriteRegistry(options)
  setSkillEnabled('demo-skill', false, options)
  assert.equal(readPluginRegistry(options).skills['demo-skill'].enabled, false)
  const used = recordSkillUsage('demo-skill', options)
  assert.equal(used.skill.usageCount, 1)
  assert.ok(used.skill.lastUsedAt)
  assert.equal(readPluginRegistry(options).skills['demo-skill'].usageCount, 1)
  assert.throws(() => setSkillEnabled('missing-skill', true, options), /未知 Skill/)
})

test('内置工具 manifest 名称与目录职责一致', () => {
  const tools = scanToolPlugins({ includeGlobal: false })
  for (const name of ['rg', 'semble', 'codebase-memory-mcp', 'project-architecture-docs', 'package-scripts', 'codex-adapter', 'claude-adapter', 'roo-adapter', 'askhuman']) {
    assert.ok(tools[name], `missing ${name}`)
  }
})

test('--project setup 会在目标项目扫描并生成 Skill 状态', (t) => {
  const root = fixture(t)
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'target-project', scripts: { test: 'node --test' } }))
  const bin = fileURLToPath(new URL('../bin/ai-toolops.js', import.meta.url))
  const result = spawnSync(process.execPath, [bin, 'setup', '--project', root], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr || result.stdout)
  const registry = JSON.parse(fs.readFileSync(path.join(root, '.ai-toolops', 'plugin-registry.json'), 'utf8'))
  const state = JSON.parse(fs.readFileSync(path.join(root, '.ai-toolops', 'skills.json'), 'utf8'))
  assert.ok(registry.tools.rg)
  assert.ok(Object.keys(registry.skills).length > 0)
  assert.ok(Object.keys(state.skills).length > 0)
})

test('扫描 Codex/JSON MCP 配置并按别名识别工具', (t) => {
  const root = fixture(t)
  const home = path.join(root, 'home')
  const project = path.join(root, 'project')
  fs.mkdirSync(path.join(home, '.codex'), { recursive: true })
  fs.mkdirSync(project, { recursive: true })
  fs.writeFileSync(path.join(home, '.codex', 'config.toml'), '[mcp_servers.codebase_memory]\ncommand = "codebase-memory-mcp"\n')
  fs.writeFileSync(path.join(project, '.mcp.json'), JSON.stringify({ mcpServers: { semble: { command: 'semble' } } }))

  const scan = scanMcpServers({ projectRoot: project, homeDir: home, appData: path.join(home, 'appdata') })
  assert.ok(findConfiguredMcp(scan, ['codebase-memory-mcp', 'codebase_memory']))
  assert.ok(findConfiguredMcp(scan, ['semble']))
  const detected = detectToolInstalled({ detection: { commands: [], files: [], mcpServers: ['codebase_memory'] } }, { mcpScan: scan })
  assert.equal(detected.status, 'installed')
  assert.equal(detected.detectedBy, 'mcp_config')
})
