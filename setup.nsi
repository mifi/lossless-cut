;--------------------------------
;Include Modern UI and Windows stuff

  !include "MUI2.nsh"
  !include "winmessages.nsh"
  !define env_hklm 'HKLM "SYSTEM\CurrentControlSet\Control\Session Manager\Environment"'

;--------------------------------
;General
  ; var "BuildTimestamp"
  ; var "ApplicationName"
  ; var "ExecutableName"
  !define ApplicationName "LosslessCut"
  !define ExecutableName "LosslessCut-win-x64.exe"

  !define RegistryLocation "LosslessCut"

  !define InstallLocationRelative "LosslessCut"
  !define InstallLocationUser "$LOCALAPPDATA\${InstallLocationRelative}"
  ; !define InstallLocationSystem "$PROGRAMFILES\${InstallLocationRelative}"
  !define InstallLocation "${InstallLocationUser}"


  ;Name and file
  Name "${ApplicationName}"
  OutFile "dist\${ExecutableName}"
  Unicode True

  ;Default installation folder
  InstallDir "${InstallLocation}"

  ;Get installation folder from registry if available
  InstallDirRegKey HKCU "Software\${RegistryLocation}" "InstallLocation"

  ;Request application privileges for Windows Vista
  RequestExecutionLevel user

;--------------------------------
;Interface Settings

  !define MUI_ABORTWARNING
  
  !define MUI_ICON ".\icon-build\icon.ico"
  !define MUI_UNICON "${NSISDIR}\Contrib\Graphics\Icons\modern-uninstall-blue.ico"
  !define MUI_HEADERIMAGE_BITMAP "${NSISDIR}\Contrib\Graphics\Header\nsis3-grey.bmp"
  !define MUI_WELCOMEFINISHPAGE_BITMAP "${NSISDIR}\Contrib\Graphics\Wizard\win.bmp"
  !define MUI_UNWELCOMEFINISHPAGE_BITMAP "${NSISDIR}\Contrib\Graphics\Wizard\win.bmp"
  
  !define MUI_FINISHPAGE_NOAUTOCLOSE
  !define MUI_FINISHPAGE_RUN
  !define MUI_FINISHPAGE_RUN_TEXT "Start LosslessCut"
  !define MUI_FINISHPAGE_RUN_FUNCTION "LaunchApp"

;--------------------------------
;Pages

  !insertmacro MUI_PAGE_LICENSE "LICENSE"
  !insertmacro MUI_PAGE_COMPONENTS
  !insertmacro MUI_PAGE_DIRECTORY
  !insertmacro MUI_PAGE_INSTFILES
  !insertmacro MUI_PAGE_FINISH

  !insertmacro MUI_UNPAGE_CONFIRM
  !insertmacro MUI_UNPAGE_INSTFILES

;--------------------------------
;Languages

  !insertmacro MUI_LANGUAGE "English"

;--------------------------------
;Macros

; ################################################################
; appends \ to the path if missing
!macro GetCleanDir INPUTDIR
  !define Index_GetCleanDir 'GetCleanDir_Line${__LINE__}'
  Push $R0
  Push $R1
  StrCpy $R0 "${INPUTDIR}"
  StrCmp $R0 "" ${Index_GetCleanDir}-finish
  StrCpy $R1 "$R0" "" -1
  StrCmp "$R1" "\" ${Index_GetCleanDir}-finish
  StrCpy $R0 "$R0\"
${Index_GetCleanDir}-finish:
  Pop $R1
  Exch $R0
  !undef Index_GetCleanDir
!macroend

; ################################################################
; similar to "RMDIR /r DIRECTORY", but does not remove DIRECTORY itself
!macro RemoveFilesAndSubDirs DIRECTORY
  !define Index_RemoveFilesAndSubDirs 'RemoveFilesAndSubDirs_${__LINE__}'

  Push $R0
  Push $R1
  Push $R2

  !insertmacro GetCleanDir "${DIRECTORY}"
  Pop $R2
  FindFirst $R0 $R1 "$R2*.*"
  ${Index_RemoveFilesAndSubDirs}-loop:
    StrCmp $R1 "" ${Index_RemoveFilesAndSubDirs}-done
    StrCmp $R1 "." ${Index_RemoveFilesAndSubDirs}-next
    StrCmp $R1 ".." ${Index_RemoveFilesAndSubDirs}-next
    IfFileExists "$R2$R1\*.*" ${Index_RemoveFilesAndSubDirs}-directory
    ; file
    Delete "$R2$R1"
    goto ${Index_RemoveFilesAndSubDirs}-next
  ${Index_RemoveFilesAndSubDirs}-directory:
    ; directory
    RMDir /r "$R2$R1"
  ${Index_RemoveFilesAndSubDirs}-next:
    FindNext $R0 $R1
    Goto ${Index_RemoveFilesAndSubDirs}-loop
  ${Index_RemoveFilesAndSubDirs}-done:
    FindClose $R0

    Pop $R2
    Pop $R1
    Pop $R0
  !undef Index_RemoveFilesAndSubDirs
!macroend

;--------------------------------
;Installer Sections

Section "Desktop App (required)" SecInstallGUIApp

  SectionIn RO
  SetOutPath "${InstallLocation}"

  ;ADD YOUR OWN FILES HERE...
  File /r ".\dist\win-unpacked\*"

  ;Store installation folder
  WriteRegStr HKCU "Software\${RegistryLocation}" "InstallLocation" "${InstallLocation}"

SectionEnd

Section "Uninstaller (Required)" SecInstallUninstaller

  SectionIn RO
  SetOutPath "${InstallLocation}"
  WriteUninstaller "${InstallLocation}\Uninstall LosslessCut.exe"
  WriteRegStr HKCU "Software\${RegistryLocation}" "InstallLocation" "${InstallLocation}"
SectionEnd

Section "Start Menu Shortcuts" SecMenuShortcut

  CreateDirectory "$SMPROGRAMS\LosslessCut"
  CreateShortcut "$SMPROGRAMS\LosslessCut\Uninstall LosslessCut.lnk" "${InstallLocation}\Uninstall LosslessCut.exe"
  CreateShortcut "$SMPROGRAMS\LosslessCut\LosslessCut.lnk" "${InstallLocation}\LosslessCut.exe"

SectionEnd

Section "Desktop Shortcuts" SecDesktopShortcut

    CreateShortcut "$DESKTOP\LosslessCut.lnk" "${InstallLocation}\LosslessCut.exe"

SectionEnd

;--------------------------------
;Descriptions

  ;Language strings
  LangString DESC_SecInstallUninstaller ${LANG_ENGLISH} "Include the Uninstaller. Really should be selected."
  LangString DESC_SecMenuShortcut ${LANG_ENGLISH} "Create Start Menu Shortcuts"
  LangString MUI_BUTTONTEXT_FINISH ${LANG_ENGLISH} "Close"
  LangString MUI_UNTEXT_UNINSTALLING_TITLE ${LANG_ENGLISH} "Uninstalling"
  LangString MUI_UNTEXT_UNINSTALLING_SUBTITLE ${LANG_ENGLISH} "Please wait while LosslessCut is being uninstalled."
  LangString MUI_UNTEXT_FINISH_TITLE ${LANG_ENGLISH} "Uninstallation Complete"
  LangString MUI_UNTEXT_FINISH_SUBTITLE ${LANG_ENGLISH} "Uninstall was completed successfully."
  LangString MUI_UNTEXT_ABORT_TITLE ${LANG_ENGLISH} "Uninstallation Aborted"
  LangString MUI_UNTEXT_ABORT_SUBTITLE ${LANG_ENGLISH} "Uninstall was not completed successfully."
  LangString MUI_TEXT_FINISH_INFO_TITLE ${LANG_ENGLISH} "Completed LosslessCut Setup"
  LangString MUI_TEXT_FINISH_INFO_TEXT ${LANG_ENGLISH} "LosslessCut has finished installing on your computer.$\r$\n$\r$\nClick Finish to close Setup."

  ;Assign language strings to sections
  !insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
    !insertmacro MUI_DESCRIPTION_TEXT ${SecInstallUninstaller} $(DESC_SecInstallUninstaller)
    !insertmacro MUI_DESCRIPTION_TEXT ${SecMenuShortcut} $(DESC_SecMenuShortcut)
  !insertmacro MUI_FUNCTION_DESCRIPTION_END

;--------------------------------
;Start after Install
  Function LaunchApp
    ExecShell "" "$SMPROGRAMS\LosslessCut\LosslessCut.lnk"
  FunctionEnd

;--------------------------------
;Uninstaller Section

Section "Uninstall"

  !insertmacro RemoveFilesAndSubDirs "${InstallLocation}"
  RMDir "${InstallLocation}"

  DeleteRegKey /ifempty HKCU "Software\${RegistryLocation}"

SectionEnd