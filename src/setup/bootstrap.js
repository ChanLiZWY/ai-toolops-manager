import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { getAsset, isSea } from 'node:sea'
import { gunzipSync } from 'node:zlib'
import { spawn, spawnSync } from 'node:child_process'

if (!isSea()) throw new Error('AI ToolOps Setup must run as a Windows single executable application.')

const args = process.argv.slice(2)
if (args.includes('--help') || args.includes('-h')) {
  process.stdout.write(`AI ToolOps Setup

Double-click without arguments for interactive per-user installation.

Options:
  --silent                    Install without dialogs
  --install-root <path>       Override the per-user installation directory
  --desktop-shortcut          Create a desktop shortcut
  --no-path                   Do not add the installation directory to user PATH
  --no-start-menu             Do not create a Start menu shortcut
  --no-register               Do not register a Windows uninstall entry
  --no-launch                 Do not launch AI ToolOps after installation
  --start-menu-root <path>    Override Start menu root (testing)
  --desktop-root <path>       Override Desktop root (testing)
  --registry-path <path>      Override uninstall registry path (testing)
`)
  process.exit(0)
}

const options = parseArgs(args)
const stagingRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-toolops-setup-'))
const payloadFile = path.join(stagingRoot, 'ai-toolops.exe')
const installScript = path.join(stagingRoot, 'install-windows.ps1')
const uninstallScript = path.join(stagingRoot, 'uninstall-windows.ps1')
const expectedSha256 = assetText('ai-toolops.exe.sha256').split(/\s+/)[0].toLowerCase()

const payload = gunzipSync(assetBuffer('ai-toolops.exe.gz'))
const actualSha256 = crypto.createHash('sha256').update(payload).digest('hex')
if (actualSha256 !== expectedSha256) {
  fs.rmSync(stagingRoot, { recursive: true, force: true })
  throw new Error(`Embedded application SHA-256 mismatch. expected=${expectedSha256} actual=${actualSha256}`)
}

fs.writeFileSync(payloadFile, payload)
fs.writeFileSync(installScript, assetBuffer('install-windows.ps1'))
fs.writeFileSync(uninstallScript, assetBuffer('uninstall-windows.ps1'))

const powerShellArgs = [
  '-NoLogo',
  '-NoProfile',
  '-STA',
  '-WindowStyle',
  'Hidden',
  '-ExecutionPolicy',
  'Bypass',
  '-File',
  installScript,
  '-Source',
  payloadFile,
  '-ExpectedSha256',
  expectedSha256,
  '-UninstallScriptSource',
  uninstallScript,
  '-CleanupRoot',
  stagingRoot
]

if (!args.length) {
  const child = spawn('powershell.exe', [...powerShellArgs, '-Interactive'], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true
  })
  child.unref()
  process.exit(0)
}

if (!options.silent) {
  fs.rmSync(stagingRoot, { recursive: true, force: true })
  throw new Error('Use no arguments for interactive setup, or pass --silent for scripted installation.')
}

addValue(powerShellArgs, '-InstallRoot', options['install-root'])
addValue(powerShellArgs, '-StartMenuRoot', options['start-menu-root'])
addValue(powerShellArgs, '-DesktopRoot', options['desktop-root'])
addValue(powerShellArgs, '-UninstallRegistryPath', options['registry-path'])
powerShellArgs.push('-Force')
if (!options['no-path']) powerShellArgs.push('-AddToPath')
if (!options['no-start-menu']) powerShellArgs.push('-CreateStartMenuShortcut')
if (!options['no-register']) powerShellArgs.push('-RegisterUninstall')
if (!options['no-launch']) powerShellArgs.push('-Launch')
if (options['desktop-shortcut']) powerShellArgs.push('-DesktopShortcut')

const result = spawnSync('powershell.exe', powerShellArgs, {
  encoding: 'utf8',
  windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe'],
  timeout: 120000
})
if (result.stdout) process.stdout.write(result.stdout)
if (result.stderr) process.stderr.write(result.stderr)
process.exit(result.status ?? 1)

function assetBuffer(name) {
  return Buffer.from(getAsset(name))
}

function assetText(name) {
  return assetBuffer(name).toString('utf8').trim()
}

function addValue(target, flag, value) {
  if (value !== undefined) target.push(flag, String(value))
}

function parseArgs(values) {
  const parsed = {}
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]
    if (!value.startsWith('--')) throw new Error(`Unknown setup argument: ${value}`)
    const key = value.slice(2)
    if (values[index + 1] && !values[index + 1].startsWith('--')) parsed[key] = values[++index]
    else parsed[key] = true
  }
  return parsed
}
