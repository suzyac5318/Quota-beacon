# Quota Beacon

Quota Beacon 是一款独立维护、local-first 的 Tauri 桌面悬浮工具。它在本机读取已有 Codex Desktop 登录状态，以清晰的悬浮卡片展示真实额度、重置时间、本机 Token 汇总和可定制的额度主题。

> 当前版本：`1.5.0`

## 主要功能

- 展示 5 小时额度、周额度与下一次重置时间；不根据本地数据猜测额度。
- 空闲时折叠为悬浮球，悬停后展开；支持拖动、置顶、托盘控制和锁定。
- 每 10 秒刷新真实额度；异常时显示不可用或旧数据状态，而不是伪造数值。
- 提供 101 级连续颜色主题、色彩预览、调色盘编辑和可访问的键盘交互。
- 汇总本机 Codex 会话 Token 使用量，并在已打开的 Codex 窗口中显示当前对话 Token 浮层。
- 不包含遥测、分析或第三方追踪。

## 工作方式与隐私边界

Quota Beacon 只使用本机既有的 Codex Desktop 登录状态，向相应额度服务发起只读查询。它不会兑换重置机会、修改账户设置，也不会持久化 token、账号 ID、提示词、聊天内容、原始额度响应或本机认证路径。

浏览器预览使用 mock 数据；真实额度读取仅能在同一台已登录 Codex Desktop 的 Tauri 桌面环境验证。详细说明见 [PRIVACY.md](PRIVACY.md) 与 [SECURITY.md](SECURITY.md)。

## 开发

前置条件：Node.js 20+、Rust stable，以及目标平台所需的 Tauri 2 系统依赖。

```bash
npm install
npm run test
npm run build
npm run tauri dev
```

## 构建与发布

```bash
npm run tauri build
```

GitHub Actions 会在 push/PR 时执行测试和构建；推送 `v*` 标签时会生成 Windows unsigned 包和 macOS Universal ad-hoc 签名包。macOS 包无需付费开发者账号，但首次启动仍需用户在 Gatekeeper 中确认。仓库地址创建后，再在 [docs/GITHUB-RELEASE-CHECKLIST.md](docs/GITHUB-RELEASE-CHECKLIST.md) 中完成连接与首次发布。

不要提交本机凭据、`.codex`、`.env*`、个人截图、`node_modules`、构建输出或安装包。

## 衍生项目与许可证

Quota Beacon 是基于上游开源项目衍生并独立维护的项目。上游来源、当前贡献边界与许可要求见 [UPSTREAM-NOTICE.md](UPSTREAM-NOTICE.md)。

本项目保留 MIT License，详见 [LICENSE](LICENSE)。
