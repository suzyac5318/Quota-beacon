# 已知限制

- Codex 数据来自非公开只读接口，字段或认证方式可能变化。
- Windows 发布包未签名，可能触发 SmartScreen；macOS 使用 ad-hoc 签名但未公证，首次启动仍可能触发 Gatekeeper。
- macOS Universal 包由 GitHub Actions 的 `macos-latest` runner 构建，不能在 Windows 本机直接生成。
- 当前仅完成 Windows 11 实机验证；macOS 已完成 CI 双架构、签名和 DMG 自动校验，尚未完成真实 Mac 桌面交互验收。
- Claude provider 在 v1 中未启用。
- 重置机会只读取数量和到期时间，不能在应用内兑换。
- 真实额度准确性依赖 Codex 后端返回的窗口数据；应用不会根据本地 token 消耗自行估算额度。
- CSS 毛玻璃效果在 Windows WebView2 中对桌面背景的支持有限；当前设计优先保证透明圆角悬浮球的一致外观。
- 公开分发前建议补齐 Windows 代码签名、macOS Developer ID 签名和 notarization。
