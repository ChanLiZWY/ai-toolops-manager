[CmdletBinding()]
param(
  [string]$Source = (Join-Path $PSScriptRoot '..\dist\ai-toolops.exe'),
  [string]$ExpectedSha256,
  [string]$InstallRoot = (Join-Path $env:LOCALAPPDATA 'Programs\ai-toolops'),
  [string]$UninstallScriptSource = (Join-Path $PSScriptRoot 'uninstall-windows.ps1'),
  [string]$StartMenuRoot = [Environment]::GetFolderPath('Programs'),
  [string]$DesktopRoot = [Environment]::GetFolderPath('Desktop'),
  [string]$UninstallRegistryPath = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\AI ToolOps',
  [string]$CleanupRoot,
  [switch]$AddToPath,
  [switch]$CreateStartMenuShortcut,
  [switch]$DesktopShortcut,
  [switch]$RegisterUninstall,
  [switch]$Launch,
  [switch]$Interactive,
  [switch]$Force
)

$ErrorActionPreference = 'Stop'

function Add-UserPathEntry {
  param([Parameter(Mandatory = $true)][string]$PathValue)
  $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
  $parts = @($userPath -split ';' | Where-Object { $_ })
  if ($parts -notcontains $PathValue) {
    [Environment]::SetEnvironmentVariable('Path', (($parts + $PathValue) -join ';'), 'User')
    Write-Host 'User PATH updated. Open a new terminal to use ai-toolops.'
  }
}

function New-AiToolOpsShortcut {
  param(
    [Parameter(Mandatory = $true)][string]$ShortcutPath,
    [Parameter(Mandatory = $true)][string]$TargetPath
  )
  New-Item -ItemType Directory -Path (Split-Path -Parent $ShortcutPath) -Force | Out-Null
  $shell = New-Object -ComObject WScript.Shell
  $shortcut = $shell.CreateShortcut($ShortcutPath)
  $shortcut.TargetPath = $TargetPath
  $shortcut.WorkingDirectory = $env:USERPROFILE
  $shortcut.IconLocation = "$TargetPath,0"
  $shortcut.Description = 'Open AI ToolOps Manager'
  $shortcut.Save()
}

try {
  if (-not [Environment]::Is64BitOperatingSystem) {
    throw 'AI ToolOps Windows v1 only supports x64 Windows 10/11.'
  }

  if ($Interactive) {
    Add-Type -AssemblyName System.Windows.Forms
    $confirm = [System.Windows.Forms.MessageBox]::Show(
      "Install AI ToolOps for the current Windows user?`r`n`r`nInstall location:`r`n$InstallRoot`r`n`r`nThe installer will add AI ToolOps to the user PATH and create a Start menu shortcut.",
      'AI ToolOps Setup',
      [System.Windows.Forms.MessageBoxButtons]::YesNo,
      [System.Windows.Forms.MessageBoxIcon]::Information
    )
    if ($confirm -ne [System.Windows.Forms.DialogResult]::Yes) {
      exit 2
    }
    $desktopChoice = [System.Windows.Forms.MessageBox]::Show(
      'Create a desktop shortcut?',
      'AI ToolOps Setup',
      [System.Windows.Forms.MessageBoxButtons]::YesNo,
      [System.Windows.Forms.MessageBoxIcon]::Question
    )
    $AddToPath = $true
    $CreateStartMenuShortcut = $true
    $RegisterUninstall = $true
    $Launch = $true
    $DesktopShortcut = $desktopChoice -eq [System.Windows.Forms.DialogResult]::Yes
    $Force = $true
  }

  $resolvedSource = (Resolve-Path -LiteralPath $Source).Path
  if ($ExpectedSha256) {
    $actualSourceHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $resolvedSource).Hash.ToLowerInvariant()
    if ($actualSourceHash -ne $ExpectedSha256.ToLowerInvariant()) {
      throw "Embedded application SHA-256 mismatch. expected=$ExpectedSha256 actual=$actualSourceHash"
    }
  }

  $target = Join-Path $InstallRoot 'ai-toolops.exe'
  $staged = Join-Path $InstallRoot 'ai-toolops.new.exe'
  $backup = Join-Path $InstallRoot 'ai-toolops.old.exe'
  New-Item -ItemType Directory -Path $InstallRoot -Force | Out-Null

  if ((Test-Path -LiteralPath $target) -and -not $Force) {
    throw "AI ToolOps is already installed at $target. Use -Force to upgrade."
  }

  Remove-Item -LiteralPath $staged -Force -ErrorAction SilentlyContinue
  Copy-Item -LiteralPath $resolvedSource -Destination $staged -Force
  $versionOutput = & $staged --version
  $versionExitCode = $LASTEXITCODE
  $version = [string](@($versionOutput) | Select-Object -First 1)
  $version = $version.Trim()
  if ($versionExitCode -ne 0 -or -not $version) {
    Remove-Item -LiteralPath $staged -Force -ErrorAction SilentlyContinue
    throw 'The staged executable failed its version check.'
  }

  Remove-Item -LiteralPath $backup -Force -ErrorAction SilentlyContinue
  $hadExisting = Test-Path -LiteralPath $target
  try {
    if ($hadExisting) {
      Move-Item -LiteralPath $target -Destination $backup -Force
    }
    Move-Item -LiteralPath $staged -Destination $target -Force
  } catch {
    Remove-Item -LiteralPath $staged -Force -ErrorAction SilentlyContinue
    if ((-not (Test-Path -LiteralPath $target)) -and (Test-Path -LiteralPath $backup)) {
      Move-Item -LiteralPath $backup -Destination $target -Force
    }
    throw "Unable to replace AI ToolOps. Close the running application and retry. $($_.Exception.Message)"
  }

  if (Test-Path -LiteralPath $UninstallScriptSource) {
    Copy-Item -LiteralPath $UninstallScriptSource -Destination (Join-Path $InstallRoot 'uninstall.ps1') -Force
  }

  if ($AddToPath) {
    Add-UserPathEntry -PathValue $InstallRoot
  }

  $startMenuShortcut = Join-Path (Join-Path $StartMenuRoot 'AI ToolOps') 'AI ToolOps Manager.lnk'
  $desktopShortcutPath = Join-Path $DesktopRoot 'AI ToolOps Manager.lnk'
  if ($CreateStartMenuShortcut) {
    New-AiToolOpsShortcut -ShortcutPath $startMenuShortcut -TargetPath $target
  }
  if ($DesktopShortcut) {
    New-AiToolOpsShortcut -ShortcutPath $desktopShortcutPath -TargetPath $target
  }

  if ($RegisterUninstall) {
    $uninstallScript = Join-Path $InstallRoot 'uninstall.ps1'
    if (-not (Test-Path -LiteralPath $uninstallScript)) {
      throw 'The uninstall script is missing; refusing to register an incomplete installation.'
    }
    New-Item -Path $UninstallRegistryPath -Force | Out-Null
    $uninstallCommand = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$uninstallScript`" -RemoveFromPath"
    $quietUninstallCommand = "powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$uninstallScript`" -RemoveFromPath -Silent"
    $estimatedSize = [Math]::Ceiling((Get-ChildItem -File -Recurse -LiteralPath $InstallRoot | Measure-Object Length -Sum).Sum / 1KB)
    Set-ItemProperty -Path $UninstallRegistryPath -Name DisplayName -Value 'AI ToolOps Manager'
    Set-ItemProperty -Path $UninstallRegistryPath -Name DisplayVersion -Value $version
    Set-ItemProperty -Path $UninstallRegistryPath -Name Publisher -Value 'AI ToolOps'
    Set-ItemProperty -Path $UninstallRegistryPath -Name InstallLocation -Value $InstallRoot
    Set-ItemProperty -Path $UninstallRegistryPath -Name DisplayIcon -Value $target
    Set-ItemProperty -Path $UninstallRegistryPath -Name UninstallString -Value $uninstallCommand
    Set-ItemProperty -Path $UninstallRegistryPath -Name QuietUninstallString -Value $quietUninstallCommand
    Set-ItemProperty -Path $UninstallRegistryPath -Name EstimatedSize -Value ([int]$estimatedSize) -Type DWord
    Set-ItemProperty -Path $UninstallRegistryPath -Name NoModify -Value 1 -Type DWord
    Set-ItemProperty -Path $UninstallRegistryPath -Name NoRepair -Value 1 -Type DWord
  }

  Remove-Item -LiteralPath $backup -Force -ErrorAction SilentlyContinue
  Write-Host "Installed AI ToolOps $version to $target"

  if ($Launch) {
    Start-Process -FilePath $target -WorkingDirectory $env:USERPROFILE
  }

  if ($Interactive) {
    [System.Windows.Forms.MessageBox]::Show(
      "AI ToolOps $version was installed successfully.",
      'AI ToolOps Setup',
      [System.Windows.Forms.MessageBoxButtons]::OK,
      [System.Windows.Forms.MessageBoxIcon]::Information
    ) | Out-Null
  }
} finally {
  if ($CleanupRoot) {
    Remove-Item -LiteralPath $CleanupRoot -Recurse -Force -ErrorAction SilentlyContinue
  }
}
