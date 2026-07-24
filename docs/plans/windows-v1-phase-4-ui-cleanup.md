# AI ToolOps Manager Windows v1 Phase 4 可执行计划

## 0. 执行规则

1. UI 调用 Phase 1-3 的应用服务，不复制业务逻辑。
2. 写接口只绑定 `127.0.0.1`，要求会话 token；ActionPlan 必须由服务器生成并缓存。
3. 所有危险操作先显示计划，再由用户确认。
4. 使用原生 HTML/CSS/ESM 和系统字体，不依赖 CDN、React、在线图标或营销动画。
5. 旧规则生成、Skill 使用统计和伪安装 UI 从运行时代码删除。

## 1. 当前进度

```yaml
phase_id: phase-4
status: done
last_completed_task: phase-4.task-5
next_task: null
blocked: false
block_reason: null
```

## 2. UI 设计决策

- 导航：总览、能力、电脑库存、变更记录、设置。
- 风格：Windows 运维工具；中等密度；浅色/深色语义 token；系统 UI 字体。
- 反馈：加载状态、按钮禁用、内联错误、`aria-live` 成功/失败消息、原生 dialog。
- 响应式：375/768/1024/1440px，无横向滚动。
- 动效：仅 opacity/color，150-200ms；尊重 `prefers-reduced-motion`。
- 删除：Skill 分类/次数、场景切换、装备拖拽、安装提示词、重复状态徽章。

## 3. 任务

- [x] phase-4.task-1：加载 `ui-ux-pro-max`、查询设计系统并创建本计划。
- [x] phase-4.task-2：实现本地 UI server、只读 state API 和 token 保护。
- [x] phase-4.task-3：实现五个页面、ActionPlan 确认和真实操作 API。
- [x] phase-4.task-4：删除旧运行时、旧测试和重复生成逻辑，重写 README。
- [x] phase-4.task-5：完成自动化、分发、响应式和可访问性验收。

## 4. 验收

- [x] UI 主要按钮执行真实计划或操作。
- [x] 无 token 写请求返回 403。
- [x] HTML 具备 skip link、语义导航、dialog、aria-live、可见焦点和 reduced-motion。
- [x] 独立 EXE 内嵌并能启动 UI。
- [x] 新项目运行时不生成旧 JSON/Markdown/UI 缓存。

## 5. 不做事项

- 不做 Skill 商店、图表、遥测、登录、云同步和移动 App。
- 不把 UI 资源写入项目。
- 不自动执行安装或卸载。

## 6. 中断恢复

UI 可单独回退到 CLI；删除旧模块前必须先通过 v1 UI/API 测试和 SEA 构建。

## 7. 执行记录

| 时间 | 任务 | 结果 |
|---|---|---|
| 2026-07-24 | phase-4.task-1 | 已加载 UI Skill；采用无障碍/反馈规范，拒绝 Landing/夸张极简建议 |
| 2026-07-24 | phase-4.task-2..3 | 完成本地 UI server、token API、五个页面和服务器缓存 ActionPlan |
| 2026-07-24 | phase-4.task-4 | 删除旧运行时、插件清单、伪 UI 和过期测试；重写 README 与验收说明 |
| 2026-07-24 | phase-4.task-5 | 11/11 测试、SEA 构建与 UI 冒烟通过；完成 1440/375px 可视检查并修复小屏导航 |

## 8. 变更记录

| 时间 | 内容 | 原因 |
|---|---|---|
| 2026-07-24 | 初始化 Phase 4 计划 | 开始真实本地 UI 和旧功能清理 |
| 2026-07-24 | Phase 4 完成 | UI、运行时和文档已统一到 Windows v1 |
