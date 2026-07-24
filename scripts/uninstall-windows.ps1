[CmdletBinding()]
param(
  [string]$InstallRoot = (Join-Path $env:LOCALAPPDATA 'Programs\ai-toolops'),
  [string]$StartMenuRoot = [Environment]::GetFolderPath('Programs'),
  [string]$DesktopRoot = [Environment]::GetFolderPath('Desktop'),
  [string]$UninstallRegistryPath = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\AI ToolOps',
  [switch]$RemoveFromPath,
  [switch]$RemoveData,
  [switch]$Silent
)

$ErrorActionPreference = 'Stop'
$target = Join-Path $InstallRoot 'ai-toolops.exe'
$startMenuFolder = Join-Path $StartMenuRoot 'AI ToolOps'
$desktopShortcut = Join-Path $DesktopRoot 'AI ToolOps Manager.lnk'

Remove-Item -LiteralPath $desktopShortcut -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $startMenuFolder -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path $UninstallRegistryPath -Recurse -Force -ErrorAction SilentlyContinue

if ($RemoveFromPath) {
  $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
  $parts = @($userPath -split ';' | Where-Object { $_ -and $_ -ne $InstallRoot })
  [Environment]::SetEnvironmentVariable('Path', ($parts -join ';'), 'User')
}

if (Test-Path -LiteralPath $target) {
  Remove-Item -LiteralPath $target -Force
}
if (Test-Path -LiteralPath $InstallRoot) {
  Remove-Item -LiteralPath $InstallRoot -Force -Recurse
}

if ($RemoveData) {
  $dataRoot = Join-Path $env:LOCALAPPDATA 'ai-toolops'
  if (Test-Path -LiteralPath $dataRoot) {
    Remove-Item -LiteralPath $dataRoot -Force -Recurse
  }
}

if (-not $Silent) {
  Write-Host 'AI ToolOps uninstalled. Machine inventory and receipts were preserved.'
}
