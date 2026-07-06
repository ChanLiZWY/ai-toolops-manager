#!/usr/bin/env node
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __filename = fileURLToPath(import.meta.url)
const root = path.resolve(path.dirname(__filename), '..')
const args = process.argv.slice(2)
const flags = parseArgs(args)
const project = path.resolve(flags.project || flags.p || process.cwd())
const openUi = flags.ui === true || flags['open-ui'] === true
const port = String(flags.port || '4177')

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: options.cwd || process.cwd(),
    stdio: 'inherit',
    shell: false,
    windowsVerbatimArguments: false
  })

  if (result.error) {
    console.error(`命令执行失败：${command}`)
    console.error(result.error.message)
    process.exit(1)
  }

  if (result.status !== 0) process.exit(result.status || 1)
}


function runNpmLink(cwd) {
  if (process.platform === 'win32') {
    // Windows cannot reliably spawn npm.cmd without a shell, especially when Node is installed under
    // C:\Program Files. Use cmd.exe directly for npm link, while keeping setup execution shell-free.
    const shell = process.env.ComSpec || 'cmd.exe'
    run(shell, ['/d', '/s', '/c', 'npm link'], { cwd })
    return
  }

  run('npm', ['link'], { cwd })
}

function parseArgs(values) {
  const result = {}
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i]
    if (!value.startsWith('--')) continue
    const [key, inline] = value.slice(2).split('=')
    if (inline !== undefined) result[key] = inline
    else if (values[i + 1] && !values[i + 1].startsWith('--')) result[key] = values[++i]
    else result[key] = true
  }
  return result
}

console.log(`AI ToolOps 本地安装目录：${root}`)
console.log(`目标项目目录：${project}`)
console.log('1/2 npm link ...')
runNpmLink(root)
console.log('2/2 ai-toolops setup ...')
const setupArgs = [path.join(root, 'bin', 'ai-toolops.js'), 'setup', '--project', project]
if (openUi) setupArgs.push('--ui', '--port', port)
run(process.execPath, setupArgs, { cwd: project })
