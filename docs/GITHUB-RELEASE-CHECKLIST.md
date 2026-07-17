# GitHub 发布与分享清单

## 需要提前安装或准备什么

本机 Windows 不需要安装 macOS 构建工具，也不能直接构建 macOS 安装包。macOS 包由 GitHub Actions 的 `macos-latest` runner 构建。

本机需要：

- Git
- Node.js 20+
- Rust stable
- npm 依赖已安装

GitHub 需要：

- 一个 GitHub 仓库
- GitHub Actions 已启用
- 代码已推送到默认分支

macOS Universal 构建需要的 Rust targets 已经在 CI/release workflow 中自动安装：

```bash
rustup target add aarch64-apple-darwin x86_64-apple-darwin
```

你不需要在 Windows 本机安装这两个 target。

## 第一次上传到 GitHub

当前 `upstream` 只用于读取衍生项目的上游历史，绝不可推送。`origin` 应指向 `suzyac5318/Quota-beacon`。首次只推送主分支，不使用 `--follow-tags`，避免所有历史版本标签同时触发 Release：

```bash
git remote add origin https://github.com/suzyac5318/Quota-beacon.git
git branch -M main
git push -u origin main
```

后续版本完成后，更新 `VERSION`、各构建配置和 `CHANGELOG.md`，创建版本化提交和标签，再推送：

```bash
git add <expected-files>
git commit -m "v1.5.2: update GitHub Actions runtime"
git tag -a v1.5.2 -m "Quota Beacon v1.5.2"
git push origin main
git push origin v1.5.2
```

## 生成可分享版本

推送 `v*` tag 会触发 release workflow：

```bash
git tag -a v1.5.2 -m "Quota Beacon v1.5.2"
git push origin v1.5.2
```

构建完成后，到 GitHub 仓库的 Releases 页面检查草稿 release。附件应包含：

- `quota-beacon-windows-unsigned.zip`
- `quota-beacon-macos-universal-ad-hoc.zip`
- macOS Universal `.dmg`
- `quota-beacon-macos-universal-ad-hoc.sha256`

确认 Windows 与 macOS 附件、SHA-256 和自动生成的说明无误后再发布草稿。不要在任一平台构建失败时提前公开 Release；如发现问题，应保留失败记录并发布修复版本。

首次公开仓库还应确认：

- `main` 分支规则和必需状态检查已启用。
- Dependabot、依赖漏洞警报、secret scanning 与 push protection 已启用。
- About 描述、Topics、Issues 和 Social Preview 已配置。
- Private vulnerability reporting 已启用。

## 发给 Mac 用户时的说明

当前 macOS 包是 ad-hoc 签名、未公证的包。用户首次打开可能会被 Gatekeeper 拦截，可以这样打开：

1. 下载 `.dmg`，需要时用同一 Release 的 `.sha256` 核对完整性。
2. 打开 DMG，把应用拖到 Applications。
3. 在 Applications 中右键点击应用，选择 Open，并在系统提示里再次选择 Open。
4. 如果仍被拦截，到 System Settings -> Privacy & Security 选择 Open Anyway。

## 以后公开分发还需要什么

如果要面向非技术用户公开分发，建议补：

- Windows 代码签名证书。
- Apple Developer ID Application 证书。
- Apple Team ID。
- Apple app-specific password。
- GitHub Secrets 中的签名和公证配置。

这些账号、证书和密码不能由代码生成，需要项目所有者申请或购买。
