import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const setupExecutable = path.join(root, 'dist', 'ai-toolops-setup.exe')
if (!fs.existsSync(setupExecutable)) throw new Error('Run npm run build:windows first.')

const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-toolops-setup-smoke-'))
const installRoot = path.join(smokeRoot, '安装 目录')
const startMenuRoot = path.join(smokeRoot, 'Start Menu')
const desktopRoot = path.join(smokeRoot, 'Desktop')
const registryPath = `HKCU:\\Software\\AI ToolOps Tests\\${crypto.randomUUID()}`
const installedExecutable = path.join(installRoot, 'ai-toolops.exe')
const uninstallScript = path.join(installRoot, 'uninstall.ps1')
const startMenuShortcut = path.join(startMenuRoot, 'AI ToolOps', 'AI ToolOps Manager.lnk')
const desktopShortcut = path.join(desktopRoot, 'AI ToolOps Manager.lnk')

const setupArgs = [
  '--silent',
  '--install-root',
  installRoot,
  '--start-menu-root',
  startMenuRoot,
  '--desktop-root',
  desktopRoot,
  '--registry-path',
  registryPath,
  '--desktop-shortcut',
  '--no-path',
  '--no-launch'
]

try {
  install()
  assert.equal(fs.existsSync(installedExecutable), true)
  assert.equal(fs.existsSync(uninstallScript), true)
  assert.equal(fs.existsSync(startMenuShortcut), true)
  assert.equal(fs.existsSync(desktopShortcut), true)

  const version = spawnSync(installedExecutable, ['--version'], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 30000
  })
  assert.equal(version.status, 0, version.stderr)
  assert.match(version.stdout, /1\.0\.0/)

  const registry = readRegistry()
  assert.equal(registry.DisplayName, 'AI ToolOps Manager')
  assert.equal(registry.DisplayVersion, '1.0.0')
  assert.equal(path.resolve(registry.InstallLocation), path.resolve(installRoot))

  const shortcutTarget = readShortcutTarget(startMenuShortcut)
  assert.equal(path.resolve(shortcutTarget), path.resolve(installedExecutable))

  install()
  assert.equal(fs.existsSync(path.join(installRoot, 'ai-toolops.old.exe')), false)

  const uninstall = spawnSync('powershell.exe', [
    '-NoLogo',
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    uninstallScript,
    '-InstallRoot',
    installRoot,
    '-StartMenuRoot',
    startMenuRoot,
    '-DesktopRoot',
    desktopRoot,
    '-UninstallRegistryPath',
    registryPath,
    '-Silent'
  ], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000
  })
  assert.equal(uninstall.status, 0, uninstall.stderr || uninstall.stdout)
  assert.equal(fs.existsSync(installRoot), false)
  assert.equal(fs.existsSync(startMenuShortcut), false)
  assert.equal(fs.existsSync(desktopShortcut), false)
  assert.equal(registryExists(), false)
  console.log(`Windows setup smoke passed: ${smokeRoot}`)
} finally {
  removeRegistry()
  fs.rmSync(smokeRoot, { recursive: true, force: true })
}

function install() {
  const result = spawnSync(setupExecutable, setupArgs, {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000
  })
  assert.equal(result.status, 0, result.stderr || result.stdout)
}

function readRegistry() {
  const script = `Get-ItemProperty -LiteralPath '${escapePowerShell(registryPath)}' | Select-Object DisplayName,DisplayVersion,InstallLocation | ConvertTo-Json -Compress`
  const result = runPowerShell(script)
  return JSON.parse(result.stdout)
}

function registryExists() {
  const script = `if (Test-Path -LiteralPath '${escapePowerShell(registryPath)}') { 'true' } else { 'false' }`
  return runPowerShell(script).stdout.trim() === 'true'
}

function removeRegistry() {
  const script = `Remove-Item -LiteralPath '${escapePowerShell(registryPath)}' -Recurse -Force -ErrorAction SilentlyContinue`
  spawnSync('powershell.exe', [
    '-NoLogo',
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    script
  ], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 30000
  })
}

function readShortcutTarget(shortcut) {
  const script = `$shell = New-Object -ComObject WScript.Shell; $shell.CreateShortcut('${escapePowerShell(shortcut)}').TargetPath`
  return runPowerShell(script).stdout.trim()
}

function runPowerShell(script) {
  const utf8Script = `$utf8 = New-Object System.Text.UTF8Encoding($false); [Console]::OutputEncoding = $utf8; $OutputEncoding = $utf8; ${script}`
  const result = spawnSync('powershell.exe', [
    '-NoLogo',
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    utf8Script
  ], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 30000
  })
  assert.equal(result.status, 0, result.stderr || result.stdout)
  return result
}

function escapePowerShell(value) {
  return String(value).replaceAll("'", "''")
}
