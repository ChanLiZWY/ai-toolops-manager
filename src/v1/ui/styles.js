export const UI_CSS = `:root {
  color-scheme: light;
  --bg: #f4f6f8;
  --surface: #ffffff;
  --surface-muted: #f8fafc;
  --text: #172033;
  --text-muted: #526075;
  --border: #d8dee8;
  --primary: #2457d6;
  --primary-hover: #1746bc;
  --primary-text: #ffffff;
  --success: #16794b;
  --success-bg: #e9f7ef;
  --warning: #946200;
  --warning-bg: #fff5d8;
  --danger: #b42318;
  --danger-bg: #fff0ee;
  --focus: #0a66ff;
  --shadow: 0 8px 24px rgba(31, 42, 68, .07);
  --sidebar-bg: #111827;
  --sidebar-text: #f8fafc;
  --sidebar-muted: #9ca8ba;
  --sidebar-active: #2563eb;
  --sidebar-hover: rgba(255, 255, 255, .08);
  --radius: 12px;
  --sidebar: 232px;
  font-family: "Segoe UI Variable", "Segoe UI", system-ui, sans-serif;
}

[data-theme="dark"] {
  color-scheme: dark;
  --bg: #10141c;
  --surface: #181e29;
  --surface-muted: #202735;
  --text: #f2f5f9;
  --text-muted: #b8c1ce;
  --border: #394354;
  --primary: #7aa2ff;
  --primary-hover: #9ab8ff;
  --primary-text: #0b1735;
  --success: #76d5a4;
  --success-bg: #173729;
  --warning: #ffd16a;
  --warning-bg: #3c3017;
  --danger: #ff9b91;
  --danger-bg: #44221f;
  --focus: #8db4ff;
  --shadow: 0 12px 32px rgba(0, 0, 0, .28);
  --sidebar-bg: #090e19;
  --sidebar-muted: #aeb9ca;
  --sidebar-active: #356ee6;
}

* { box-sizing: border-box; }
html { overflow-x: hidden; background: var(--bg); }
body { margin: 0; min-width: 320px; min-height: 100vh; overflow-x: hidden; background: var(--bg); color: var(--text); font-size: 15px; line-height: 1.5; }
button, input { font: inherit; }
button { cursor: pointer; }
button:focus-visible, input:focus-visible, pre:focus-visible, [tabindex]:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; }
.skip-link { position: fixed; top: 8px; left: 8px; z-index: 100; padding: 10px 14px; color: var(--primary-text); background: var(--primary); border-radius: 8px; transform: translateY(-150%); }
.skip-link:focus { transform: translateY(0); }
.shell { min-height: 100vh; display: grid; grid-template-columns: var(--sidebar) 1fr; }
.sidebar { position: sticky; top: 0; height: 100vh; padding: 22px 14px 16px; border-right: 1px solid rgba(255, 255, 255, .08); background: var(--sidebar-bg); color: var(--sidebar-text); display: flex; flex-direction: column; gap: 28px; }
.brand { display: flex; align-items: center; gap: 12px; padding: 0 8px; }
.brand svg { width: 32px; height: 32px; fill: none; stroke: #60a5fa; stroke-width: 1.8; }
.brand strong, .brand span { display: block; }
.brand span { color: var(--sidebar-muted); font-size: 12px; }
nav { display: grid; gap: 7px; }
.nav-item, .theme-toggle { min-height: 44px; border: 0; border-radius: 9px; padding: 0 12px; color: var(--sidebar-muted); background: transparent; text-align: left; transition: background-color 160ms ease, color 160ms ease; }
.nav-item { display: flex; align-items: center; gap: 11px; }
.nav-item svg, .theme-toggle svg { width: 19px; height: 19px; flex: 0 0 auto; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.7; }
.nav-item:hover, .theme-toggle:hover { background: var(--sidebar-hover); color: var(--sidebar-text); }
.nav-item.active { background: var(--sidebar-active); color: #fff; font-weight: 650; box-shadow: 0 7px 18px rgba(37, 99, 235, .24); }
.theme-toggle { margin-top: auto; border: 1px solid rgba(255, 255, 255, .14); display: flex; align-items: center; justify-content: center; gap: 9px; color: var(--sidebar-muted); }
main { min-width: 0; padding: 28px 32px 56px; }
.topbar { width: 100%; max-width: 1180px; margin: 0 auto 24px; display: flex; align-items: center; justify-content: space-between; gap: 20px; }
.topbar h1 { margin: 2px 0 0; font-size: 28px; line-height: 1.2; letter-spacing: -.02em; }
.eyebrow { margin: 0; color: var(--text-muted); font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.top-actions { display: flex; align-items: center; gap: 12px; }
.project-trigger { min-height: 48px; max-width: 320px; border: 1px solid var(--border); border-radius: 10px; padding: 6px 9px 6px 12px; color: var(--text); background: var(--surface); display: flex; align-items: center; gap: 10px; text-align: left; box-shadow: 0 3px 12px rgba(31, 42, 68, .05); transition: background-color 160ms ease, border-color 160ms ease; }
.project-trigger:hover { border-color: var(--primary); background: var(--surface-muted); }
.project-trigger-copy { min-width: 0; flex: 1; }
.project-trigger small, .project-trigger strong { display: block; }
.project-trigger small { color: var(--text-muted); font-size: 11px; font-weight: 500; }
.project-trigger strong { overflow: hidden; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.project-trigger > svg { width: 18px; height: 18px; flex: 0 0 auto; fill: none; stroke: var(--text-muted); stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.8; }
.agent-label { color: var(--text-muted); font-family: Consolas, monospace; font-size: 13px; }
#content, .loading { width: 100%; max-width: 1180px; margin: 0 auto; }
.loading { min-height: 160px; display: grid; place-items: center; color: var(--text-muted); }
.hidden { display: none !important; }
.summary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin-bottom: 20px; }
.metric, .panel { border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); box-shadow: var(--shadow); }
.metric { padding: 18px; }
.metric span { display: block; color: var(--text-muted); font-size: 13px; }
.metric strong { display: block; margin-top: 8px; font-size: 25px; font-variant-numeric: tabular-nums; }
.panel { padding: 20px; margin-bottom: 18px; }
.panel-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.panel h2 { margin: 0; font-size: 18px; }
.panel p { color: var(--text-muted); }
.status-line { display: flex; align-items: center; gap: 8px; }
.dot { width: 9px; height: 9px; border-radius: 50%; background: var(--text-muted); flex: 0 0 auto; }
.dot.ready, .dot.healthy, .dot.bound, .dot.succeeded { background: var(--success); }
.dot.missing, .dot.degraded, .dot.warning, .dot.unbound { background: var(--warning); }
.dot.blocked, .dot.broken, .dot.failed, .dot.rolled_back { background: var(--danger); }
.list { display: grid; gap: 1px; border: 1px solid var(--border); border-radius: 10px; overflow: hidden; background: var(--border); }
.row { min-width: 0; padding: 14px 16px; background: var(--surface); display: grid; grid-template-columns: minmax(180px, 1.4fr) minmax(140px, 1fr) auto; align-items: center; gap: 16px; }
.row-main strong, .row-main span { display: block; }
.row-main span, .row-meta { color: var(--text-muted); font-size: 13px; overflow-wrap: anywhere; }
.row-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
.button { min-height: 40px; border-radius: 8px; border: 1px solid transparent; padding: 0 14px; font-weight: 650; transition: background-color 160ms ease, border-color 160ms ease, opacity 160ms ease; }
.button:disabled { cursor: not-allowed; opacity: .5; }
.button.primary { color: var(--primary-text); background: var(--primary); }
.button.primary:hover:not(:disabled) { background: var(--primary-hover); }
.button.secondary { color: var(--text); border-color: var(--border); background: var(--surface); }
.button.secondary:hover:not(:disabled) { background: var(--surface-muted); }
.button.danger { color: var(--danger); border-color: color-mix(in srgb, var(--danger) 40%, var(--border)); background: var(--danger-bg); }
.callout { border-left: 4px solid var(--warning); background: var(--warning-bg); padding: 12px 14px; border-radius: 8px; color: var(--text); }
.callout.success { border-color: var(--success); background: var(--success-bg); }
.empty { padding: 26px; text-align: center; color: var(--text-muted); }
.code { padding: 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-muted); font-family: Consolas, monospace; overflow-wrap: anywhere; }
.form-grid { display: grid; grid-template-columns: 1fr 2fr auto; gap: 12px; align-items: end; }
label { display: grid; gap: 6px; color: var(--text-muted); font-size: 13px; }
input { min-height: 44px; width: 100%; border: 1px solid var(--border); border-radius: 8px; padding: 0 12px; color: var(--text); background: var(--surface); }
dialog { width: min(720px, calc(100vw - 32px)); max-height: calc(100vh - 32px); border: 0; border-radius: 14px; padding: 0; color: var(--text); background: var(--surface); box-shadow: 0 24px 80px rgba(0, 0, 0, .32); }
dialog::backdrop { background: rgba(5, 10, 20, .58); }
.dialog-card { padding: 22px; }
.dialog-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.dialog-header h2 { margin: 2px 0 0; }
.icon-button { width: 44px; height: 44px; border: 1px solid var(--border); border-radius: 8px; color: var(--text); background: var(--surface); font-size: 24px; }
pre { max-height: 48vh; overflow: auto; padding: 14px; border: 1px solid var(--border); border-radius: 8px; color: var(--text); background: var(--surface-muted); font: 12px/1.55 Consolas, monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
.dialog-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }
.project-path-row { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 10px; align-items: center; margin-top: 6px; }
.field-error { margin: 8px 0 0; color: var(--danger); font-size: 13px; }
.recent-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-top: 24px; }
.recent-heading h3 { margin: 0; font-size: 15px; }
.recent-heading span { color: var(--text-muted); font-size: 12px; }
.recent-projects { display: grid; gap: 8px; margin-top: 10px; }
.recent-project { min-height: 56px; width: 100%; border: 1px solid var(--border); border-radius: 9px; padding: 9px 12px; color: var(--text); background: var(--surface); text-align: left; transition: background-color 160ms ease, border-color 160ms ease; }
.recent-project:hover:not(:disabled) { border-color: var(--primary); background: var(--surface-muted); }
.recent-project:disabled { cursor: not-allowed; opacity: .55; }
.recent-project strong, .recent-project span, .recent-project small { display: block; }
.recent-project span { color: var(--text-muted); font: 12px/1.45 Consolas, monospace; overflow-wrap: anywhere; }
.recent-project small { margin-top: 3px; color: var(--warning); }
.toast { position: fixed; right: 20px; bottom: 20px; z-index: 120; max-width: min(420px, calc(100vw - 40px)); padding: 12px 16px; border: 1px solid var(--border); border-radius: 10px; color: var(--text); background: var(--surface); box-shadow: var(--shadow); opacity: 0; pointer-events: none; transition: opacity 160ms ease; }
.toast.visible { opacity: 1; }
.toast.error { border-color: var(--danger); background: var(--danger-bg); }

@media (max-width: 900px) {
  :root { --sidebar: 196px; }
  main { padding-inline: 20px; }
  .top-actions { flex-wrap: wrap; justify-content: flex-end; }
  .summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .row { grid-template-columns: 1fr auto; }
  .row-meta { grid-column: 1; }
}

@media (max-width: 640px) {
  .shell { display: block; }
  .sidebar { position: static; width: auto; height: auto; padding: 12px; border-right: 0; border-bottom: 1px solid var(--border); gap: 12px; }
  .brand { margin-bottom: 4px; }
  nav { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); overflow: visible; padding-bottom: 0; }
  .nav-item { min-width: 0; padding-inline: 6px; justify-content: center; text-align: center; white-space: nowrap; }
  .nav-item svg { display: none; }
  .theme-toggle { margin-top: 0; }
  main { padding: 20px 14px 44px; }
  .topbar { display: block; }
  .top-actions { width: 100%; margin-top: 16px; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; }
  .project-trigger { width: 100%; max-width: none; grid-column: 1 / -1; }
  .summary-grid { grid-template-columns: 1fr 1fr; }
  .row { grid-template-columns: 1fr; }
  .row-actions { justify-content: flex-start; }
  .form-grid { grid-template-columns: 1fr; }
  .project-path-row { grid-template-columns: 1fr 1fr; }
  .project-path-row input { grid-column: 1 / -1; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior: auto !important; transition-duration: .01ms !important; animation-duration: .01ms !important; animation-iteration-count: 1 !important; }
}`
