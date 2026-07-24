export const UI_APP_JS = `const token = document.querySelector('meta[name="ai-toolops-token"]').content;
const content = document.getElementById('content');
const loading = document.getElementById('loading');
const title = document.getElementById('page-title');
const agentLabel = document.getElementById('agent-label');
const dialog = document.getElementById('plan-dialog');
const planPreview = document.getElementById('plan-preview');
const applyButton = document.getElementById('apply-plan');
const toast = document.getElementById('toast');
const projectButton = document.getElementById('project-button');
const projectLabel = document.getElementById('project-label');
const projectDialog = document.getElementById('project-dialog');
const projectForm = document.getElementById('project-form');
const projectPath = document.getElementById('project-path');
const projectError = document.getElementById('project-error');
const recentProjects = document.getElementById('recent-projects');
const browseProjectButton = document.getElementById('browse-project');
let state = null;
let currentView = 'overview';
let currentPlanId = null;
let currentPlanAction = null;

document.getElementById('nav').addEventListener('click', function (event) {
  const button = event.target.closest('[data-view]');
  if (!button) return;
  currentView = button.dataset.view;
  document.querySelectorAll('.nav-item').forEach(function (item) { item.classList.toggle('active', item === button); });
  render();
});
document.getElementById('refresh').addEventListener('click', loadState);
projectButton.addEventListener('click', openProjectDialog);
projectDialog.querySelector('[data-close-project]').addEventListener('click', function () { projectDialog.close(); });
projectForm.addEventListener('submit', function (event) {
  event.preventDefault();
  selectProject(projectPath.value);
});
browseProjectButton.addEventListener('click', browseProject);
recentProjects.addEventListener('click', function (event) {
  const button = event.target.closest('[data-project]');
  if (button && !button.disabled) selectProject(button.dataset.project);
});
document.getElementById('theme-toggle').addEventListener('click', function () {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('ai-toolops-theme', next);
});
applyButton.addEventListener('click', applyPlan);
content.addEventListener('click', function (event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  if (button.dataset.action === 'check-release') return checkRelease(button);
  requestPlan(button.dataset.action, button.dataset.tool, button.dataset.agent);
});
content.addEventListener('submit', function (event) {
  if (event.target.id !== 'external-form') return;
  event.preventDefault();
  const data = new FormData(event.target);
  requestPlan('external-register', String(data.get('tool') || ''), null, { path: String(data.get('path') || '') });
});

const savedTheme = localStorage.getItem('ai-toolops-theme');
if (savedTheme) document.documentElement.dataset.theme = savedTheme;
else if (matchMedia('(prefers-color-scheme: dark)').matches) document.documentElement.dataset.theme = 'dark';

loadState();

async function loadState() {
  setLoading(true);
  try {
    state = await api('/api/state');
    agentLabel.textContent = 'Agent: ' + state.context.agent.resolved;
    updateProjectLabel();
    render();
  } catch (error) {
    content.innerHTML = '<div class="callout"><strong>无法读取状态</strong><p>' + escapeHtml(error.message) + '</p><button class="button secondary" data-action="refresh">重试</button></div>';
    notify(error.message, true);
  } finally {
    setLoading(false);
  }
}

function updateProjectLabel() {
  const project = state.ui.current;
  projectLabel.textContent = project.name;
  projectButton.title = project.root;
}

function openProjectDialog() {
  if (!state) return;
  projectPath.value = state.ui.current.root;
  projectError.textContent = '';
  projectError.classList.add('hidden');
  renderRecentProjects();
  projectDialog.showModal();
  projectPath.focus();
  projectPath.select();
}

function renderRecentProjects() {
  const projects = state.ui.recent || [];
  recentProjects.innerHTML = projects.length ? projects.map(function (project) {
    const unavailable = !project.exists || !project.initialized;
    return '<button class="recent-project" type="button" data-project="' + escapeHtml(project.root) + '"' + (unavailable ? ' disabled' : '') + '>' +
      '<strong>' + escapeHtml(project.name) + '</strong><span>' + escapeHtml(project.root) + '</span>' +
      (unavailable ? '<small>目录不可用或尚未初始化</small>' : '') + '</button>';
  }).join('') : empty('还没有最近项目。可以粘贴路径或使用“浏览”。');
}

async function browseProject() {
  browseProjectButton.disabled = true;
  browseProjectButton.textContent = '等待选择…';
  clearProjectError();
  try {
    const result = await api('/api/project/browse', { method: 'POST', body: {} });
    if (result.selected) {
      projectPath.value = result.selected;
      await selectProject(result.selected);
    }
  } catch (error) {
    showProjectError(error.message);
  } finally {
    browseProjectButton.disabled = false;
    browseProjectButton.textContent = '浏览…';
  }
}

async function selectProject(project) {
  const buttons = projectForm.querySelectorAll('.project-path-row button, .dialog-header button');
  buttons.forEach(function (button) { button.disabled = true; });
  clearProjectError();
  try {
    const result = await api('/api/project/select', { method: 'POST', body: { project: project } });
    state = result.state;
    updateProjectLabel();
    projectDialog.close();
    notify('已切换到 ' + state.ui.current.name);
    render();
  } catch (error) {
    showProjectError(error.message);
  } finally {
    buttons.forEach(function (button) { button.disabled = false; });
  }
}

function clearProjectError() {
  projectError.textContent = '';
  projectError.classList.add('hidden');
}

function showProjectError(message) {
  projectError.textContent = message;
  projectError.classList.remove('hidden');
  projectPath.focus();
}

function render() {
  if (!state) return;
  const titles = { overview: '总览', capabilities: '能力', inventory: '电脑库存', changes: '变更记录', settings: '设置' };
  title.textContent = titles[currentView];
  if (currentView === 'overview') renderOverview();
  if (currentView === 'capabilities') renderCapabilities();
  if (currentView === 'inventory') renderInventory();
  if (currentView === 'changes') renderChanges();
  if (currentView === 'settings') renderSettings();
}

function renderOverview() {
  const capabilities = state.context.capabilities;
  const ready = capabilities.filter(function (item) { return item.status.resolution === 'ready'; }).length;
  const managed = Object.values(state.inventory.tools || {}).filter(function (item) { return item.source === 'managed'; }).length;
  const requiredMissing = capabilities.filter(function (item) { return item.required && item.status.resolution !== 'ready'; });
  content.innerHTML =
    '<div class="summary-grid">' +
      metric('环境', state.doctor.healthy ? '健康' : '需处理') +
      metric('可用能力', ready + ' / ' + capabilities.length) +
      metric('托管工具', String(managed)) +
      metric('当前 Agent', state.context.agent.resolved) +
    '</div>' +
    '<section class="panel"><div class="panel-header"><div><p class="eyebrow">下一步</p><h2>环境建议</h2></div></div>' +
      (requiredMissing.length ? requiredMissing.map(function (item) {
        return '<div class="callout"><strong>' + escapeHtml(item.id) + ' 尚未满足</strong><p>Provider：' + escapeHtml(item.providerId || '未解析') + '</p>' + actionForCapability(item) + '</div>';
      }).join('') : '<div class="callout success"><strong>必需能力已满足</strong><p>Doctor 没有发现阻塞当前任务的问题。</p></div>') +
    '</section>' +
    '<section class="panel"><div class="panel-header"><div><p class="eyebrow">作用域</p><h2>项目与电脑状态已分离</h2></div></div>' +
      '<p>项目只保存能力意图和锁定版本；安装路径、健康状态和 Agent 绑定保存在本机。</p>' +
      '<div class="code">' + escapeHtml(state.context.project.root) + '</div></section>';
}

function renderCapabilities() {
  const rows = state.context.capabilities.map(function (item) {
    return '<div class="row"><div class="row-main"><strong>' + escapeHtml(item.id) + '</strong><span>' + (item.required ? '必需能力' : '可选能力') + '</span></div>' +
      '<div class="row-meta">' + status(item.status.resolution) + ' · ' + escapeHtml(item.providerId || '未解析') + '<br>安装 ' + escapeHtml(item.status.installation) + ' / 绑定 ' + escapeHtml(item.status.binding) + ' / 健康 ' + escapeHtml(item.status.health) + '</div>' +
      '<div class="row-actions">' + actionForCapability(item) + '</div></div>';
  }).join('');
  content.innerHTML = panel('能力解析', '状态来自项目意图、电脑库存和当前 Agent，不是其他 Agent 配置的并集。', '<div class="list">' + (rows || empty('尚未配置能力')) + '</div>');
}

function renderInventory() {
  const entries = Object.entries(state.inventory.tools || {});
  const rows = entries.map(function (pair) {
    const name = pair[0], item = pair[1];
    const actions = item.source === 'managed'
      ? '<button class="button secondary" data-action="update" data-tool="' + attr(name) + '">更新</button><button class="button danger" data-action="uninstall" data-tool="' + attr(name) + '">卸载</button>'
      : '<button class="button danger" data-action="uninstall" data-tool="' + attr(name) + '">移除登记</button>';
    return '<div class="row"><div class="row-main"><strong>' + escapeHtml(name) + '</strong><span>' + escapeHtml(item.providerId || name) + '</span></div>' +
      '<div class="row-meta">' + status(item.health || 'unverified') + ' · ' + escapeHtml(item.source || 'unknown') + ' · ' + escapeHtml(item.version || 'unknown') + '<br>' + escapeHtml(item.invocation && item.invocation.command || '') + '</div>' +
      '<div class="row-actions">' + actions + '</div></div>';
  }).join('');
  content.innerHTML = panel('电脑级工具库存', '同一 Windows 用户下的多个项目共享此库存。', '<div class="list">' + (rows || empty('当前没有机器级库存记录')) + '</div>');
}

function renderChanges() {
  const rows = (state.receipts || []).map(function (receipt) {
    return '<div class="row"><div class="row-main"><strong>' + escapeHtml(receipt.action + ' · ' + (receipt.tool || '')) + '</strong><span>' + escapeHtml(receipt.startedAt || '') + '</span></div>' +
      '<div class="row-meta">' + status(receipt.status) + ' · ' + escapeHtml(receipt.id || '') + (receipt.error ? '<br>' + escapeHtml(receipt.error.message) : '') + '</div><div></div></div>';
  }).join('');
  content.innerHTML = panel('事务回执', '每次真实变更都会留下成功、失败或回滚记录；不会记录凭据内容。', '<div class="list">' + (rows || empty('还没有变更记录')) + '</div>');
}

function renderSettings() {
  const agentRows = state.agents.map(function (agent) {
    const bound = agent.binding.status === 'bound';
    return '<div class="row"><div class="row-main"><strong>' + escapeHtml(agent.agentId) + '</strong><span>手工添加统一 context 规则</span></div>' +
      '<div class="row-meta">' + status(bound ? 'bound' : 'unbound') + ' · 发现 ' + agent.discovered.mcpServers.length + ' 个 MCP</div>' +
      '<div class="row-actions"><button class="button ' + (bound ? 'danger' : 'secondary') + '" data-action="agent-' + (bound ? 'unbind' : 'bind') + '" data-agent="' + attr(agent.agentId) + '">' + (bound ? '解除记录' : '确认已接入') + '</button></div></div>';
  }).join('');
  content.innerHTML =
    panel('应用更新', '仅在点击时连接 GitHub；下载前显示变更计划并校验安装包 SHA-256。',
      '<div class="row"><div class="row-main"><strong>AI ToolOps Manager</strong><span>当前版本 ' + escapeHtml(state.app.version) + '</span></div>' +
      '<div class="row-meta">稳定版 Release · 不后台检查</div><div class="row-actions"><button class="button secondary" data-action="check-release">检查更新</button></div></div>') +
    panel('Agent 接入', 'ToolOps 不擅自修改宿主规则。请手工添加下方一句，然后确认记录。', '<div class="code">' + escapeHtml(state.instruction) + '</div><div class="list" style="margin-top:16px">' + agentRows + '</div>') +
    panel('登记外部工具', '绝对路径只保存在本机库存，不进入项目 policy 或 lock。',
      '<form id="external-form" class="form-grid"><label>工具名称<input name="tool" required pattern="[a-zA-Z0-9_-]+"></label><label>可执行文件绝对路径<input name="path" required placeholder="C:\\\\Tools\\\\example.exe"></label><button class="button primary" type="submit">预览登记</button></form>');
}

function actionForCapability(item) {
  if (item.status.resolution === 'ready') return '<span class="status-line">' + status('ready') + '</span>';
  if (item.providerId === 'rg') return '<button class="button primary" data-action="install" data-tool="rg">预览安装</button>';
  return '<span class="row-meta">当前 Provider 仅检测，不执行安装</span>';
}

async function requestPlan(action, tool, agent, extra) {
  if (action === 'refresh') return loadState();
  try {
    const body = Object.assign({ action: action, tool: tool, agent: agent }, extra || {});
    const result = await api('/api/plan', { method: 'POST', body: body });
    currentPlanId = result.plan.id;
    currentPlanAction = result.plan.action;
    planPreview.textContent = JSON.stringify(result.plan, null, 2);
    dialog.showModal();
  } catch (error) {
    notify(error.message, true);
  }
}

async function checkRelease(button) {
  button.disabled = true;
  button.textContent = '正在检查…';
  try {
    const result = await api('/api/update/check', { method: 'POST', body: {} });
    if (result.release.status !== 'update-available') {
      notify(result.release.status === 'ahead-of-release'
        ? '当前版本 ' + result.release.currentVersion + ' 高于最新稳定版 ' + result.release.latestVersion
        : '当前已是最新版本 ' + result.release.currentVersion);
      return;
    }
    currentPlanId = result.plan.id;
    currentPlanAction = result.plan.action;
    planPreview.textContent = JSON.stringify(result.plan, null, 2);
    dialog.showModal();
  } catch (error) {
    notify(error.message, true);
  } finally {
    button.disabled = false;
    button.textContent = '检查更新';
  }
}

async function applyPlan() {
  if (!currentPlanId) return;
  applyButton.disabled = true;
  applyButton.textContent = '执行中…';
  try {
    await api('/api/apply', { method: 'POST', body: { planId: currentPlanId } });
    dialog.close();
    const isReleaseUpdate = currentPlanAction === 'release-update';
    notify(isReleaseUpdate ? '更新已安排；窗口关闭后将安装新版本，请稍后重新打开。' : '操作完成');
    currentPlanId = null;
    currentPlanAction = null;
    if (!isReleaseUpdate) await loadState();
  } catch (error) {
    notify(error.message, true);
  } finally {
    applyButton.disabled = false;
    applyButton.textContent = '确认执行';
  }
}

async function api(url, options) {
  const init = options || {};
  const response = await fetch(url, {
    method: init.method || 'GET',
    headers: Object.assign({ 'accept': 'application/json', 'x-ai-toolops-token': token }, init.body ? { 'content-type': 'application/json' } : {}),
    body: init.body ? JSON.stringify(init.body) : undefined
  });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || ('HTTP ' + response.status));
  return value;
}

function panel(heading, description, body) {
  return '<section class="panel"><div class="panel-header"><div><h2>' + escapeHtml(heading) + '</h2><p>' + escapeHtml(description) + '</p></div></div>' + body + '</section>';
}
function metric(label, value) { return '<div class="metric"><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(value) + '</strong></div>'; }
function empty(message) { return '<div class="empty">' + escapeHtml(message) + '</div>'; }
function status(value) { return '<span class="status-line"><span class="dot ' + attr(value) + '"></span>' + escapeHtml(value) + '</span>'; }
function setLoading(value) { loading.classList.toggle('hidden', !value); content.classList.toggle('hidden', value); content.setAttribute('aria-busy', String(value)); }
function notify(message, error) {
  toast.textContent = message;
  toast.classList.toggle('error', Boolean(error));
  toast.classList.add('visible');
  clearTimeout(notify.timer);
  notify.timer = setTimeout(function () { toast.classList.remove('visible'); }, 4500);
}
function escapeHtml(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]; }); }
function attr(value) { return escapeHtml(value).replace(/\\s/g, '-'); }`
