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
          <button type="button" data-theme-choice="day" aria-label="切换到白天模式">☀</button>
          <button type="button" data-theme-choice="night" aria-label="切换到夜晚模式">☾</button>
        </div>
        <div class="health" id="healthBox"></div>
      </div>
    </header>

    <!-- Tabs -->
    <nav class="tabs" id="mainTabs" role="tablist" aria-label="主要功能">
      <button class="tab active" data-tab="equipment" role="tab" aria-selected="true" aria-controls="equipmentPanel">装备</button>
      <button class="tab" data-tab="skills" role="tab" aria-selected="false" aria-controls="skillsPanel">Skill 库</button>
      <button class="tab" data-tab="plugins" role="tab" aria-selected="false" aria-controls="pluginsPanel">插件</button>
      <button class="tab" data-tab="doctor" role="tab" aria-selected="false" aria-controls="doctorPanel">诊断</button>
    </nav>

    <!-- Doctor -->
    <section class="panel tab-panel" id="doctorPanel" role="tabpanel">
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
    <section class="panel tab-panel active" id="equipmentPanel" role="tabpanel">
      <div class="section-head equipment-head">
        <div>
          <p class="eyebrow">Workflow Equipment</p>
          <div class="title-row">
            <h2>装备配置</h2>
            <button id="globalAddToolBtn" class="circle-button" title="生成新增工具提示词" aria-label="生成新增工具提示词">+</button>
          </div>
        </div>
        <div class="equipment-controls">
          <button id="refreshEquipmentBtn" class="ghost-button" type="button">刷新状态</button>
        </div>
      </div>
      <div class="governance-panel">
        <div id="equipmentOverview" class="overview-grid"></div>
        <div class="governance-controls">
          <label class="field-label">任务场景
            <select id="equipmentScenario">
              <option value="daily">日常开发</option>
              <option value="ui">界面与视觉</option>
              <option value="refactor">跨模块重构</option>
              <option value="docs">文档与办公</option>
              <option value="onboarding">接手新项目</option>
              <option value="all">全部能力</option>
            </select>
          </label>
          <button id="equipmentIssuesOnly" class="filter-button" type="button" aria-pressed="false">仅看需处理</button>
          <div class="columns-control" aria-label="每行卡片数量">
            <span>每行</span>
            <button data-cols="1">1</button>
            <button data-cols="2" class="active">2</button>
            <button data-cols="3">3</button>
          </div>
        </div>
        <p id="equipmentScenarioHint" class="scenario-hint"></p>
      </div>
      <div class="strategy-strip">
        <strong>治理原则：</strong>先按任务场景确认需要哪些能力；只有“已启用且可用”的工具才进入 Agent 策略，未安装或关闭项会明确提示下一步。
      </div>
      <div id="adapterStrip" class="adapter-strip"></div>
      <div id="equipmentGroups" class="equipment-groups"></div>
      <div id="emptyEquipment" class="empty hidden">暂无装备。请运行 <code>ai-toolops doctor</code>。</div>
    </section>

    <!-- Skills -->
    <section class="panel tab-panel" id="skillsPanel" role="tabpanel">
      <div class="section-head">
        <div><p class="eyebrow">Skills</p><h2>Skill 能力目录</h2><p class="muted compact">按使用场景组织，默认显示中文概览；使用记录由 Agent 或按钮上报。</p></div>
        <div class="head-actions">
          <button id="skillLocaleBtn" class="ghost-button" type="button" aria-pressed="true">查看英文原文</button>
          <button id="scanSkillsBtn" class="ghost-button" type="button">重新扫描</button>
        </div>
      </div>
      <div id="skillOverview" class="overview-grid skill-overview"></div>
      <div class="skill-toolbar">
        <label class="field-label skill-search">搜索 Skill
          <input id="skillSearchInput" type="search" placeholder="输入名称、中文说明或标签" autocomplete="off" />
        </label>
        <label class="field-label">使用场景
          <select id="skillCategoryFilter"><option value="all">全部场景</option></select>
        </label>
        <label class="field-label">排序
          <select id="skillSort">
            <option value="recommended">推荐顺序</option>
            <option value="recent">最近使用</option>
            <option value="usage">使用次数</option>
            <option value="name">名称</option>
          </select>
        </label>
        <button id="clearSkillFilters" class="filter-button" type="button">清空筛选</button>
      </div>
      <div class="tag-filter-panel">
        <div class="tag-filter-head"><strong>标签筛选</strong><span class="muted">可多选，按交集匹配</span></div>
        <div id="skillTagFilters" class="tag-filter-list"></div>
      </div>
      <div id="skillsList"></div>
      <div id="emptySkills" class="empty">暂无 Skill。可通过 <code>plugins/skills/</code> 目录添加。</div>
    </section>

    <!-- Plugins -->
    <section class="panel tab-panel" id="pluginsPanel" role="tabpanel">
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
    <div id="actionToast" class="action-toast" role="status" aria-live="polite" aria-atomic="true"></div>
  </main>
  <script src="./app.js"></script>
</body>
</html>`
}

function css() {
  return `/* AI ToolOps UI v2 — 基于 ui-ux-pro-max 设计系统 */
:root {
  color-scheme: dark;
  --font-heading: 'Cascadia Code', 'Microsoft YaHei UI', 'Microsoft YaHei', monospace;
  --font-body: 'Noto Sans SC', 'Microsoft YaHei UI', 'Microsoft YaHei', system-ui, -apple-system, sans-serif;
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
  --equipment-columns: 2;
  --shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  --glow: 0 0 20px rgba(34, 197, 94, 0.08);
}

body[data-theme="day"] {
  color-scheme: light;
  --color-primary: #E2E8F0;
  --color-on-primary: #0F172A;
  --color-secondary: #F8FAFC;
  --color-accent: #15803D;
  --color-background: #F7F3EA;
  --color-foreground: #172033;
  --color-muted-bg: #EEF2F6;
  --color-border: #CBD5E1;
  --color-ring: #15803D;
  --shadow: 0 8px 28px rgba(15, 23, 42, 0.12);
  --glow: 0 0 16px rgba(21, 128, 61, 0.12);
}

body[data-theme="day"] .panel,
body[data-theme="day"] .card,
body[data-theme="day"] .skill-card { background: rgba(255, 255, 255, 0.9); }
body[data-theme="day"] .health,
body[data-theme="day"] .check-row,
body[data-theme="day"] .condition-line,
body[data-theme="day"] .tool-item,
body[data-theme="day"] .plugin-item,
body[data-theme="day"] .empty,
body[data-theme="day"] textarea,
body[data-theme="day"] .add-tool input,
body[data-theme="day"] .governance-panel,
body[data-theme="day"] .overview-card,
body[data-theme="day"] .skill-toolbar,
body[data-theme="day"] .tag-filter-panel { background: rgba(226, 232, 240, 0.62); }
body[data-theme="day"] .muted,
body[data-theme="day"] .meta-line,
body[data-theme="day"] .skill-card-left p,
body[data-theme="day"] .plugin-item .plugin-desc,
body[data-theme="day"] .workflow-rail p { color: #475569; }

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  margin: 0;
  background: var(--color-background);
  color: var(--color-foreground);
  font-family: var(--font-body);
  font-size: 16px;
  line-height: 1.65;
}

.shell {
  max-width: min(1760px, calc(100vw - 32px));
  margin: 0 auto;
  padding: 24px 16px 56px;
}

/* Hero */
.hero {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 22px 26px;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}
.hero-copy { min-width: 0; }
.hero-side { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.theme-toggle { display: inline-flex; gap: 4px; padding: 4px; border: 1px solid var(--color-border); border-radius: 999px; background: var(--color-muted-bg); }
.theme-toggle button { width: 36px; height: 36px; border: 0; border-radius: 999px; background: transparent; color: var(--color-foreground); cursor: pointer; }
.theme-toggle button.active { background: var(--color-accent); color: #fff; }
.theme-toggle button:focus-visible { outline: 3px solid var(--color-ring); outline-offset: 2px; }
.eyebrow { color: var(--color-accent); text-transform: uppercase; letter-spacing: 0.12em; font-size: 12px; font-weight: 700; margin-bottom: 4px; font-family: var(--font-heading); }
h1 { font-family: var(--font-heading); font-size: 28px; color: var(--color-foreground); margin: 0; }
.muted { color: #94A3B8; font-size: 14px; }

/* Tabs */
.tabs {
  display: flex;
  gap: 4px;
  margin: 20px 0 0;
  background: var(--color-muted-bg);
  border-radius: var(--radius);
  padding: 4px;
  border: 1px solid var(--color-border);
}
.tab {
  flex: 1;
  min-height: 44px;
  padding: 10px 18px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: #94A3B8;
  font-family: var(--font-heading);
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}
.tab:hover { color: var(--color-foreground); background: rgba(255,255,255,0.05); }
.tab.active { background: var(--color-primary); color: var(--color-foreground); box-shadow: var(--glow); }

/* Panels */
.panel {
  margin-top: 20px;
  padding: 24px;
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  backdrop-filter: blur(8px);
}
.tab-panel { display: none; }
.tab-panel.active { display: block; }
.section-head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 18px; }
.head-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.title-row { display: inline-flex; align-items: center; gap: 10px; }
h2 { font-family: var(--font-heading); font-size: 20px; color: var(--color-foreground); margin: 0; }
.compact { margin-top: 4px; font-size: 14px; }

/* Buttons */
.circle-button {
  width: 44px; height: 44px;
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
  min-height: 44px;
  padding: 0 16px;
  cursor: pointer;
  font-family: var(--font-body);
  font-size: 14px;
  font-weight: 600;
  transition: all 0.15s ease;
}
.ghost-button:hover { border-color: var(--color-accent); }
.filter-button {
  min-height: 44px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-muted-bg);
  color: var(--color-foreground);
  padding: 0 14px;
  cursor: pointer;
  font: inherit;
  font-size: 14px;
  font-weight: 600;
}
.filter-button:hover { border-color: var(--color-accent); }

/* Health */
.health { min-width: 220px; padding: 12px; border-radius: 12px; background: rgba(0,0,0,0.2); border: 1px solid var(--color-border); }
.health-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 6px; }
.health-chip { border-radius: 10px; padding: 6px; text-align: center; background: rgba(255,255,255,0.03); }
.health-chip strong { display: block; font-size: 18px; font-family: var(--font-heading); }
.health-chip span { font-size: 12px; color: #94A3B8; }
.status-mini { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
.status-mini span { border: 1px solid var(--color-border); border-radius: 999px; padding: 3px 9px; font-size: 12px; background: rgba(0,0,0,0.1); }

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
.equipment-controls { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.columns-control { display: inline-flex; align-items: center; gap: 4px; border: 1px solid var(--color-border); border-radius: 999px; padding: 4px; background: var(--color-muted-bg); }
.columns-control span { color: #94A3B8; font-size: 13px; padding: 0 6px; }
.columns-control button { min-width: 36px; height: 36px; border-radius: 999px; border: 1px solid transparent; background: transparent; color: #94A3B8; cursor: pointer; font-weight: 600; font-size: 13px; }
.columns-control button.active { background: var(--color-accent); border-color: var(--color-accent); color: #fff; }

.overview-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
.overview-card { border: 1px solid var(--color-border); border-radius: 12px; background: rgba(0,0,0,0.14); padding: 12px 14px; }
.overview-value { display: block; font-family: var(--font-heading); font-size: 22px; color: var(--color-foreground); }
.overview-label { color: #94A3B8; font-size: 13px; }
.governance-panel { display: grid; gap: 14px; border: 1px solid var(--color-border); background: rgba(0,0,0,0.14); border-radius: 14px; padding: 16px; margin-bottom: 18px; }
.governance-controls { display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap; }
.field-label { display: grid; gap: 6px; color: #94A3B8; font-size: 13px; font-weight: 600; }
.field-label select,
.skill-toolbar input,
.skill-toolbar select { min-height: 44px; border: 1px solid var(--color-border); border-radius: 10px; background: var(--color-primary); color: var(--color-foreground); padding: 0 12px; font: inherit; font-size: 14px; }
.field-label select:focus-visible,
.skill-toolbar input:focus-visible,
.skill-toolbar select:focus-visible { outline: 3px solid var(--color-ring); outline-offset: 2px; }
.filter-button.active { border-color: var(--color-accent); color: var(--color-accent); background: var(--ok-bg); }
.scenario-hint { border-left: 3px solid var(--info); padding-left: 12px; color: #CBD5E1; font-size: 14px; }

.strategy-strip {
  border: 1px solid rgba(59,130,246,0.32);
  background: var(--info-bg);
  border-radius: 12px;
  padding: 12px 14px;
  margin-bottom: 16px;
  font-size: 14px;
  line-height: 1.6;
}

.adapter-strip { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
.adapter-pill { display: inline-flex; align-items: center; gap: 6px; padding: 5px 11px; border: 1px solid var(--color-border); border-radius: 999px; background: var(--color-muted-bg); font-size: 13px; }
.adapter-pill strong { font-family: var(--font-heading); }

.equipment-groups { display: grid; gap: 20px; }

/* Workflow Group */
.workflow-group {
  display: grid;
  grid-template-columns: minmax(220px, 280px) 1fr;
  gap: 18px;
  border-top: 1px solid var(--color-border);
  padding-top: 16px;
}
.workflow-rail {
  border: 1px solid var(--color-border);
  border-radius: 14px;
  background: var(--color-muted-bg);
  padding: 16px;
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
.workflow-rail h3 { margin: 12px 0 6px; font-family: var(--font-heading); font-size: 17px; color: var(--color-foreground); }
.workflow-rail p { margin: 0; color: #94A3B8; font-size: 14px; line-height: 1.6; }
.workflow-grid { display: grid; grid-template-columns: repeat(var(--equipment-columns), minmax(0, 1fr)); gap: 16px; }

/* Card */
.card {
  border: 1px solid var(--color-border);
  border-radius: 14px;
  background: rgba(15, 23, 42, 0.8);
  padding: 18px;
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
.card h4 { font-family: var(--font-heading); font-size: 17px; color: var(--color-foreground); margin: 0 0 2px; }
.slot-key { color: #64748B; font-size: 12px; font-family: var(--font-heading); }
.meta-line { color: #94A3B8; font-size: 14px; line-height: 1.5; }
.condition-line { color: var(--color-foreground); font-size: 14px; line-height: 1.55; background: rgba(0,0,0,0.2); border: 1px solid var(--color-border); border-radius: 10px; padding: 10px; }
.condition-line strong { color: var(--color-accent); }
.action-line { border-left: 3px solid var(--color-accent); padding-left: 10px; color: #CBD5E1; font-size: 13px; }
.action-line.warning { border-left-color: var(--warn); color: var(--warn); }
.action-line.disabled { border-left-color: #64748B; color: #94A3B8; }
.tool-summary { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.tool-summary strong { font-size: 14px; font-family: var(--font-heading); color: var(--color-foreground); }
.badges { display: flex; gap: 4px; flex-wrap: wrap; }

.badge {
  font-size: 12px;
  color: var(--color-foreground);
  background: var(--color-muted-bg);
  border: 1px solid var(--color-border);
  padding: 3px 9px;
  border-radius: 999px;
  white-space: nowrap;
}
.badge.ok { color: var(--ok); background: var(--ok-bg); border-color: rgba(34,197,94,0.35); }
.badge.warning { color: var(--warn); background: var(--warn-bg); border-color: rgba(234,179,8,0.35); }
.badge.error { color: var(--err); background: var(--err-bg); border-color: rgba(239,68,68,0.35); }
.badge.info { color: var(--info); background: var(--info-bg); border-color: rgba(59,130,246,0.35); }
.badge.disabled { color: #64748B; background: rgba(100,116,139,0.12); border-color: rgba(100,116,139,0.28); }

/* Switch */
.switch { position: relative; display: inline-flex; width: 46px; height: 26px; align-items: center; flex-shrink: 0; }
.switch input { opacity: 0; width: 0; height: 0; }
.slider { position: absolute; cursor: pointer; inset: 0; background: #64748B; border: 1px solid rgba(148,163,184,0.5); border-radius: 999px; transition: 0.15s ease; }
.slider:before { content: ""; position: absolute; height: 20px; width: 20px; left: 2px; top: 2px; background: #fff; border-radius: 50%; transition: 0.15s ease; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
.switch input:checked + .slider { background: var(--color-accent); border-color: var(--color-accent); }
.switch input:checked + .slider:before { transform: translateX(20px); }
.switch input:focus-visible + .slider { outline: 3px solid var(--color-ring); outline-offset: 3px; }

/* Tool List */
.tool-list { display: grid; gap: 6px; padding: 0; margin: 4px 0 0; list-style: none; }
.tool-item {
  display: grid;
  grid-template-columns: 20px 24px minmax(90px, 1fr) auto auto;
  gap: 8px;
  align-items: center;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: rgba(0,0,0,0.2);
  padding: 9px 10px;
  cursor: grab;
  transition: all 0.1s ease;
}
.tool-item:hover { border-color: var(--color-accent); }
.tool-item:active { cursor: grabbing; }
.tool-item.primary { border-color: rgba(34,197,94,0.5); box-shadow: 0 0 0 1px rgba(34,197,94,0.14); }
.tool-item.dragging { opacity: 0.5; }
.drag-handle { color: #64748B; font-size: 16px; user-select: none; cursor: grab; }
.order { width: 24px; height: 24px; border-radius: 999px; background: var(--color-muted-bg); display: inline-flex; align-items: center; justify-content: center; color: #94A3B8; font-size: 11px; font-weight: 700; }
.tool-name { font-weight: 600; color: var(--color-foreground); overflow: hidden; text-overflow: ellipsis; font-size: 14px; }
.tool-status { display: inline-flex; gap: 4px; align-items: center; flex-wrap: wrap; justify-content: flex-end; }
.move-actions { display: inline-flex; gap: 3px; }
.move-button { width: 32px; height: 32px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-muted-bg); color: var(--color-foreground); cursor: pointer; font-size: 14px; }
.move-button:hover { border-color: var(--color-accent); }
.move-button:disabled { opacity: 0.35; cursor: default; }
.add-tool { display: flex; gap: 6px; margin-top: auto; }
.add-tool input { min-width: 0; min-height: 44px; flex: 1; border: 1px solid var(--color-border); border-radius: 10px; background: rgba(0,0,0,0.2); color: var(--color-foreground); padding: 9px 10px; font-size: 14px; }
.add-tool input:focus { outline: none; border-color: var(--color-accent); }
.add-button { width: 44px; border-radius: 10px; border: 1px solid var(--color-accent); background: var(--ok-bg); color: var(--color-accent); font-size: 20px; cursor: pointer; transition: all 0.15s ease; }
.add-button:hover { filter: brightness(1.1); }

/* Skills */
.skill-overview { margin-bottom: 14px; }
.skill-toolbar { display: grid; grid-template-columns: minmax(260px, 1fr) minmax(180px, 0.45fr) minmax(180px, 0.45fr) auto; gap: 10px; align-items: end; border: 1px solid var(--color-border); border-radius: 14px; background: rgba(0,0,0,0.14); padding: 14px; }
.skill-search { display: grid; gap: 6px; color: #94A3B8; font-size: 13px; font-weight: 600; }
.tag-filter-panel { border: 1px solid var(--color-border); border-radius: 14px; background: rgba(0,0,0,0.14); padding: 14px; margin: 10px 0 18px; }
.tag-filter-head { display: flex; justify-content: space-between; gap: 10px; align-items: center; margin-bottom: 10px; color: #CBD5E1; font-size: 13px; }
.tag-filter-list { display: flex; gap: 8px; flex-wrap: wrap; }
.tag-filter-button { min-height: 34px; border: 1px solid var(--color-border); border-radius: 999px; padding: 5px 11px; background: var(--color-muted-bg); color: #CBD5E1; cursor: pointer; font: inherit; font-size: 13px; }
.tag-filter-button:hover { border-color: var(--color-accent); }
.tag-filter-button.active { color: var(--color-accent); border-color: var(--color-accent); background: var(--ok-bg); }
#skillsList { display: grid; gap: 26px; }
.skill-category-section { display: grid; gap: 12px; }
.skill-category-head { display: flex; gap: 10px; align-items: center; border-bottom: 1px solid var(--color-border); padding-bottom: 8px; }
.skill-category-head h3 { margin: 0; font-family: var(--font-heading); font-size: 18px; }
.skill-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.skill-card {
  border: 1px solid var(--color-border);
  border-radius: 14px;
  background: rgba(15, 23, 42, 0.8);
  padding: 18px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
}
.skill-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
.skill-card-left { flex: 1; min-width: 0; }
.skill-card-left h4 { font-family: var(--font-heading); font-size: 17px; margin: 0 0 3px; }
.skill-name { color: #64748B; font-family: var(--font-heading); font-size: 12px; overflow-wrap: anywhere; }
.skill-card-left p { color: #A8B5C7; font-size: 15px; margin: 10px 0 0; line-height: 1.65; }
.skill-card.disabled { opacity: 0.62; }
.skill-meta { display: flex; gap: 6px; flex-wrap: wrap; }
.skill-footer { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; border-top: 1px solid var(--color-border); padding-top: 12px; margin-top: auto; }
.skill-usage { color: #94A3B8; font-size: 13px; }
.skill-usage strong { color: var(--color-foreground); font-family: var(--font-heading); font-size: 15px; }
.skill-use-button { min-height: 38px; border: 1px solid var(--color-accent); border-radius: 10px; background: var(--ok-bg); color: var(--color-accent); padding: 0 12px; cursor: pointer; font: inherit; font-size: 13px; font-weight: 700; }
.skill-source { color: #64748B; font-size: 12px; }
.skill-source summary { cursor: pointer; }
.skill-source code { display: block; margin-top: 6px; white-space: normal; overflow-wrap: anywhere; }

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
.plugin-item .plugin-name { font-family: var(--font-heading); font-weight: 600; font-size: 15px; }
.plugin-item .plugin-desc { color: #94A3B8; font-size: 14px; }

/* Common */
.empty { border: 1px dashed var(--color-border); border-radius: 12px; color: #94A3B8; padding: 22px; background: rgba(0,0,0,0.1); text-align: center; font-size: 14px; }
.hidden { display: none !important; }
textarea { width: 100%; min-height: 200px; background: rgba(0,0,0,0.2); border: 1px solid var(--color-border); border-radius: 12px; color: var(--color-foreground); padding: 14px; font-family: var(--font-heading); font-size: 14px; line-height: 1.7; }

/* Footer */
.footer { text-align: center; padding: 24px 0 8px; }
.footer p { font-size: 13px; }
.action-toast { position: fixed; right: 24px; bottom: 24px; z-index: 20; max-width: min(360px, calc(100vw - 32px)); border: 1px solid rgba(34,197,94,0.45); border-radius: 12px; background: var(--color-primary); color: var(--color-foreground); box-shadow: var(--shadow); padding: 12px 16px; font-size: 14px; font-weight: 600; opacity: 0; pointer-events: none; transform: translateY(10px); transition: opacity 0.16s ease, transform 0.16s ease; }
.action-toast.show { opacity: 1; transform: translateY(0); }

/* Responsive */
@media (max-width: 1100px) {
  .workflow-group { grid-template-columns: 1fr; }
  .workflow-grid { grid-template-columns: repeat(min(var(--equipment-columns), 2), minmax(0, 1fr)); }
  .skill-toolbar { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .skill-grid { grid-template-columns: 1fr; }
  .hero { flex-direction: column; align-items: flex-start; }
  .section-head { flex-direction: column; }
}
@media (max-width: 760px) {
  .shell { max-width: 100%; padding: 12px 8px 28px; }
  .workflow-grid { grid-template-columns: 1fr; }
  .tool-item { grid-template-columns: 20px 24px 1fr auto; }
  .tool-status { grid-column: 3 / -1; justify-content: flex-start; }
  .move-actions { grid-column: 4; grid-row: 1; }
  .panel { padding: 16px 12px; }
  .overview-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .skill-toolbar { grid-template-columns: 1fr; }
  .governance-controls { align-items: stretch; }
  .governance-controls > * { width: 100%; }
  .tabs { overflow-x: auto; }
  .tab { min-width: 100px; }
  h1 { font-size: 22px; overflow-wrap: anywhere; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior: auto !important; transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }
}
`
}

function js() {
  return `//
// AI ToolOps UI v2 — SPA
//
const escapeHtml = (v) => String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
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
const equipmentScenarios = {
  daily: { label:'日常开发', slots:['agent_compatibility','architecture_context','exact_search','semantic_search','build_validation','human_confirmation'], hint:'覆盖规则同步、项目理解、代码定位、验证和关键确认，适合大多数开发任务。' },
  ui: { label:'界面与视觉', slots:['architecture_context','semantic_search','build_validation','human_confirmation'], hint:'聚焦界面上下文、组件定位、页面验证与交互确认，减少不相关装备干扰。' },
  refactor: { label:'跨模块重构', slots:['agent_compatibility','architecture_context','exact_search','semantic_search','code_graph','build_validation','human_confirmation'], hint:'加强架构理解、调用链分析和回归验证，优先暴露缺失的代码图谱能力。' },
  docs: { label:'文档与办公', slots:['agent_compatibility','architecture_context','build_validation','human_confirmation'], hint:'保留规则、上下文、产物验证与人工确认，适合文档、表格和演示材料任务。' },
  onboarding: { label:'接手新项目', slots:['agent_compatibility','architecture_context','exact_search','semantic_search','code_graph','human_confirmation'], hint:'优先建立项目画像和依赖关系，快速识别当前环境有哪些能力可直接复用。' },
  all: { label:'全部能力', slots:null, hint:'展示所有已配置能力槽位，用于完整审计与维护。' }
};
let equipmentRenderInput = null;
const equipmentView = {
  scenario: localStorage.getItem('ai-toolops.equipment.scenario') || 'daily',
  issuesOnly: localStorage.getItem('ai-toolops.equipment.issues') === 'true'
};
let skillCatalog = {};
const skillView = {
  query:'', category:'all', tags:new Set(), sort:'recommended',
  locale: localStorage.getItem('ai-toolops.skill.locale') || 'zh'
};

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
  equipmentRenderInput = {data:{equipment,health,registry,capabilities}, workflowStages};
  const root = document.getElementById('equipmentGroups');
  const empty = document.getElementById('emptyEquipment');
  const statuses = new Map();
  const usableStatuses = new Set(['installed','project_provided','built_in','ok']);
  (health.slots||[]).forEach(s => (s.tools||[]).forEach(t => { if(s.slot&&t.tool&&t.status) statuses.set(s.slot+'::'+t.tool, t.status); }));
  (health.checks||[]).forEach(i => { if(i.slot&&i.tool&&i.status&&!statuses.has(i.slot+'::'+i.tool)) statuses.set(i.slot+'::'+i.tool,i.status); });
  const slotEntries = Object.entries(equipment.slots||{}).map(([key,slot]) => {
    const tools = getTools(slot);
    const slotStatuses = tools.map(t => statuses.get(key+'::'+t)||'configured_unverified');
    const enabled = slot.enabled !== false;
    const usable = enabled && slotStatuses.some(s => usableStatuses.has(s));
    return {key,slot,tools,slotStatuses,enabled,usable,needsAttention:enabled&&!usable};
  }).filter(i => i.tools.length);
  const overview = {
    total: slotEntries.length,
    available: slotEntries.filter(i=>i.usable).length,
    attention: slotEntries.filter(i=>i.needsAttention).length,
    disabled: slotEntries.filter(i=>!i.enabled).length
  };
  document.getElementById('equipmentOverview').innerHTML =
    overviewCard(overview.total,'能力槽位')+overviewCard(overview.available,'当前可用')+
    overviewCard(overview.attention,'需要处理')+overviewCard(overview.disabled,'主动关闭');
  const scenario = equipmentScenarios[equipmentView.scenario] || equipmentScenarios.daily;
  document.getElementById('equipmentScenarioHint').textContent = scenario.label+'：'+scenario.hint;
  const stages = (workflowStages&&workflowStages.length ? workflowStages : fallbackStages).map(s=>({...s,items:[]}));
  const stageMap = new Map(stages.map(s=>[s.key,s]));
  let visible = 0;
  slotEntries.forEach(item => {
    const {key,slot} = item;
    if (scenario.slots && !scenario.slots.includes(key)) return;
    if (equipmentView.issuesOnly && !item.needsAttention && item.enabled) return;
    const sk = stageFor(key, slot);
    if (!stageMap.has(sk)) stageMap.set(sk, {key:sk,label:sk,desc:'',items:[]});
    stageMap.get(sk).items.push(item);
    visible++;
  });
  root.textContent = '';
  let stageIndex = 0;
  [...stageMap.values()].forEach(stage => {
    if (!stage.items.length) return;
    stageIndex++;
    const sec = document.createElement('section');
    sec.className = 'workflow-group';
    sec.innerHTML =
      '<div class="workflow-rail"><span class="workflow-index">'+stageIndex+
      '</span><h3>'+escapeHtml(stage.label)+
      '</h3><p>'+escapeHtml(stage.desc||'')+'</p></div><div class="workflow-grid"></div>';
    const grid = sec.querySelector('.workflow-grid');
    stage.items.sort((a,b) => (a.slot.relationGroup||'').localeCompare(b.slot.relationGroup||''));
    stage.items.forEach(({key,slot,tools,slotStatuses,enabled,usable,needsAttention}) => {
      const priority = isPriority(slot);
      const summary = !enabled ? '已关闭' : needsAttention ? '待接入或验证' : priority ? tools[slotStatuses.findIndex(s=>usableStatuses.has(s))]||tools[0] : '可使用';
      const cat = slot.category||'external_tool';
      const card = document.createElement('article');
      card.className = 'card '+cat+(enabled?'':' disabled');
      const cond = conditionText(key,slot,tools,registry);
      const actionText = !enabled ? '已关闭：不会进入 Agent 策略。' : needsAttention ? '需处理：安装、验证或调整此槽位的首选工具。' : '可用：已同步到 Agent 策略。';
      card.innerHTML =
        '<div class="card-top"><div><h4>'+escapeHtml(slot.label)+'</h4><div class="slot-key">'+escapeHtml(key)+'</div></div>' +
        '<label class="switch"><input type="checkbox" aria-label="启用或关闭 '+escapeHtml(slot.label||key)+'" '+(enabled?'checked':'')+' data-slot="'+escapeHtml(key)+'"><span class="slider"></span></label></div>' +
        '<div class="tool-summary"><strong>'+(needsAttention?'状态：':priority?'生效：':'启用：')+'</strong><span class="badge '+(!enabled?'disabled':needsAttention?'warning':'ok')+'">'+escapeHtml(summary)+'</span></div>' +
        '<div class="meta-line">Fallback：'+escapeHtml((slot.fallback||[]).join(', ')||'无')+'</div>' +
        (cond?'<div class="condition-line"><strong>条件：</strong>'+escapeHtml(cond)+'</div>':'') +
        '<div class="action-line '+(!enabled?'disabled':needsAttention?'warning':'')+'">'+escapeHtml(actionText)+'</div>'+
        '<div class="badges">' +
          '<span class="badge">'+escapeHtml(slot.loadLevel||'-')+'</span>' +
          '<span class="badge info">'+escapeHtml(slotTypeText[slot.slotType]||slot.slotType||'')+'</span>' +
          '<span class="badge">'+escapeHtml(categoryText[cat]||cat)+'</span>' +
          '<span class="badge '+(enabled?'ok':'disabled')+'">'+escapeHtml(enabled?'启用':'关闭')+'</span>' +
        '</div>' +
        '<ul class="tool-list" data-tool-list="'+escapeHtml(key)+'"></ul>' +
        '<div class="add-tool">' +
          '<input data-add-input="'+escapeHtml(key)+'" aria-label="为 '+escapeHtml(slot.label||key)+' 输入工具名" placeholder="'+escapeHtml(slot.recommendedTool||'输入工具名')+'" />' +
          '<button class="add-button" data-add-slot="'+escapeHtml(key)+'" aria-label="生成 '+escapeHtml(slot.label||key)+' 工具接入提示词">+</button>' +
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
          escapeHtml(!enabled?'关闭':priority?(idx===0?'生效':'备用'):'启用')+'</span></span>'+
          '<span class="move-actions"><button class="move-button" type="button" data-move="up" aria-label="上移 '+escapeHtml(tn)+'" '+(idx===0?'disabled':'')+'>↑</button>'+
          '<button class="move-button" type="button" data-move="down" aria-label="下移 '+escapeHtml(tn)+'" '+(idx===tools.length-1?'disabled':'')+'>↓</button></span>';
        list.appendChild(li);
      });
      grid.appendChild(card);
    });
    root.appendChild(sec);
  });
  empty.classList.toggle('hidden', visible>0);
  bindEquipmentEvents(root, equipment, registry);
}

function overviewCard(value, label) {
  return '<div class="overview-card"><strong class="overview-value">'+escapeHtml(value)+'</strong><span class="overview-label">'+escapeHtml(label)+'</span></div>';
}

function conditionText(key,slot,tools,registry) {
  if (key==='semantic_search') return '入口/调用链不明确时优先，无结果再用精确搜索兜底。';
  if (key==='exact_search') return '目标明确、需路径校验时使用。';
  if (key==='human_confirmation') return '关键范围/接口契约/高风险操作或结束反馈时使用。';
  const t = tools[0]; const u = registry.tools?.[t]?.useWhen||[];
  return u.length ? u.slice(0,2).join(' / ') : '';
}

function renderSkills(skills) {
  skillCatalog = skills || {};
  populateSkillControls();
  renderSkillView();
}

function populateSkillControls() {
  const items = Object.entries(skillCatalog);
  const categories = new Map();
  const tags = new Set();
  items.forEach(([,s]) => {
    categories.set(s.category||'general', s.categoryLabel||'通用能力');
    (s.tags||[]).forEach(tag => tags.add(tag));
  });
  const select = document.getElementById('skillCategoryFilter');
  select.innerHTML = '<option value="all">全部场景</option>'+[...categories.entries()]
    .sort((a,b)=>a[1].localeCompare(b[1],'zh-CN'))
    .map(([key,label])=>'<option value="'+escapeHtml(key)+'">'+escapeHtml(label)+'</option>').join('');
  select.value = categories.has(skillView.category) ? skillView.category : 'all';
  skillView.category = select.value;
  const tagRoot = document.getElementById('skillTagFilters');
  tagRoot.innerHTML = [...tags].sort((a,b)=>a.localeCompare(b,'zh-CN')).map(tag =>
    '<button type="button" class="tag-filter-button '+(skillView.tags.has(tag)?'active':'')+'" data-skill-tag="'+escapeHtml(tag)+'" aria-pressed="'+skillView.tags.has(tag)+'">'+escapeHtml(tag)+'</button>'
  ).join('') || '<span class="muted">扫描后会根据能力说明自动生成标签。</span>';
  tagRoot.querySelectorAll('[data-skill-tag]').forEach(button => button.addEventListener('click', () => {
    const tag = button.dataset.skillTag;
    if (skillView.tags.has(tag)) skillView.tags.delete(tag); else skillView.tags.add(tag);
    button.classList.toggle('active', skillView.tags.has(tag));
    button.setAttribute('aria-pressed', String(skillView.tags.has(tag)));
    renderSkillView();
  }));
  updateSkillLocaleButton();
}

function renderSkillView() {
  const root = document.getElementById('skillsList');
  const empty = document.getElementById('emptySkills');
  const allItems = Object.entries(skillCatalog);
  const query = skillView.query.trim().toLocaleLowerCase('zh-CN');
  let items = allItems.filter(([name,s]) => {
    const text = [name,s.label,s.description,s.descriptionZh,s.categoryLabel,...(s.tags||[])].filter(Boolean).join(' ').toLocaleLowerCase('zh-CN');
    return (!query || text.includes(query)) &&
      (skillView.category==='all' || s.category===skillView.category) &&
      [...skillView.tags].every(tag => (s.tags||[]).includes(tag));
  });
  const byName = (a,b) => (a[1].label||a[0]).localeCompare(b[1].label||b[0],'zh-CN');
  if (skillView.sort==='usage') items.sort((a,b)=>(b[1].usageCount||0)-(a[1].usageCount||0)||byName(a,b));
  else if (skillView.sort==='recent') items.sort((a,b)=>String(b[1].lastUsedAt||'').localeCompare(String(a[1].lastUsedAt||''))||byName(a,b));
  else if (skillView.sort==='name') items.sort(byName);
  else items.sort((a,b)=>(b[1].enabled!==false)-(a[1].enabled!==false)||(b[1].usageCount||0)-(a[1].usageCount||0)||byName(a,b));
  const enabledCount = allItems.filter(([,s])=>s.enabled!==false).length;
  const usedCount = allItems.filter(([,s])=>(s.usageCount||0)>0).length;
  const categoryCount = new Set(allItems.map(([,s])=>s.category||'general')).size;
  document.getElementById('skillOverview').innerHTML =
    overviewCard(allItems.length,'已发现')+overviewCard(enabledCount,'已启用')+
    overviewCard(categoryCount,'使用场景')+overviewCard(usedCount,'有使用记录');
  root.textContent = '';
  if (!items.length) {
    empty.classList.remove('hidden');
    empty.innerHTML = allItems.length ? '没有匹配当前条件的 Skill。<br><span class="muted">可减少标签或清空筛选。</span>' : '暂无 Skill。可点击“重新扫描”发现本机与项目中的 Skill。';
    return;
  }
  empty.classList.add('hidden');
  const groups = new Map();
  items.forEach(([name,s]) => {
    const key = s.category||'general';
    if (!groups.has(key)) groups.set(key,{label:s.categoryLabel||'通用能力',items:[]});
    groups.get(key).items.push([name,s]);
  });
  [...groups.values()].sort((a,b)=>a.label.localeCompare(b.label,'zh-CN')).forEach(group => {
    const section = document.createElement('section');
    section.className = 'skill-category-section';
    section.innerHTML = '<div class="skill-category-head"><h3>'+escapeHtml(group.label)+'</h3><span class="badge">'+group.items.length+' 个</span></div><div class="skill-grid"></div>';
    const grid = section.querySelector('.skill-grid');
    group.items.forEach(([name,s]) => grid.appendChild(createSkillCard(name,s)));
    root.appendChild(section);
  });
  bindSkillCardEvents(root);
}

function createSkillCard(name, s) {
  const enabled = s.enabled !== false;
  const card = document.createElement('article');
  card.className = 'skill-card'+(enabled?'':' disabled');
  const description = skillView.locale==='zh' ? (s.descriptionZh||s.description||'暂无说明') : (s.description||s.descriptionZh||'No description.');
  const sourcePath = s.promptFile||s.source?.path||'';
  card.innerHTML =
    '<div class="skill-top"><div class="skill-card-left"><h4>'+escapeHtml(s.label||name)+'</h4><div class="skill-name">'+escapeHtml(name)+'</div></div>'+
    '<label class="switch"><input type="checkbox" data-skill="'+escapeHtml(name)+'" aria-label="启用或关闭 '+escapeHtml(s.label||name)+'" '+(enabled?'checked':'')+'><span class="slider"></span></label></div>'+
    '<div class="skill-card-left"><p>'+escapeHtml(description)+'</p></div>'+
    '<div class="skill-meta">'+(s.tags||[]).map(tag=>'<span class="badge info">'+escapeHtml(tag)+'</span>').join('')+'</div>'+
    (sourcePath?'<details class="skill-source"><summary>查看来源</summary><code>'+escapeHtml(sourcePath)+'</code></details>':'')+
    '<div class="skill-footer"><div><div class="skill-usage"><strong>'+(s.usageCount||0)+'</strong> 次使用 · '+escapeHtml(formatLastUsed(s.lastUsedAt))+'</div>'+
    '<div class="skill-meta"><span class="badge">'+escapeHtml(s.scope||s.source?.scope||'unknown')+'</span>'+
    (s.agent||s.source?.agent?'<span class="badge">'+escapeHtml(s.agent||s.source?.agent)+'</span>':'')+'</div></div>'+
    '<button type="button" class="skill-use-button" data-skill-use="'+escapeHtml(name)+'">记一次使用</button></div>';
  return card;
}

function formatLastUsed(value) {
  if (!value) return '从未记录';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '时间未知';
  return '最近 '+new Intl.DateTimeFormat('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(date);
}

function bindSkillCardEvents(root) {
  root.querySelectorAll('[data-skill]').forEach(input => input.addEventListener('change', async e => {
    const name = e.target.dataset.skill;
    const enabled = e.target.checked;
    try {
      const res = await fetch('/api/skill-toggle', {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({skill:name,enabled})});
      if (!res.ok) throw new Error(await res.text());
      skillCatalog[name].enabled = enabled;
      renderSkillView();
    } catch (error) {
      e.target.checked = !enabled;
      alert('Skill 切换失败：'+error.message);
    }
  }));
  root.querySelectorAll('[data-skill-use]').forEach(button => button.addEventListener('click', async () => {
    const name = button.dataset.skillUse;
    button.disabled = true;
    try {
      const res = await fetch('/api/skill-use', {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({skill:name})});
      if (!res.ok) throw new Error(await res.text());
      const result = await res.json();
      skillCatalog[name].usageCount = result.usageCount;
      skillCatalog[name].lastUsedAt = result.lastUsedAt;
      renderSkillView();
    } catch (error) {
      button.disabled = false;
      alert('使用记录失败：'+error.message);
    }
  }));
}

function updateSkillLocaleButton() {
  const button = document.getElementById('skillLocaleBtn');
  button.textContent = skillView.locale==='zh' ? '查看英文原文' : '显示中文概览';
  button.setAttribute('aria-pressed', String(skillView.locale==='zh'));
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
        equipment.slots[slot].enabled = enabled;
        refreshEquipmentView('已'+(enabled?'启用':'关闭')+'「'+(equipment.slots[slot].label||slot)+'」', '[data-slot="'+CSS.escape(slot)+'"]');
      } catch (error) { e.target.checked = !enabled; alert('切换失败：'+error.message); }
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
      try {
        const result = await saveToolOrder(sk, ordered);
        applyLocalToolOrder(equipment, sk, result.tools||ordered);
      } catch (error) { alert('排序保存失败：'+error.message); }
    });
  });
  root.querySelectorAll('[data-move]').forEach(button => button.addEventListener('click', async () => {
    const item = button.closest('.tool-item');
    const list = item.closest('.tool-list');
    const items = [...list.querySelectorAll('.tool-item')];
    const index = items.indexOf(item);
    const targetIndex = button.dataset.move==='up' ? index-1 : index+1;
    if (targetIndex<0 || targetIndex>=items.length) return;
    const ordered = items.map(i=>i.dataset.tool);
    [ordered[index],ordered[targetIndex]] = [ordered[targetIndex],ordered[index]];
    button.disabled = true;
    try {
      const slotKey = list.dataset.toolList;
      const result = await saveToolOrder(slotKey, ordered);
      const focusSelector = '[data-tool-list="'+CSS.escape(slotKey)+'"] [data-tool="'+CSS.escape(item.dataset.tool)+'"] [data-move="'+button.dataset.move+'"]';
      applyLocalToolOrder(equipment, slotKey, result.tools||ordered, focusSelector);
    } catch (error) {
      button.disabled = false;
      alert('排序保存失败：'+error.message);
    }
  }));
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

async function saveToolOrder(slot, tools) {
  const res = await fetch('/api/reorder-tools', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({slot,tools})});
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function applyLocalToolOrder(equipment, slotKey, tools, focusSelector = '') {
  const slot = equipment.slots?.[slotKey];
  if (!slot) return;
  slot.tools = [...tools];
  slot.active = isPriority(slot) ? (slot.tools[0]||null) : null;
  refreshEquipmentView('顺序已保存，当前首选：'+(slot.active||'全部启用'), focusSelector);
}

function refreshEquipmentView(message, focusSelector = '') {
  if (!equipmentRenderInput) return;
  const scrollTop = window.scrollY;
  renderEquipment(equipmentRenderInput.data, equipmentRenderInput.workflowStages);
  requestAnimationFrame(() => {
    window.scrollTo(0, scrollTop);
    if (focusSelector) document.querySelector(focusSelector)?.focus();
    showActionToast(message);
  });
}

let actionToastTimer = 0;
function showActionToast(message) {
  const toast = document.getElementById('actionToast');
  if (!toast) return;
  window.clearTimeout(actionToastTimer);
  toast.textContent = message;
  toast.classList.add('show');
  actionToastTimer = window.setTimeout(() => toast.classList.remove('show'), 1800);
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
    document.querySelectorAll('[data-theme-choice]').forEach(b => b.classList.toggle('active', b.dataset.themeChoice === v));
  };
  applyTheme(stored || 'night');
  document.querySelectorAll('[data-theme-choice]').forEach(b => {
    b.addEventListener('click', () => applyTheme(b.dataset.themeChoice));
  });

  // Tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected','false'); });
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      tab.setAttribute('aria-selected','true');
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
  const savedCols = localStorage.getItem('ai-toolops.equipment.columns') || '2';
  document.documentElement.style.setProperty('--equipment-columns', savedCols);
  colBtns.forEach(c => c.classList.toggle('active', c.dataset.cols === savedCols));

  // Equipment task scenarios and issue triage
  const scenarioSelect = document.getElementById('equipmentScenario');
  if (!equipmentScenarios[equipmentView.scenario]) equipmentView.scenario = 'daily';
  scenarioSelect.value = equipmentView.scenario;
  scenarioSelect.addEventListener('change', () => {
    equipmentView.scenario = scenarioSelect.value;
    localStorage.setItem('ai-toolops.equipment.scenario', equipmentView.scenario);
    if (equipmentRenderInput) renderEquipment(equipmentRenderInput.data, equipmentRenderInput.workflowStages);
  });
  const issuesButton = document.getElementById('equipmentIssuesOnly');
  const syncIssuesButton = () => {
    issuesButton.classList.toggle('active', equipmentView.issuesOnly);
    issuesButton.setAttribute('aria-pressed', String(equipmentView.issuesOnly));
  };
  syncIssuesButton();
  issuesButton.addEventListener('click', () => {
    equipmentView.issuesOnly = !equipmentView.issuesOnly;
    localStorage.setItem('ai-toolops.equipment.issues', String(equipmentView.issuesOnly));
    syncIssuesButton();
    if (equipmentRenderInput) renderEquipment(equipmentRenderInput.data, equipmentRenderInput.workflowStages);
  });

  // Skill catalog controls
  const skillSearch = document.getElementById('skillSearchInput');
  skillSearch.addEventListener('input', () => { skillView.query = skillSearch.value; renderSkillView(); });
  document.getElementById('skillCategoryFilter').addEventListener('change', e => { skillView.category = e.target.value; renderSkillView(); });
  document.getElementById('skillSort').addEventListener('change', e => { skillView.sort = e.target.value; renderSkillView(); });
  document.getElementById('skillLocaleBtn').addEventListener('click', () => {
    skillView.locale = skillView.locale==='zh' ? 'en' : 'zh';
    localStorage.setItem('ai-toolops.skill.locale', skillView.locale);
    updateSkillLocaleButton();
    renderSkillView();
  });
  document.getElementById('clearSkillFilters').addEventListener('click', () => {
    skillView.query = ''; skillView.category = 'all'; skillView.tags.clear(); skillView.sort = 'recommended';
    skillSearch.value = '';
    document.getElementById('skillSort').value = 'recommended';
    populateSkillControls();
    renderSkillView();
  });

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
  const scanPlugins = async () => {
    try {
      const res = await fetch('/api/plugin-scan', {method:'POST'});
      if (!res.ok) throw new Error(await res.text());
      location.reload();
    } catch (error) { alert('扫描失败：'+error.message); }
  };
  document.getElementById('scanPluginsBtn').addEventListener('click', scanPlugins);
  document.getElementById('scanSkillsBtn').addEventListener('click', scanPlugins);
  document.getElementById('refreshEquipmentBtn').addEventListener('click', scanPlugins);
}`
}
