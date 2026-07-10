import path from 'node:path'
import { cwdPath, ensureDir, readJson, writeText } from '../utils.js'
import { normalizeEquipment } from '../core/equipmentModel.js'
import { WORKFLOW_STAGES } from '../core/workflow.js'
import { readPluginRegistry } from '../plugin/scanner.js'

export function generateUi() {
  const outDir = cwdPath('.ai-toolops', 'ui')
  ensureDir(outDir)
  const equipment = normalizeEquipment(readJson(cwdPath('.ai-toolops', 'equipment.json'), { slots: {} }))
  const profile = readJson(cwdPath('.ai-toolops', 'project.profile.json'), {})
  const health = readJson(cwdPath('.ai-toolops', 'health-report.json'), { summary: {}, checks: [] })
  const registry = readJson(cwdPath('.ai-toolops', 'tool-registry.json'), { tools: {} })
  const capabilities = readJson(cwdPath('.ai-toolops', 'capabilities.json'), { capabilities: {} })
  const adapters = readJson(cwdPath('.ai-toolops', 'adapters.json'), { adapters: {} })
  const pluginRegistry = readPluginRegistry()
  writeText(path.join(outDir, 'data.json'), JSON.stringify({
    equipment, profile, health, registry, capabilities, adapters,
    plugins: pluginRegistry,
    workflowStages: WORKFLOW_STAGES
  }, null, 2))
  writeText(path.join(outDir, 'index.html'), html())
  writeText(path.join(outDir, 'styles.css'), css())
  writeText(path.join(outDir, 'app.js'), js())
  return outDir
}

function html() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>AI ToolOps</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&family=Fira+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="./styles.css" />
</head>
<body data-theme="night">
  <main class="shell">
    <!-- Hero -->
    <header class="hero">
      <div class="hero-copy">
        <p class="eyebrow">AI ToolOps Manager</p>
        <h1 id="projectName">装备栏</h1>
        <p id="projectMeta" class="muted"></p>
      </div>
      <div class="hero-side">
        <div class="theme-toggle" aria-label="主题模式">
          <button type="button" data-theme-choice="day">☀</button>
          <button type="button" data-theme-choice="night">☾</button>
        </div>
        <div class="health" id="healthBox"></div>
      </div>
    </header>

    <!-- Tabs -->
    <nav class="tabs" id="mainTabs">
      <button class="tab active" data-tab="equipment">装备</button>
      <button class="tab" data-tab="skills">Skills</button>
      <button class="tab" data-tab="plugins">插件</button>
      <button class="tab" data-tab="doctor">诊断</button>
    </nav>

    <!-- Doctor -->
    <section class="panel tab-panel" id="doctorPanel">
      <div class="section-head">
        <div>
          <p class="eyebrow">Doctor</p>
          <h2>健康检查</h2>
          <p class="muted compact">默认折叠，排查时展开明细。</p>
        </div>
        <button id="toggleDoctorBtn" class="ghost-button" type="button">展开</button>
      </div>
      <div id="doctorSummary" class="doctor-summary"></div>
      <div id="doctorBody" class="doctor-body collapsed">
        <div id="checksList" class="checks-table"></div>
      </div>
    </section>

    <!-- Equipment -->
    <section class="panel tab-panel active" id="equipmentPanel">
      <div class="section-head equipment-head">
        <div>
          <p class="eyebrow">Workflow Equipment</p>
          <div class="title-row">
            <h2>装备配置</h2>
            <button id="globalAddToolBtn" class="circle-button" title="生成新增工具提示词">+</button>
          </div>
        </div>
        <div class="equipment-controls">
          <div class="columns-control" aria-label="每行卡片数量">
            <span>排布</span>
            <button data-cols="1">1</button>
            <button data-cols="2">2</button>
            <button data-cols="3" class="active">3</button>
            <button data-cols="4">4</button>
          </div>
        </div>
      </div>
      <div class="strategy-strip">
        <strong>检索策略：</strong>目标明确直接读文件；入口/影响面不明时先用语义搜索，无结果再用精确搜索。
      </div>
      <div id="adapterStrip" class="adapter-strip"></div>
      <div id="equipmentGroups" class="equipment-groups"></div>
      <div id="emptyEquipment" class="empty hidden">暂无装备。请运行 <code>ai-toolops doctor</code>。</div>
    </section>

    <!-- Skills -->
    <section class="panel tab-panel" id="skillsPanel">
      <div class="section-head">
        <div><p class="eyebrow">Skills</p><h2>已安装 Skill</h2></div>
      </div>
      <div id="skillsList"></div>
      <div id="emptySkills" class="empty">暂无 Skill。可通过 <code>plugins/skills/</code> 目录添加。</div>
    </section>

    <!-- Plugins -->
    <section class="panel tab-panel" id="pluginsPanel">
      <div class="section-head">
        <div><p class="eyebrow">Plugins</p><h2>插件市场</h2></div>
        <button id="scanPluginsBtn" class="ghost-button">重新扫描</button>
      </div>
      <div id="pluginToolsList"></div>
    </section>

    <!-- Prompt -->
    <section class="panel hidden" id="promptPanel">
      <div class="section-head">
        <div><p class="eyebrow">Prompt</p><h2>安装接入提示词</h2></div>
        <button id="copyPromptBtn" class="ghost-button">复制</button>
      </div>
      <textarea id="promptText" readonly></textarea>
    </section>

    <footer class="footer">
      <p class="muted">AI ToolOps Manager · 本地优先 · 不默认上传</p>
    </footer>
  </main>
  <script src="./app.js"></script>
</body>
</html>`
}

function css() {
  return `/* AI ToolOps UI v2 — 基于 ui-ux-pro-max 设计系统 */
:root {
  color-scheme: dark;
  --font-heading: 'Fira Code', 'SF Mono', 'Cascadia Code', monospace;
  --font-body: 'Fira Sans', system-ui, -apple-system, 'Microsoft YaHei', sans-serif;
  --color-primary: #1E293B;
  --color-on-primary: #FFFFFF;
  --color-secondary: #334155;
  --color-accent: #22C55E;
  --color-background: #0F172A;
  --color-foreground: #F8FAFC;
  --color-muted-bg: #272F42;
  --color-border: #475569;
  --color-destructive: #EF4444;
  --color-ring: #22C55E;
  --ok: #22C55E;
  --ok-bg: rgba(34, 197, 94, 0.12);
  --warn: #EAB308;
  --warn-bg: rgba(234, 179, 8, 0.12);
  --err: #EF4444;
  --err-bg: rgba(239, 68, 68, 0.12);
  --info: #3B82F6;
  --info-bg: rgba(59, 130, 246, 0.12);
  --radius: 16px;
  --equipment-columns: 3;
  --shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  --glow: 0 0 20px rgba(34, 197, 94, 0.08);
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  margin: 0;
  background: var(--color-background);
  color: var(--color-foreground);
  font-family: var(--font-body);
  font-size: 14px;
  line-height: 1.6;
}

.shell {
  max-width: min(2240px, calc(100vw - 32px));
  margin: 0 auto;
  padding: 20px 16px 48px;
}

/* Hero */
.hero {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}
.hero-copy { min-width: 0; }
.hero-side { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.eyebrow { color: var(--color-accent); text-transform: uppercase; letter-spacing: 0.12em; font-size: 10px; font-weight: 700; margin-bottom: 4px; font-family: var(--font-heading); }
h1 { font-family: var(--font-heading); font-size: 24px; color: var(--color-foreground); margin: 0; }
.muted { color: #94A3B8; font-size: 13px; }

/* Tabs */
.tabs {
  display: flex;
  gap: 4px;
  margin: 16px 0 0;
  background: var(--color-muted-bg);
  border-radius: var(--radius);
  padding: 4px;
  border: 1px solid var(--color-border);
}
.tab {
  flex: 1;
  padding: 8px 16px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: #94A3B8;
  font-family: var(--font-heading);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}
.tab:hover { color: var(--color-foreground); background: rgba(255,255,255,0.05); }
.tab.active { background: var(--color-primary); color: var(--color-foreground); box-shadow: var(--glow); }

/* Panels */
.panel {
  margin-top: 16px;
  padding: 16px 20px;
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  backdrop-filter: blur(8px);
}
.tab-panel { display: none; }
.tab-panel.active { display: block; }
.section-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; margin-bottom: 12px; }
.title-row { display: inline-flex; align-items: center; gap: 10px; }
h2 { font-family: var(--font-heading); font-size: 16px; color: var(--color-foreground); margin: 0; }
.compact { margin-top: 4px; font-size: 12px; }

/* Buttons */
.circle-button {
  width: 30px; height: 30px;
  border-radius: 999px;
  border: 1px solid var(--color-accent);
  background: var(--ok-bg);
  color: var(--color-accent);
  font-size: 18px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}
.circle-button:hover { filter: brightness(1.1); transform: translateY(-1px); box-shadow: var(--glow); }
.ghost-button {
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-muted-bg);
  color: var(--color-foreground);
  height: 30px;
  padding: 0 12px;
  cursor: pointer;
  font-family: var(--font-body);
  font-size: 13px;
  font-weight: 600;
  transition: all 0.15s ease;
}
.ghost-button:hover { border-color: var(--color-accent); }

/* Health */
.health { min-width: 200px; padding: 10px; border-radius: 12px; background: rgba(0,0,0,0.2); border: 1px solid var(--color-border); }
.health-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 6px; }
.health-chip { border-radius: 10px; padding: 6px; text-align: center; background: rgba(255,255,255,0.03); }
.health-chip strong { display: block; font-size: 16px; font-family: var(--font-heading); }
.health-chip span { font-size: 11px; color: #94A3B8; }
.status-mini { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
.status-mini span { border: 1px solid var(--color-border); border-radius: 999px; padding: 2px 8px; font-size: 11px; background: rgba(0,0,0,0.1); }

/* Doctor Summary */
.doctor-summary { display: flex; gap: 8px; flex-wrap: wrap; }
.summary-pill { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--color-border); background: var(--color-muted-bg); border-radius: 999px; padding: 6px 10px; font-size: 12px; }
.summary-pill strong { font-size: 14px; font-family: var(--font-heading); }
.doctor-body { overflow: hidden; transition: max-height 0.22s ease, opacity 0.2s ease; margin-top: 12px; }
.doctor-body.collapsed { display: none; }
.checks-table { display: grid; gap: 6px; }
.check-row { display: grid; grid-template-columns: 70px 1fr; gap: 8px; align-items: start; border: 1px solid var(--color-border); border-radius: 12px; padding: 8px 10px; background: rgba(0,0,0,0.1); }
.check-row .level { font-family: var(--font-heading); font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
.check-row p { margin: 0; font-size: 13px; }
.check-row.error { border-color: rgba(239,68,68,0.35); background: var(--err-bg); }
.check-row.warning { border-color: rgba(234,179,8,0.35); background: var(--warn-bg); }
.check-row.info { border-color: rgba(59,130,246,0.28); background: var(--info-bg); }

/* Equipment */
.equipment-head { align-items: flex-start; }
.equipment-controls { display: flex; align-items: center; gap: 8px; }
.columns-control { display: inline-flex; align-items: center; gap: 4px; border: 1px solid var(--color-border); border-radius: 999px; padding: 4px; background: var(--color-muted-bg); }
.columns-control span { color: #94A3B8; font-size: 12px; padding: 0 4px; }
.columns-control button { width: 26px; height: 24px; border-radius: 999px; border: 1px solid transparent; background: transparent; color: #94A3B8; cursor: pointer; font-weight: 600; font-size: 12px; }
.columns-control button.active { background: var(--color-accent); border-color: var(--color-accent); color: #fff; }

.strategy-strip {
  border: 1px solid rgba(59,130,246,0.32);
  background: var(--info-bg);
  border-radius: 12px;
  padding: 10px 12px;
  margin-bottom: 14px;
  font-size: 13px;
  line-height: 1.6;
}

.adapter-strip { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
.adapter-pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border: 1px solid var(--color-border); border-radius: 999px; background: var(--color-muted-bg); font-size: 12px; }
.adapter-pill strong { font-family: var(--font-heading); }

.equipment-groups { display: grid; gap: 20px; }

/* Workflow Group */
.workflow-group {
  display: grid;
  grid-template-columns: minmax(180px, 240px) 1fr;
  gap: 14px;
  border-top: 1px solid var(--color-border);
  padding-top: 16px;
}
.workflow-rail {
  border: 1px solid var(--color-border);
  border-radius: 14px;
  background: var(--color-muted-bg);
  padding: 12px;
  min-height: 120px;
}
.workflow-index {
  width: 28px; height: 28px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--color-accent);
  color: #fff;
  font-family: var(--font-heading);
  font-weight: 700;
  font-size: 13px;
}
.workflow-rail h3 { margin: 10px 0 4px; font-family: var(--font-heading); font-size: 15px; color: var(--color-foreground); }
.workflow-rail p { margin: 0; color: #94A3B8; font-size: 12px; line-height: 1.5; }
.workflow-grid { display: grid; grid-template-columns: repeat(var(--equipment-columns), minmax(0, 1fr)); gap: 12px; }

/* Card */
.card {
  border: 1px solid var(--color-border);
  border-radius: 14px;
  background: rgba(15, 23, 42, 0.8);
  padding: 14px;
  min-height: 260px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: all 0.15s ease;
}
.card:hover { border-color: var(--color-accent); box-shadow: var(--glow); }
.card.disabled { opacity: 0.6; }
.card.external_tool { border-left: 3px solid #94A3B8; }
.card.project_builtin { border-left: 3px solid var(--info); }
.card.agent_adapter { border-left: 3px solid #A855F7; }
.card.interaction_tool { border-left: 3px solid #FB923C; }
.card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.card h4 { font-family: var(--font-heading); font-size: 15px; color: var(--color-foreground); margin: 0 0 2px; }
.slot-key { color: #64748B; font-size: 11px; font-family: var(--font-heading); }
.meta-line { color: #94A3B8; font-size: 12px; line-height: 1.4; }
.condition-line { color: var(--color-foreground); font-size: 12px; line-height: 1.5; background: rgba(0,0,0,0.2); border: 1px solid var(--color-border); border-radius: 10px; padding: 8px; }
.condition-line strong { color: var(--color-accent); }
.tool-summary { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.tool-summary strong { font-size: 12px; font-family: var(--font-heading); color: var(--color-foreground); }
.badges { display: flex; gap: 4px; flex-wrap: wrap; }

.badge {
  font-size: 11px;
  color: var(--color-foreground);
  background: var(--color-muted-bg);
  border: 1px solid var(--color-border);
  padding: 2px 8px;
  border-radius: 999px;
  white-space: nowrap;
}
.badge.ok { color: var(--ok); background: var(--ok-bg); border-color: rgba(34,197,94,0.35); }
.badge.warning { color: var(--warn); background: var(--warn-bg); border-color: rgba(234,179,8,0.35); }
.badge.error { color: var(--err); background: var(--err-bg); border-color: rgba(239,68,68,0.35); }
.badge.info { color: var(--info); background: var(--info-bg); border-color: rgba(59,130,246,0.35); }
.badge.disabled { color: #64748B; background: rgba(100,116,139,0.12); border-color: rgba(100,116,139,0.28); }

/* Switch */
.switch { position: relative; display: inline-flex; width: 40px; height: 22px; align-items: center; flex-shrink: 0; }
.switch input { opacity: 0; width: 0; height: 0; }
.slider { position: absolute; cursor: pointer; inset: 0; background: #64748B; border: 1px solid rgba(148,163,184,0.5); border-radius: 999px; transition: 0.15s ease; }
.slider:before { content: ""; position: absolute; height: 16px; width: 16px; left: 2px; top: 2px; background: #fff; border-radius: 50%; transition: 0.15s ease; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
.switch input:checked + .slider { background: var(--color-accent); border-color: var(--color-accent); }
.switch input:checked + .slider:before { transform: translateX(18px); }

/* Tool List */
.tool-list { display: grid; gap: 6px; padding: 0; margin: 4px 0 0; list-style: none; }
.tool-item {
  display: grid;
  grid-template-columns: 18px 20px 1fr auto;
  gap: 6px;
  align-items: center;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: rgba(0,0,0,0.2);
  padding: 7px 8px;
  cursor: grab;
  transition: all 0.1s ease;
}
.tool-item:hover { border-color: var(--color-accent); }
.tool-item:active { cursor: grabbing; }
.tool-item.primary { border-color: rgba(34,197,94,0.5); box-shadow: 0 0 0 1px rgba(34,197,94,0.14); }
.tool-item.dragging { opacity: 0.5; }
.drag-handle { color: #64748B; font-size: 14px; user-select: none; cursor: grab; }
.order { width: 20px; height: 20px; border-radius: 999px; background: var(--color-muted-bg); display: inline-flex; align-items: center; justify-content: center; color: #94A3B8; font-size: 10px; font-weight: 700; }
.tool-name { font-weight: 600; color: var(--color-foreground); overflow: hidden; text-overflow: ellipsis; font-size: 13px; }
.tool-status { display: inline-flex; gap: 4px; align-items: center; flex-wrap: wrap; justify-content: flex-end; }
.add-tool { display: flex; gap: 6px; margin-top: auto; }
.add-tool input { min-width: 0; flex: 1; border: 1px solid var(--color-border); border-radius: 10px; background: rgba(0,0,0,0.2); color: var(--color-foreground); padding: 7px 8px; font-size: 13px; }
.add-tool input:focus { outline: none; border-color: var(--color-accent); }
.add-button { width: 34px; border-radius: 10px; border: 1px solid var(--color-accent); background: var(--ok-bg); color: var(--color-accent); font-size: 18px; cursor: pointer; transition: all 0.15s ease; }
.add-button:hover { filter: brightness(1.1); }

/* Skills */
#skillsList { display: grid; gap: 12px; }
.skill-card {
  border: 1px solid var(--color-border);
  border-radius: 14px;
  background: rgba(15, 23, 42, 0.8);
  padding: 14px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.skill-card-left { flex: 1; }
.skill-card-left h4 { font-family: var(--font-heading); font-size: 14px; margin: 0 0 4px; }
.skill-card-left p { color: #94A3B8; font-size: 12px; margin: 0; line-height: 1.5; }

/* Plugins */
#pluginToolsList { display: grid; gap: 8px; }
.plugin-item {
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 10px 14px;
  background: rgba(0,0,0,0.1);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.plugin-item .plugin-info { flex: 1; }
.plugin-item .plugin-name { font-family: var(--font-heading); font-weight: 600; font-size: 13px; }
.plugin-item .plugin-desc { color: #94A3B8; font-size: 12px; }

/* Common */
.empty { border: 1px dashed var(--color-border); border-radius: 12px; color: #94A3B8; padding: 16px; background: rgba(0,0,0,0.1); text-align: center; }
.hidden { display: none !important; }
textarea { width: 100%; min-height: 200px; background: rgba(0,0,0,0.2); border: 1px solid var(--color-border); border-radius: 12px; color: var(--color-foreground); padding: 12px; font-family: var(--font-heading); font-size: 13px; line-height: 1.6; }

/* Footer */
.footer { text-align: center; padding: 24px 0 8px; }
.footer p { font-size: 12px; }

/* Responsive */
@media (max-width: 1100px) {
  .workflow-group { grid-template-columns: 1fr; }
  .workflow-grid { grid-template-columns: repeat(min(var(--equipment-columns), 2), minmax(0, 1fr)); }
  .hero { flex-direction: column; align-items: flex-start; }
  .section-head { flex-direction: column; }
}
@media (max-width: 760px) {
  .shell { max-width: 100%; padding: 12px 8px 24px; }
  .workflow-grid { grid-template-columns: 1fr; }
  .tool-item { grid-template-columns: 18px 20px 1fr; }
  .tool-status { grid-column: 3 / -1; justify-content: flex-start; }
  .panel { padding: 12px; }
  h1 { font-size: 20px; }
}
`
}

function js() {
  return `//
// AI ToolOps UI v2 — SPA
//
const escapeHtml = (v) => String(v ?? '').replaceAll('&','&').replaceAll('<','<').replaceAll('>','>').replaceAll('"','"');
const statusText = { installed:'已安装', project_provided:'项目内置', built_in:'内置适配', configured_not_installed:'未安装', recommended_not_installed:'推荐未安装', configured_unverified:'待验证', empty:'空', ok:'正常', optional:'可选', recommended:'推荐', missing:'缺失', disabled:'已关闭', unknown:'未知' };
const statusLevel = (s) => s==='installed'||s==='project_provided'||s==='built_in'||s==='ok'?'ok':['configured_not_installed','recommended_not_installed','missing','unknown'].includes(s)?'warning':s==='error'?'error':'info';
const unavailable = new Set(['recommended_not_installed','configured_not_installed','missing','unknown']);
const slotTypeText = { exclusive_priority:'互斥', additive:'叠加', project_context:'内置', internal_adapter:'内置适配' };
const categoryText = { external_tool:'外部工具', project_builtin:'项目内置', agent_adapter:'Agent 适配', interaction_tool:'人工确认' };
const fallbackStages = [
  { key:'agent_rules', label:'规则入口', desc:'同步 ToolOps 规则，统一 Agent 能力配置。' },
  { key:'prompt_intake', label:'需求理解', desc:'整理需求、约束和验收标准。' },
  { key:'project_context', label:'项目上下文', desc:'读取 README、架构文档和项目画像。' },
  { key:'project_retrieval', label:'项目检索', desc:'目标明确直接读文件；入口不明使用语义搜索。' },
  { key:'thinking_strategy', label:'思考策略', desc:'选择分析策略，控制 token 成本。' },
  { key:'planning', label:'列计划', desc:'拆解需求为阶段、文件范围及风险点。' },
  { key:'execution', label:'执行修改', desc:'按计划修改代码、配置或工具接入。' },
  { key:'validation', label:'验证', desc:'运行 lint、test、build 确认结果。' },
  { key:'feedback', label:'反馈', desc:'需要确认或风险选择时使用人工通道。' }
];
const slotStage = { agent_compatibility:'agent_rules', architecture_context:'project_context', exact_search:'project_retrieval', semantic_search:'project_retrieval', code_graph:'project_retrieval', build_validation:'validation', human_confirmation:'feedback' };
const getTools = (s) => [...new Set([...(Array.isArray(s.tools)?s.tools:[]), s.active].filter(Boolean))];
const isPriority = (s) => (s.slotType||'exclusive_priority') === 'exclusive_priority';
const stageFor = (k, s) => s.workflowStage || slotStage[k] || 'execution';

// Load data then render
fetch('./data.json').then(r=>r.json()).then(data => {
  const { equipment, profile, health, registry, capabilities, plugins, workflowStages } = data;
  document.getElementById('projectName').textContent = profile.name || '项目';
  document.getElementById('projectMeta').textContent = [profile.packageManager, ...(profile.framework||[])].filter(Boolean).join(' · ');
  renderHealth(health.summary||{});
  renderDoctorSummary(health);
  renderChecks(health);
  renderAdapters(data.adapters||{adapters:{}});
  renderEquipment({equipment,health,registry:registry||{tools:{}},capabilities:capabilities||{}}, workflowStages);
  renderSkills(plugins?.skills||{});
  renderPluginTools(plugins?.tools||{}, equipment, health);
  setupUI();
}).catch(err => {
  document.getElementById('equipmentGroups').innerHTML = '<div class="empty">加载失败: ' + escapeHtml(err.message) + '</div>';
});

function renderHealth(summary) {
  const counts = summary.statusCounts||{};
  document.getElementById('healthBox').innerHTML =
    '<div class="eyebrow">Health</div>' +
    '<div class="health-grid">' +
      '<div class="health-chip"><strong>'+(summary.errors||0)+'</strong><span>错误</span></div>' +
      '<div class="health-chip"><strong>'+(summary.warnings||0)+'</strong><span>警告</span></div>' +
      '<div class="health-chip"><strong>'+(summary.info||0)+'</strong><span>提示</span></div>' +
    '</div>' +
    '<div class="status-mini"><span>已安装 '+(counts.installed||0)+'</span><span>项目内置 '+(counts.project_provided||0)+'</span><span>推荐 '+(counts.recommended_not_installed||0)+'</span></div>';
}

function renderDoctorSummary(health) {
  const s = health.summary||{};
  const c = health.checks||[];
  const bl = c.reduce((a,i)=>{const k=i.level||'info'; a[k]=(a[k]||0)+1; return a},{});
  document.getElementById('doctorSummary').innerHTML =
    '<span class="summary-pill"><strong>'+(s.errors||bl.error||0)+'</strong>错误</span>' +
    '<span class="summary-pill"><strong>'+(s.warnings||bl.warning||0)+'</strong>警告</span>' +
    '<span class="summary-pill"><strong>'+(s.info||bl.info||0)+'</strong>提示</span>' +
    '<span class="summary-pill"><strong>'+c.length+'</strong>检查项</span>';
}

function renderChecks(health) {
  const root = document.getElementById('checksList');
  const checks = (health.checks||[]).slice(0,80);
  root.textContent = '';
  if (!checks.length) { root.innerHTML = '<div class="empty">暂无检查结果。</div>'; return; }
  checks.forEach(i => {
    const row = document.createElement('div');
    row.className = 'check-row ' + escapeHtml(i.level||'info');
    row.innerHTML = '<div class="level">'+escapeHtml(i.level||'')+'</div><p>'+escapeHtml(i.message||'')+'</p>';
    root.appendChild(row);
  });
}

function renderAdapters(adapters) {
  const items = Object.values(adapters.adapters||{});
  const root = document.getElementById('adapterStrip');
  if (!items.length) { root.innerHTML = ''; return; }
  root.innerHTML = items.map(a =>
    '<span class="adapter-pill"><strong>'+escapeHtml(a.label||a.id)+
    '</strong><span class="badge '+(a.enabled===false?'disabled':'ok')+'">'+
    escapeHtml(a.enabled===false?'关闭':'启用')+'</span></span>'
  ).join('');
}

function renderEquipment({equipment,health,registry,capabilities}, workflowStages) {
  const root = document.getElementById('equipmentGroups');
  const empty = document.getElementById('emptyEquipment');
  const statuses = new Map();
  (health.slots||[]).forEach(s => (s.tools||[]).forEach(t => { if(s.slot&&t.tool&&t.status) statuses.set(s.slot+'::'+t.tool, t.status); }));
  (health.checks||[]).forEach(i => { if(i.slot&&i.tool&&i.status&&!statuses.has(i.slot+'::'+i.tool)) statuses.set(i.slot+'::'+i.tool,i.status); });
  const stages = (workflowStages&&workflowStages.length ? workflowStages : fallbackStages).map(s=>({...s,items:[]}));
  const stageMap = new Map(stages.map(s=>[s.key,s]));
  let visible = 0;
  Object.entries(equipment.slots||{}).forEach(([key,slot]) => {
    const tools = getTools(slot);
    if (!tools.length) return;
    const sk = stageFor(key, slot);
    if (!stageMap.has(sk)) stageMap.set(sk, {key:sk,label:sk,desc:'',items:[]});
    stageMap.get(sk).items.push({key,slot,tools});
    visible++;
  });
  root.textContent = '';
  [...stageMap.values()].forEach((stage, si) => {
    if (!stage.items.length) return;
    const sec = document.createElement('section');
    sec.className = 'workflow-group';
    sec.innerHTML =
      '<div class="workflow-rail"><span class="workflow-index">'+(si+1)+
      '</span><h3>'+escapeHtml(stage.label)+
      '</h3><p>'+escapeHtml(stage.desc||'')+'</p></div><div class="workflow-grid"></div>';
    const grid = sec.querySelector('.workflow-grid');
    stage.items.sort((a,b) => (a.slot.relationGroup||'').localeCompare(b.slot.relationGroup||''));
    stage.items.forEach(({key,slot,tools}) => {
      const enabled = slot.enabled !== false;
      const priority = isPriority(slot);
      const slotStatuses = tools.map(t => statuses.get(key+'::'+t)||'configured_unverified');
      const allUnavail = slotStatuses.length && slotStatuses.every(s => unavailable.has(s));
      const summary = !enabled ? '已关闭' : allUnavail ? '不可用' : priority ? tools[0] : '全部启用';
      const cat = slot.category||'external_tool';
      const card = document.createElement('article');
      card.className = 'card '+cat+(enabled?'':' disabled')+(allUnavail?'':'');
      const cond = conditionText(key,slot,tools,registry);
      card.innerHTML =
        '<div class="card-top"><div><h4>'+escapeHtml(slot.label)+'</h4><div class="slot-key">'+escapeHtml(key)+'</div></div>' +
        '<label class="switch"><input type="checkbox" '+(enabled?'checked':'')+' data-slot="'+escapeHtml(key)+'"><span class="slider"></span></label></div>' +
        '<div class="tool-summary"><strong>'+(allUnavail?'状态：':priority?'生效：':'启用：')+'</strong><span class="badge '+(!enabled?'disabled':allUnavail?'warning':'ok')+'">'+escapeHtml(summary)+'</span></div>' +
        '<div class="meta-line">Fallback：'+escapeHtml((slot.fallback||[]).join(', ')||'无')+'</div>' +
        (cond?'<div class="condition-line"><strong>条件：</strong>'+escapeHtml(cond)+'</div>':'') +
        '<div class="badges">' +
          '<span class="badge">'+escapeHtml(slot.loadLevel||'-')+'</span>' +
          '<span class="badge info">'+escapeHtml(slotTypeText[slot.slotType]||slot.slotType||'')+'</span>' +
          '<span class="badge">'+escapeHtml(categoryText[cat]||cat)+'</span>' +
          '<span class="badge '+(enabled?'ok':'disabled')+'">'+escapeHtml(enabled?'启用':'关闭')+'</span>' +
        '</div>' +
        '<ul class="tool-list" data-tool-list="'+escapeHtml(key)+'"></ul>' +
        '<div class="add-tool">' +
          '<input data-add-input="'+escapeHtml(key)+'" placeholder="'+(slot.recommendedTool||'输入工具名')+'" />' +
          '<button class="add-button" data-add-slot="'+escapeHtml(key)+'">+</button>' +
        '</div>';
      const list = card.querySelector('[data-tool-list]');
      tools.forEach((tn, idx) => {
        const st = statuses.get(key+'::'+tn)||'configured_unverified';
        const li = document.createElement('li');
        li.className = 'tool-item'+(priority&&idx===0&&enabled&&!unavailable.has(st)?' primary':'');
        li.draggable = true;
        li.dataset.tool = tn; li.dataset.slot = key; li.dataset.status = st;
        li.innerHTML = '<span class="drag-handle">⋮⋮</span><span class="order">'+(idx+1)+
          '</span><span class="tool-name">'+escapeHtml(tn)+'</span>' +
          '<span class="tool-status"><span class="badge '+statusLevel(st)+'">'+escapeHtml(statusText[st]||st)+
          '</span><span class="badge primary-badge '+(!enabled?'disabled':priority&&idx===0&&!unavailable.has(st)?'ok':'info')+'">'+
          escapeHtml(!enabled?'关闭':priority?(idx===0?'生效':'备用'):'启用')+'</span></span>';
        list.appendChild(li);
      });
      grid.appendChild(card);
    });
    root.appendChild(sec);
  });
  empty.classList.toggle('hidden', visible>0);
  bindEquipmentEvents(root, equipment, registry);
}

function conditionText(key,slot,tools,registry) {
  if (key==='semantic_search') return '入口/调用链不明确时优先，无结果再用精确搜索兜底。';
  if (key==='exact_search') return '目标明确、需路径校验时使用。';
  if (key==='human_confirmation') return '关键范围/接口契约/高风险操作或结束反馈时使用。';
  const t = tools[0]; const u = registry.tools?.[t]?.useWhen||[];
  return u.length ? u.slice(0,2).join(' / ') : '';
}

function renderSkills(skills) {
  const root = document.getElementById('skillsList');
  const empty = document.getElementById('emptySkills');
  const items = Object.values(skills).filter(s=>s.enabled!==false);
  root.textContent = '';
  if (!items.length) { empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');
  items.forEach(s => {
    const card = document.createElement('div');
    card.className = 'skill-card';
    card.innerHTML =
      '<div class="skill-card-left"><h4>'+escapeHtml(s.label||s.name)+'</h4>' +
      '<p>'+escapeHtml(s.description||'')+'</p></div>' +
      '<label class="switch"><input type="checkbox" checked disabled><span class="slider"></span></label>';
    root.appendChild(card);
  });
}

function renderPluginTools(tools, equipment, health) {
  const root = document.getElementById('pluginToolsList');
  root.textContent = '';
  Object.entries(tools).forEach(([name, tool]) => {
    const slot = Object.entries(equipment.slots||{}).find(([k,s]) => getTools(s).includes(name));
    const item = document.createElement('div');
    item.className = 'plugin-item';
    item.innerHTML =
      '<div class="plugin-info"><span class="plugin-name">'+escapeHtml(tool.label||name)+
      '</span><span class="plugin-desc"> — '+escapeHtml(name)+
      (slot?' <span class="badge ok">已装备</span>':'')+'</span></div>' +
      '<span class="badge '+(tool.capabilities?.length?'info':'disabled')+'">'+escapeHtml((tool.capabilities||[]).join(', '))+'</span>';
    root.appendChild(item);
  });
}

function bindEquipmentEvents(root, equipment, registry) {
  root.querySelectorAll('input[type="checkbox"][data-slot]').forEach(input => {
    input.addEventListener('change', async e => {
      const slot = e.target.dataset.slot;
      const enabled = e.target.checked;
      const card = e.target.closest('.card');
      const list = card.querySelector('[data-tool-list]');
      try {
        const res = await fetch('/api/toggle', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({slot,enabled})});
        if (!res.ok) throw new Error(await res.text());
        card.classList.toggle('disabled', !enabled);
        updateBadges(list, enabled, isPriority(equipment.slots?.[slot]||{}));
      } catch { e.target.checked = !enabled; alert('切换失败'); }
    });
  });
  root.querySelectorAll('.tool-list').forEach(list => {
    let dragged = null;
    list.addEventListener('dragstart', e => {
      const item = e.target.closest('.tool-item');
      if (!item) return; dragged = item; item.classList.add('dragging');
    });
    list.addEventListener('dragend', () => { if(dragged) { dragged.classList.remove('dragging'); dragged=null; } });
    list.addEventListener('dragover', e => {
      e.preventDefault();
      const t = e.target.closest('.tool-item');
      if (!dragged||!t||t===dragged||t.parentElement!==list) return;
      const rect = t.getBoundingClientRect();
      list.insertBefore(dragged, e.clientY < rect.top+rect.height/2 ? t : t.nextSibling);
    });
    list.addEventListener('drop', async e => {
      e.preventDefault();
      const sk = list.dataset.toolList;
      const ordered = [...list.querySelectorAll('.tool-item')].map(i => i.dataset.tool);
      const enabled = list.closest('.card').querySelector('input[type="checkbox"]').checked;
      try {
        const res = await fetch('/api/reorder-tools', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({slot:sk,tools:ordered})});
        if (!res.ok) throw new Error(await res.text());
        updateBadges(list, enabled, isPriority(equipment.slots?.[sk]||{}));
      } catch { alert('排序保存失败'); }
    });
  });
  root.querySelectorAll('[data-add-slot]').forEach(btn => {
    btn.addEventListener('click', () => {
      const sk = btn.dataset.addSlot;
      const slot = equipment.slots?.[sk]||{};
      const input = root.querySelector('[data-add-input="'+CSS.escape(sk)+'"]');
      const fallback = input?.placeholder || slot.recommendedTool || getTools(slot)[0] || '';
      const toolName = (input?.value||'').trim() || fallback;
      const hint = registry.tools?.[toolName]?.installHint || '请按官方方式安装。';
      showPrompt(buildPrompt({slotKey:sk,slot,toolName,hint}));
    });
  });
}

function updateBadges(list, enabled, priority) {
  const items = [...list.querySelectorAll('.tool-item')];
  items.forEach((item, i) => {
    const st = item.dataset.status;
    const prim = priority && i===0 && enabled && !unavailable.has(st);
    item.classList.toggle('primary', prim);
    item.querySelector('.order').textContent = String(i+1);
    const badge = item.querySelector('.primary-badge');
    badge.textContent = !enabled ? '关闭' : priority ? (i===0?'生效':'备用') : '启用';
    badge.className = 'badge primary-badge ' + (!enabled?'disabled':prim?'ok':'info');
  });
}

function buildPrompt({slotKey,slot,toolName,hint}) {
  return [
    '请在项目中安装并接入 AI ToolOps 的【'+(slot.label||slotKey)+'】工具：'+toolName+'。','',
    '要求：','1. 按官方方式安装：'+hint,
    '2. 不要直接手改 .ai-toolops/*.json。',
    '3. 安装完成后通过命令接入：','',
    'ai-toolops register-tool '+slotKey+' '+toolName+' --label "'+toolName+'"',
    'ai-toolops equip '+slotKey+' '+toolName,
    'ai-toolops toggle '+slotKey+' on',
    'ai-toolops doctor'
  ].join('\\n');
}

function showPrompt(text) {
  document.getElementById('promptPanel').classList.remove('hidden');
  document.getElementById('promptText').value = text;
  document.getElementById('promptPanel').scrollIntoView({behavior:'smooth',block:'start'});
}

function setupUI() {
  // Theme toggle
  const stored = localStorage.getItem('ai-toolops.theme');
  const applyTheme = (v) => {
    document.body.dataset.theme = v;
    localStorage.setItem('ai-toolops.theme', v);
  };
  applyTheme(stored || 'night');
  document.querySelectorAll('[data-theme-choice]').forEach(b => {
    b.addEventListener('click', () => applyTheme(b.dataset.themeChoice));
  });

  // Tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const panel = document.getElementById(tab.dataset.tab+'Panel');
      if (panel) panel.classList.add('active');
    });
  });

  // Doctor toggle
  const body = document.getElementById('doctorBody');
  const btn = document.getElementById('toggleDoctorBtn');
  btn.addEventListener('click', () => {
    body.classList.toggle('collapsed');
    btn.textContent = body.classList.contains('collapsed') ? '展开' : '收起';
  });

  // Columns control
  const colBtns = document.querySelectorAll('[data-cols]');
  colBtns.forEach(b => {
    b.addEventListener('click', () => {
      const cols = b.dataset.cols;
      document.documentElement.style.setProperty('--equipment-columns', cols);
      colBtns.forEach(c => c.classList.toggle('active', c.dataset.cols === cols));
      localStorage.setItem('ai-toolops.equipment.columns', cols);
    });
  });
  const savedCols = localStorage.getItem('ai-toolops.equipment.columns') || '3';
  document.documentElement.style.setProperty('--equipment-columns', savedCols);
  colBtns.forEach(c => c.classList.toggle('active', c.dataset.cols === savedCols));

  // Global add tool
  document.getElementById('globalAddToolBtn').addEventListener('click', () => {
    showPrompt('请在项目中安装或接入一个新的 AI 开发工具。\\n\\n要求：\\n1. 判断属于哪个流程阶段和能力槽位；优先复用已有槽位。\\n2. 没有合适槽位时使用 ai-toolops create-slot 创建。\\n3. 不要手改 .ai-toolops/*.json。\\n4. 通过 ai-toolops 命令完成接入。');
  });

  // Copy prompt
  document.getElementById('copyPromptBtn').addEventListener('click', async () => {
    const text = document.getElementById('promptText').value;
    await navigator.clipboard.writeText(text);
    document.getElementById('copyPromptBtn').textContent = '已复制';
    setTimeout(() => { document.getElementById('copyPromptBtn').textContent = '复制'; }, 1200);
  });

  // Scan plugins
  document.getElementById('scanPluginsBtn').addEventListener('click', () => {
    fetch('/api/plugin-scan', {method:'POST'}).then(r=>r.json()).then(() => location.reload()).catch(() => alert('扫描失败'));
  });
}`
}