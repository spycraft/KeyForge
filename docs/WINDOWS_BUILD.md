# KeyForge Windows 安装包构建指南

## 系统要求

### 构建环境
- **操作系统**: Windows 10 1803+ 或 Windows 11
- **Rust**: stable 工具链 (x86_64-pc-windows-msvc 目标)
- **Node.js**: 18+ (推荐 20 LTS)
- **Microsoft Visual C++ Build Tools** (随 Visual Studio Build Tools 安装)
- **WebView2**: Windows 10/11 通常预装，未预装时安装包会自动引导安装

### 目标系统（运行环境）
- Windows 10 (1803+) / Windows 11
- 无需额外安装任何运行环境（WebView2 引导程序已内嵌）

## 本地构建步骤

### 1. 安装依赖

```powershell
# 安装 Rust
winget install Rustlang.Rustup

# 添加 Windows 目标
rustup target add x86_64-pc-windows-msvc

# 安装 Node.js 依赖
npm ci
```

### 2. 构建 NSIS 安装包

```powershell
# 使用 Tauri CLI 构建（推荐）
npm run tauri build

# 或指定目标
npm run tauri build -- --target x86_64-pc-windows-msvc
```

### 3. 获取安装包

构建完成后，安装包位于：

```
src-tauri/target/release/bundle/nsis/KeyForge_0.1.0_x64-setup.exe
```

## CI 自动构建

项目已配置 GitHub Actions 工作流 `.github/workflows/build-windows.yml`：

- **手动触发**: 在 GitHub 仓库 Actions 页面手动运行
- **自动触发**: 推送到 `main`/`release` 分支或创建 `v*` 标签时自动构建
- **产物**: 构建完成后在 Actions 页面下载 artifact，或作为 Release 资产发布

### 触发 Release 构建

```bash
# 创建并推送标签触发 Release 构建
git tag v0.1.0
git push origin v0.1.0
```

## 安装包特性

### 安装向导
- 多语言支持（简体中文、English）
- 语言选择器（安装时选择）
- 标准安装向导界面（欢迎 → 路径选择 → 安装 → 完成）
- 安装路径选择（默认: `%LOCALAPPDATA%\KeyForge`）
- 桌面快捷方式创建选项
- 开始菜单文件夹创建选项

### 自定义图标
- 安装程序图标: `src-tauri/icons/icon.ico`
- 安装向导头部图片: `src-tauri/icons/installer-header.bmp` (150x57)
- 安装向导侧边栏图片: `src-tauri/icons/installer-sidebar.bmp` (164x314)

### 安装后行为
- 自动创建开始菜单快捷方式 (`KeyForge\KeyForge.lnk`)
- 自动创建卸载快捷方式 (`KeyForge\卸载 KeyForge.lnk`)
- 写入「添加/删除程序」注册表项
- 注册 `.keyforge` 文件关联（学习进度备份文件）
- 验证主程序文件完整性
- 生成安装信息文件 `install-info.txt`
- 若应用正在运行，提示自动关闭

### 卸载行为
- 通过「设置 > 应用」或 `uninstall.exe` 卸载
- 彻底清理注册表项（卸载条目、文件关联、自启动项）
- 删除所有快捷方式（开始菜单、桌面）
- **询问是否删除用户学习数据**（默认保留，便于重装恢复）
- 若应用正在运行，提示自动关闭

## WebView2 运行时处理

安装包采用 `embeddedBootstrapper` 模式：

- 安装包内嵌 WebView2 引导程序（约 2MB）
- 安装时检测系统是否已安装 WebView2
- 未安装时自动引导安装（需联网下载，约 150MB）
- 已安装则跳过，无需重复安装

> 如需完全离线安装（无需联网），将 `tauri.conf.json` 中的 `webviewInstallMode.type` 改为 `offlineInstaller`，但安装包体积会增加约 150MB。

## 配置文件说明

### tauri.conf.json
- `bundle.windows.nsis`: NSIS 安装包配置
- `bundle.windows.webviewInstallMode`: WebView2 安装模式
- `bundle.windows.nsis.installerHooks`: 自定义安装钩子文件

### nsis-hooks.nsh
自定义 NSIS 安装钩子，定义以下宏：
- `NSIS_HOOK_PREINSTALL`: 安装前检查应用是否运行
- `NSIS_HOOK_POSTINSTALL`: 安装后写入注册表、创建快捷方式、验证文件
- `NSIS_HOOK_PREUNINSTALL`: 卸载前检查应用是否运行
- `NSIS_HOOK_POSTUNINSTALL`: 卸载后清理注册表、快捷方式、询问删除用户数据

## 故障排查

### 构建失败：NSIS 未找到
Tauri CLI 会自动下载 NSIS 工具链。如失败，检查网络连接或手动设置代理。

### 构建失败：MSVC 链接器未找到
安装 Visual Studio Build Tools，勾选「C++ 桌面开发」工作负载。

### 安装包过大
- 检查 `resources` 是否包含不必要的大文件
- 确认 `compression` 设置为 `lzma`（默认）
- 使用 `--debug` 构建调试版本检查体积来源

### 运行时白屏
- 检查 WebView2 是否正确安装
- 尝试将 `webviewInstallMode` 改为 `offlineInstaller`
- 查看应用日志: `%LOCALAPPDATA%\com.bronya.keyforge\logs\`
