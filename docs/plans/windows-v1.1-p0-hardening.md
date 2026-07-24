# AI ToolOps Manager Windows v1.1 P0 加固计划

## 状态

```yaml
phase_id: windows-v1.1-p0
status: completed
last_completed_task: p0.task-5
next_task: null
blocked: false
last_updated: 2026-07-24
```

## 已锁定边界

- 继续只支持 Windows 10/11 x64 当前用户安装。
- 默认不联网；只有用户显式执行“检查更新”或更新命令时访问 GitHub。
- Release 面向普通用户只发布 `ai-toolops-setup.exe`。
- 自动更新下载安装器、验证 GitHub Release 资产 SHA-256，再由父进程退出后的 helper 执行覆盖升级。
- UI 重复启动优先复用已有本地服务，并将显式 `--project` 请求转发给现有实例。
- 不在没有稳定来源、版本和校验契约时新增可执行 Provider。
- 代码签名使用可选发布机密；没有证书时明确保留未签名状态，不伪造签名成功。

## 任务

- [x] p0.task-1：实现 UI 单实例会话。
  - 输出：电脑级会话记录、存活验证、显式项目切换转发、过期会话恢复。
  - 验收：连续启动两次只保留一个监听进程；第二次启动能打开已有 UI。
  - 回滚：删除会话模块并恢复直接 `startUiServer`。

- [x] p0.task-2：实现 Release 更新发现和安装器更新事务。
  - 输出：版本比较、GitHub Latest Release 读取、资产 digest 校验、更新 helper、CLI 和 UI 入口。
  - 验收：默认状态读取不联网；显式检查能区分最新、可更新和无效发布；失败后旧程序仍可启动。
  - 回滚：保留原有 `update self --source` 手工更新入口。

- [x] p0.task-3：增加 CI、自动 Release 和签名预留。
  - 输出：Windows CI、Tag Release 工作流、可选 Authenticode 签名脚本。
  - 验收：无证书时仍能构建但明确未签名；有证书机密时安装包可验证签名；Release 只上传安装器。
  - 回滚：工作流可独立禁用，不影响本地构建。

- [x] p0.task-4：Provider 扩展评审。
  - 输出：候选工具的来源、版本、校验、许可和用户价值结论。
  - 验收：不为了数量增加与 PowerShell/现有工具重复或无法可靠校验的 Provider。
  - 回滚：不满足门槛时保持只有 `rg` 可执行 Provider。

- [x] p0.task-5：全量验证与 Windows 实机回归。
  - 输出：自动测试、SEA 构建、安装器冒烟、单实例和更新模拟报告。
  - 验收：现有 11 项测试不回退；新测试覆盖更新失败和重复启动。

## 执行记录

| 时间 | 任务 | 结果 |
|---|---|---|
| 2026-07-24 | 创建 v1.1 P0 计划 | 开始单实例、自动更新和发布加固 |
| 2026-07-24 | p0.task-1 | UI 会话支持存活验证、实例复用和显式项目转发 |
| 2026-07-24 | p0.task-2 | 增加显式 Release 检查、GitHub digest 校验和退出后安装 helper |
| 2026-07-24 | p0.task-3 | 增加双 Windows Runner CI、Tag Release 和可选 Authenticode 签名 |
| 2026-07-24 | p0.task-4 | 评审后不为数量新增 Provider；Semble/AskHuman 保持检测 |
| 2026-07-24 | p0.task-5 | 21 项测试、SEA/安装器冒烟和 Windows 11 实机通过；更新延迟回执、签名与 Windows 10 实机限制已明确记录 |
