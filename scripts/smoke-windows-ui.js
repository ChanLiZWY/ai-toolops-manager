import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const executable = path.join(root, 'dist', 'ai-toolops.exe')
if (!fs.existsSync(executable)) throw new Error('Run npm run build:windows first.')

const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-toolops-sea-ui-'))
const projectRoot = path.join(smokeRoot, 'project with spaces')
const machineRoot = path.join(smokeRoot, 'machine')
fs.mkdirSync(projectRoot, { recursive: true })

const initialized = spawnSync(executable, ['init', '--project', projectRoot], {
  encoding: 'utf8',
  env: { ...process.env, AI_TOOLOPS_HOME: machineRoot },
  windowsHide: true
})
if (initialized.status !== 0) throw new Error(initialized.stderr || initialized.stdout)

const port = 42000 + Math.floor(Math.random() * 1000)
const child = spawn(
  executable,
  [],
  {
    cwd: projectRoot,
    env: {
      ...process.env,
      AI_TOOLOPS_AGENT: 'generic',
      AI_TOOLOPS_HOME: machineRoot,
      AI_TOOLOPS_UI_NO_OPEN: '1',
      AI_TOOLOPS_UI_PORT: String(port)
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  }
)
let stderr = ''
child.stderr.on('data', (chunk) => {
  stderr += chunk
})

try {
  const page = await waitForPage(`http://127.0.0.1:${port}/`)
  const token = page.match(/ai-toolops-token" content="([^"]+)/)?.[1]
  if (!token) throw new Error('UI HTML is missing the session token.')

  const response = await fetch(`http://127.0.0.1:${port}/api/state`, {
    headers: { 'x-ai-toolops-token': token }
  })
  if (!response.ok) throw new Error(`UI state API failed: ${response.status}`)

  const state = await response.json()
  if (state.context.agent.resolved !== 'generic') throw new Error('Unexpected SEA UI Agent state.')
  console.log(`SEA UI smoke passed: ${smokeRoot}`)
} finally {
  child.kill()
}

async function waitForPage(url) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`SEA UI exited early: ${stderr}`)
    try {
      const response = await fetch(url)
      if (response.ok) return response.text()
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`SEA UI start timed out: ${stderr}`)
}
