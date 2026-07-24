# Windows v1.1 P0 验证报告

验证时间：2026-07-24

## 已通过

- `npm run check`
- `npm test`：21/21
- `npm run build:windows`
- `npm run smoke:windows`
- `dist\ai-toolops.exe --version`：`1.1.0`
- 安装器：静默安装、覆盖安装、开始菜单快捷方式、桌面快捷方式、卸载注册和卸载清理
- UI：SEA 启动、token 防护、非本机会话 URL 拒绝、重复启动复用、同时启动端口竞争恢复、项目转发
- 更新：默认状态零网络、GitHub Latest Release 实际读取、版本比较、摘要校验、失败清理、`scheduled → succeeded/failed` 延迟回执、事务计划和 UI 加载/成功反馈
- 当前实机：Windows 11 专业版 64-bit，版本 `10.0.26200`
- CI 定义：`windows-2022`、`windows-2025` 两个 GitHub Hosted Runner
- 工作流 YAML 和 Authenticode PowerShell 脚本语法检查

## 明确未通过或未执行

- 当前机器没有 Authenticode 证书；本地产物状态为 `NotSigned`。签名脚本和 Release 机密入口已具备，但不能将钩子存在描述为签名完成。
- 没有 Windows 10 实机，因此本报告不宣称 Windows 10 实机通过。发布前仍应在一台 Windows 10 x64 普通用户环境执行安装和更新冒烟。
- GitHub Hosted Runner 是 Windows Server，不替代 Windows 10/11 客户端实机结论。

## 产物

- `dist\ai-toolops.exe`
- `dist\ai-toolops-setup.exe`

Release 工作流只上传 `ai-toolops-setup.exe`。GitHub 自动生成的 Source code ZIP/TAR 不属于项目上传的安装资产。
