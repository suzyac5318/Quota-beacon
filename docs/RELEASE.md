# 发布说明

## 当前发布目标

Quota Beacon 使用同一套 React/CSS/Tauri 代码构建 Windows 和 macOS 版本。视觉效果、悬浮球、展开卡片、透明度、圆角和动画参数都应保持在共享前端代码中，避免维护 Windows/macOS 两套 UI。

当前发布默认输出：

- `quota-beacon-windows-unsigned.zip`
- `quota-beacon-macos-universal-ad-hoc.zip`
- macOS Universal `.dmg`
- `quota-beacon-macos-universal-ad-hoc.sha256`

macOS 包使用 Universal 构建，同时支持 Apple Silicon 和 Intel Mac，并使用无需付费账号的 ad-hoc 签名。ad-hoc 签名可保证应用包内代码签名结构完整，但不能替代 Apple Developer ID 签名和公证。

## 发布一个 GitHub 下载版本

推送 `v*` tag 会触发 `.github/workflows/release.yml`，构建 Windows unsigned 包和 macOS Universal ad-hoc 签名包，并上传到 GitHub Release。

```bash
git tag v1.0.0
git push origin v1.0.0
```

工作流完成后，到 GitHub Releases 检查草稿发布，确认说明和附件后手动发布。

## CI 与构建

`.github/workflows/ci.yml` 会在 push/PR 时执行：

- 前端测试、前端构建、npm audit。
- Windows 桌面测试和 Tauri build。
- macOS 桌面测试和 Tauri Universal build。

macOS CI/release 会显式安装：

- `aarch64-apple-darwin`
- `x86_64-apple-darwin`

并使用：

```bash
npm run tauri -- build --target universal-apple-darwin
```

macOS 构建完成后，`.github/scripts/verify-macos-bundle.sh` 会自动检查：

- `.app` 的严格递归代码签名完整性和 ad-hoc 签名身份。
- 主可执行文件同时包含 `arm64` 与 `x86_64`。
- DMG 文件结构可以通过 `hdiutil verify`。
- 为发布 DMG 生成 SHA-256 校验文件。

## macOS ad-hoc 包使用说明

因为当前 macOS 包没有付费 Developer ID 签名和 Apple 公证，首次打开时 Gatekeeper 仍可能阻止启动：

1. 下载 `.dmg`，并可用同一 Release 中的 `.sha256` 文件核对下载完整性。
2. 打开 DMG，将 Quota Beacon 拖入 Applications。
3. 在 Applications 中右键点击 Quota Beacon，选择 Open。
4. 在系统提示中再次选择 Open；以后即可正常双击启动。

如果系统仍然阻止，到 System Settings -> Privacy & Security，在安全提示旁选择 Open Anyway。不要关闭系统全局 Gatekeeper。

## 签名与公证

当前 ad-hoc 包适合免费开源分发，但无法消除首次运行确认。若未来需要无此提示的公开分发，应补齐：

- Windows：代码签名证书，避免 SmartScreen 或未知发布者提示。
- macOS：Apple Developer ID Application 证书、Team ID、app-specific password，并完成 notarization。
- CI：将证书、密码和 Team ID 放入 GitHub Secrets，再在 release workflow 中加入签名和公证步骤。

证书和账号凭据不能由代码仓库生成，需要由项目所有者购买、申请或配置。免费 Apple ID 的开发证书不适合长期公开分发，也不能用于公证。

## 跨平台维护原则

- 后续效果调整默认只改共享前端代码。
- 平台差异只放在桌面壳层，例如托盘、置顶、拖动、点击穿透、开机启动。
- 不默认启用原生窗口级 Acrylic/Vibrancy；它会作用于整个窗口矩形，不符合只让圆角悬浮球卡片产生毛玻璃效果的设计目标。
- Codex 登录态读取继续使用 `CODEX_HOME` 或用户目录 `.codex/auth.json`，Windows/macOS 共用同一逻辑。
