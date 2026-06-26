; ============================================================
; KeyForge NSIS Installer Hooks
; 自定义安装/卸载行为：注册表项、快捷方式、安装后验证、卸载清理
; ============================================================

!macro NSIS_HOOK_PREINSTALL
  ; 安装前钩子：检查是否已有实例运行，避免文件占用
  ${If} ${RunningX64}
    ; 64位系统检查
  ${EndIf}
  
  ; 检查应用是否正在运行
  nsExec::ExecToLog 'tasklist /FI "IMAGENAME eq KeyForge.exe" /NH'
  Pop $0
  ${If} $0 == 0
    ; 进程存在，提示用户关闭
    MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION "检测到 KeyForge 正在运行，需要关闭后才能继续安装。$\n$\n点击确定自动关闭，或取消退出安装。" IDOK close_app IDCANCEL abort_install
    close_app:
      nsExec::ExecToLog 'taskkill /F /IM KeyForge.exe'
      Goto continue_install
    abort_install:
      Abort
    continue_install:
  ${EndIf}
!macroend

!macro NSIS_HOOK_POSTINSTALL
  ; 安装后钩子：写入注册表项、创建快捷方式、验证可执行性
  
  ; ----- 1. 写入注册表项 -----
  ; 添加/卸载程序条目
  WriteRegStr SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\KeyForge" "DisplayName" "KeyForge - 智能词汇学习"
  WriteRegStr SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\KeyForge" "DisplayVersion" "0.1.0"
  WriteRegStr SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\KeyForge" "DisplayIcon" "$INSTDIR\KeyForge.exe"
  WriteRegStr SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\KeyForge" "Publisher" "Bronya"
  WriteRegStr SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\KeyForge" "URLInfoAbout" "https://github.com/bronya/keyforge"
  WriteRegStr SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\KeyForge" "InstallLocation" "$INSTDIR"
  WriteRegStr SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\KeyForge" "UninstallString" "$\"$INSTDIR\uninstall.exe$\""
  WriteRegStr SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\KeyForge" "QuietUninstallString" "$\"$INSTDIR\uninstall.exe$\" /S"
  WriteRegDWORD SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\KeyForge" "NoModify" 1
  WriteRegDWORD SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\KeyForge" "NoRepair" 1
  
  ; 注册文件关联（可选：.keyforge 进度备份文件）
  WriteRegStr SHCTX "Software\Classes\.keyforge" "" "KeyForge.Progress"
  WriteRegStr SHCTX "Software\Classes\KeyForge.Progress" "" "KeyForge 学习进度备份"
  WriteRegStr SHCTX "Software\Classes\KeyForge.Progress\DefaultIcon" "" "$INSTDIR\KeyForge.exe,0"
  WriteRegStr SHCTX "Software\Classes\KeyForge.Progress\shell\open\command" "" "$\"$INSTDIR\KeyForge.exe$\" $\"%1$\""
  
  ; 开机自启（可选，默认不启用，留给应用内设置）
  ; WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "KeyForge" "$\"$INSTDIR\KeyForge.exe$\""
  
  ; ----- 2. 创建开始菜单快捷方式 -----
  CreateDirectory "$SMPROGRAMS\KeyForge"
  CreateShortCut "$SMPROGRAMS\KeyForge\KeyForge.lnk" "$INSTDIR\KeyForge.exe" "" "$INSTDIR\KeyForge.exe" 0
  CreateShortCut "$SMPROGRAMS\KeyForge\卸载 KeyForge.lnk" "$INSTDIR\uninstall.exe" "" "$INSTDIR\uninstall.exe" 0
  
  ; ----- 3. 桌面快捷方式（Tauri 默认已处理，这里作为备份） -----
  ; Tauri NSIS 模板默认会在 currentUser 模式下询问是否创建桌面快捷方式
  
  ; ----- 4. 安装后验证可执行性 -----
  ; 检查主程序文件是否存在
  IfFileExists "$INSTDIR\KeyForge.exe" 0 verify_failed
    DetailPrint "✓ 主程序文件验证通过: KeyForge.exe"
    Goto verify_continue
  verify_failed:
    DetailPrint "✗ 警告: 主程序文件未找到，安装可能不完整"
    MessageBox MB_OK|MB_ICONEXCLAMATION "安装验证失败：主程序文件未找到。$\n请重新运行安装程序。"
  verify_continue:
  
  ; 检查资源文件
  IfFileExists "$INSTDIR\resources\*" 0 verify_resources_failed
    DetailPrint "✓ 资源目录验证通过"
    Goto verify_resources_continue
  verify_resources_failed:
    DetailPrint "i 资源目录为空或不存在（可能为正常情况）"
  verify_resources_continue:
  
  ; ----- 5. 写入安装信息文件 -----
  FileOpen $0 "$INSTDIR\install-info.txt" w
  FileWrite $0 "KeyForge Installation Information$\r$\n"
  FileWrite $0 "=====================================$\r$\n"
  FileWrite $0 "Version: 0.1.0$\r$\n"
  FileWrite $0 "Install Date: $\"$\""  ; 占位，实际安装时间由系统记录
  FileWrite $0 "Install Path: $INSTDIR$\r$\n"
  FileWrite $0 "Install Mode: Current User$\r$\n"
  FileWrite $0 "Architecture: x64$\r$\n"
  FileClose $0
  
  DetailPrint "✓ KeyForge 安装完成"
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  ; 卸载前钩子：检查应用是否运行
  nsExec::ExecToLog 'tasklist /FI "IMAGENAME eq KeyForge.exe" /NH'
  Pop $0
  ${If} $0 == 0
    MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION "检测到 KeyForge 正在运行，需要关闭后才能卸载。$\n$\n点击确定自动关闭，或取消退出卸载。" IDOK close_app_un IDCANCEL abort_uninstall
    close_app_un:
      nsExec::ExecToLog 'taskkill /F /IM KeyForge.exe'
      Goto continue_uninstall
    abort_uninstall:
      Abort
    continue_uninstall:
  ${EndIf}
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ; 卸载后钩子：彻底清理注册表、快捷方式、用户数据
  
  ; ----- 1. 清理注册表项 -----
  DeleteRegKey SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\KeyForge"
  DeleteRegKey SHCTX "Software\Classes\.keyforge"
  DeleteRegKey SHCTX "Software\Classes\KeyForge.Progress"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "KeyForge"
  DeleteRegKey HKCU "Software\KeyForge"
  DeleteRegKey HKLM "Software\KeyForge"
  
  ; ----- 2. 清理开始菜单快捷方式 -----
  Delete "$SMPROGRAMS\KeyForge\KeyForge.lnk"
  Delete "$SMPROGRAMS\KeyForge\卸载 KeyForge.lnk"
  RMDir "$SMPROGRAMS\KeyForge"
  
  ; ----- 3. 清理桌面快捷方式 -----
  Delete "$DESKTOP\KeyForge.lnk"
  
  ; ----- 4. 询问是否删除用户数据 -----
  MessageBox MB_YESNO|MB_ICONQUESTION "是否同时删除 KeyForge 的用户学习数据？$\n$\n选择$\"是$\"将删除所有学习进度，且无法恢复。$\n选择$\"否$\"保留数据以便将来重新安装时恢复。" IDNO keep_data
    ; 删除用户数据目录
    RMDir /r "$LOCALAPPDATA\com.bronya.keyforge"
    RMDir /r "$APPDATA\com.bronya.keyforge"
    RMDir /r "$LOCALAPPDATA\KeyForge"
    DetailPrint "✓ 用户数据已清理"
    Goto cleanup_done
  keep_data:
    DetailPrint "i 用户数据已保留"
  cleanup_done:
  
  ; ----- 5. 删除安装信息文件 -----
  Delete "$INSTDIR\install-info.txt"
  
  DetailPrint "✓ KeyForge 卸载完成"
!macroend
