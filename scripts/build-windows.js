import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { gzipSync } from 'node:zlib'
import { build } from 'esbuild'

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
const appExecutable = path.join(dist, 'ai-toolops.exe')
const setupExecutable = path.join(dist, 'ai-toolops-setup.exe')
const postjectPackage = require.resolve('postject/package.json')
const postjectCli = path.resolve(path.dirname(postjectPackage), require(postjectPackage).bin.postject)

if (process.platform !== 'win32' || process.arch !== 'x64') {
  throw new Error(`Windows v1 build only supports win32-x64; current=${process.platform}-${process.arch}`)
}

fs.rmSync(dist, { recursive: true, force: true })
fs.mkdirSync(dist, { recursive: true })

const appInternals = await buildSeaExecutable({
  name: 'app',
  entry: path.join(root, 'bin', 'ai-toolops.js'),
  executable: appExecutable
})
assertOutput(appExecutable, ['--version'], '1.0.0')
const appChecksum = writeChecksum(appExecutable)

const compressedPayload = path.join(dist, 'ai-toolops.exe.gz')
fs.writeFileSync(
  compressedPayload,
  gzipSync(fs.readFileSync(appExecutable), { level: 9 })
)

const setupInternals = await buildSeaExecutable({
  name: 'setup',
  entry: path.join(root, 'src', 'setup', 'bootstrap.js'),
  executable: setupExecutable,
  assets: {
    'ai-toolops.exe.gz': compressedPayload,
    'ai-toolops.exe.sha256': `${appExecutable}.sha256`,
    'install-windows.ps1': path.join(root, 'scripts', 'install-windows.ps1'),
    'uninstall-windows.ps1': path.join(root, 'scripts', 'uninstall-windows.ps1')
  }
})
assertOutput(setupExecutable, ['--help'], 'AI ToolOps Setup')
const setupChecksum = writeChecksum(setupExecutable)

for (const file of [...appInternals, ...setupInternals, compressedPayload]) {
  fs.rmSync(file, { force: true })
}

console.log(`Built ${appExecutable}`)
console.log(`SHA-256 ${appChecksum}`)
console.log(`Built ${setupExecutable}`)
console.log(`SHA-256 ${setupChecksum}`)

async function buildSeaExecutable(options) {
  const bundle = path.join(dist, `${options.name}-entry.cjs`)
  const blob = path.join(dist, `${options.name}-sea.blob`)
  const config = path.join(dist, `${options.name}-sea-config.json`)

  await build({
    entryPoints: [options.entry],
    outfile: bundle,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node23',
    sourcemap: false,
    minify: false
  })

  fs.writeFileSync(config, `${JSON.stringify({
    main: bundle,
    output: blob,
    disableExperimentalSEAWarning: true,
    useSnapshot: false,
    useCodeCache: false,
    ...(options.assets ? { assets: options.assets } : {})
  }, null, 2)}\n`)

  run(process.execPath, ['--experimental-sea-config', config])
  fs.copyFileSync(process.execPath, options.executable)
  run(process.execPath, [
    postjectCli,
    options.executable,
    'NODE_SEA_BLOB',
    blob,
    '--sentinel-fuse',
    'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2',
    '--overwrite'
  ])
  return [bundle, blob, config]
}

function assertOutput(executable, args, expected) {
  const result = spawnSync(executable, args, {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 30000
  })
  if (result.status !== 0 || !result.stdout.includes(expected)) {
    throw new Error(`Smoke test failed for ${path.basename(executable)}: ${result.stderr || result.stdout}`)
  }
}

function writeChecksum(executable) {
  const checksum = crypto.createHash('sha256').update(fs.readFileSync(executable)).digest('hex')
  fs.writeFileSync(`${executable}.sha256`, `${checksum}  ${path.basename(executable)}\n`)
  return checksum
}

function run(command, args) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  })
  if (result.status !== 0) throw new Error(`${command} failed (${result.status}): ${result.stderr || result.stdout}`)
  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)
}
