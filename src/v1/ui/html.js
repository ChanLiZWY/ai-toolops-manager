export const UI_HTML = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <meta name="ai-toolops-token" content="__TOKEN__">
  <title>AI ToolOps Manager</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <a class="skip-link" href="#main">跳到主要内容</a>
  <div class="shell">
    <aside class="sidebar" aria-label="主导航">
      <div class="brand">
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5zM12 3v18M4 7.5l8 4.5 8-4.5"/></svg>
        <div><strong>AI ToolOps</strong><span>Windows v1</span></div>
      </div>
      <nav id="nav">
        <button class="nav-item active" data-view="overview"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/></svg><span>总览</span></button>
        <button class="nav-item" data-view="capabilities"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m12 3 2.2 4.5L19 8.2l-3.5 3.4.8 4.8-4.3-2.3-4.3 2.3.8-4.8L5 8.2l4.8-.7z"/></svg><span>能力</span></button>
        <button class="nav-item" data-view="inventory"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h16v12H4zM7 4h10v3M8 11h8M8 15h5"/></svg><span>电脑库存</span></button>
        <button class="nav-item" data-view="changes"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5"/></svg><span>变更记录</span></button>
        <button class="nav-item" data-view="settings"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM19 12l2-1-2-3-2 .5-1.5-1L15 5h-6l-.5 2.5-1.5 1L5 8l-2 3 2 1v2l-2 1 2 3 2-.5 1.5 1L9 21h6l.5-2.5 1.5-1 2 .5 2-3-2-1z"/></svg><span>设置</span></button>
      </nav>
      <button id="theme-toggle" class="theme-toggle" type="button"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20 15.5A8 8 0 0 1 8.5 4 8 8 0 1 0 20 15.5z"/></svg><span>切换主题</span></button>
    </aside>
    <main id="main" tabindex="-1">
      <header class="topbar">
        <div>
          <p class="eyebrow">本地环境</p>
          <h1 id="page-title">总览</h1>
        </div>
        <div class="top-actions">
          <button id="project-button" class="project-trigger" type="button" aria-haspopup="dialog">
            <span class="project-trigger-copy"><small>当前项目</small><strong id="project-label">正在读取…</strong></span>
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m8 10 4 4 4-4"/></svg>
          </button>
          <span id="agent-label" class="agent-label">Agent: …</span>
          <button id="refresh" class="button secondary" type="button">刷新状态</button>
        </div>
      </header>
      <div id="loading" class="loading" role="status">正在读取本地状态…</div>
      <section id="content" aria-busy="true"></section>
    </main>
  </div>
  <dialog id="plan-dialog" aria-labelledby="plan-title">
    <form method="dialog" class="dialog-card">
      <div class="dialog-header">
        <div><p class="eyebrow">操作预览</p><h2 id="plan-title">确认变更</h2></div>
        <button class="icon-button" value="cancel" aria-label="关闭确认窗口">×</button>
      </div>
      <p>请核对写入位置、网络访问和外部进程。确认后才会执行。</p>
      <pre id="plan-preview" tabindex="0"></pre>
      <div class="dialog-actions">
        <button class="button secondary" value="cancel">取消</button>
        <button id="apply-plan" class="button primary" value="default" type="button">确认执行</button>
      </div>
    </form>
  </dialog>
  <dialog id="project-dialog" aria-labelledby="project-title">
    <form id="project-form" class="dialog-card">
      <div class="dialog-header">
        <div><p class="eyebrow">项目上下文</p><h2 id="project-title">切换项目</h2></div>
        <button class="icon-button" type="button" data-close-project aria-label="关闭项目选择窗口">×</button>
      </div>
      <p>选择已运行 <code>ai-toolops init</code> 的项目目录。切换只改变当前 UI，不修改项目或 Agent 配置。</p>
      <label for="project-path">项目目录</label>
      <div class="project-path-row">
        <input id="project-path" name="project" required autocomplete="off" spellcheck="false">
        <button id="browse-project" class="button secondary" type="button">浏览…</button>
        <button class="button primary" type="submit">打开项目</button>
      </div>
      <p id="project-error" class="field-error hidden" role="alert"></p>
      <div class="recent-heading">
        <h3>最近项目</h3>
        <span>最多保留 8 个</span>
      </div>
      <div id="recent-projects" class="recent-projects"></div>
    </form>
  </dialog>
  <div id="toast" class="toast" role="status" aria-live="polite" aria-atomic="true"></div>
  <script type="module" src="/app.js"></script>
</body>
</html>`
