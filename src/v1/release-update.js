import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { createActionPlan, executeTransaction } from './transaction.js'
import { windowsPaths } from './windows-store.js'
import { RELEASE_REPOSITORY, VERSION } from '../version.js'

const SETUP_ASSET = 'ai-toolops-setup.exe'

export async function checkLatestRelease(options = {}) {
  const repository = String(options.repository || RELEASE_REPOSITORY)
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) throw new Error(`无效的 GitHub 仓库：${repository}`)
  const fetchImpl = options.fetchImpl || fetch
  const response = await fetchImpl(`https://api.github.com/repos/${repository}/releases/latest`, {
    headers: {
      accept: 'application/vnd.github+json',
      'user-agent': `ai-toolops-manager/${options.currentVersion || VERSION}`,
      'x-github-api-version': '2022-11-28'
    },
    signal: options.signal || AbortSignal.timeout(15000)
  })
  if (!response.ok) throw new Error(`检查更新失败：GitHub HTTP ${response.status}`)
  const release = await response.json()
  if (release.draft || release.prerelease) throw new Error('GitHub latest Release 不是稳定版本')
  const latestVersion = normalizeVersion(release.tag_name)
  const currentVersion = normalizeVersion(options.currentVersion || VERSION)
  const asset = Array.isArray(release.assets)
    ? release.assets.find((item) => item?.name === SETUP_ASSET)
    : null
  if (!asset) throw new Error(`Release ${release.tag_name} 缺少唯一安装资产 ${SETUP_ASSET}`)
  const digest = parseDigest(asset.digest)
  if (!digest) throw new Error(`Release ${release.tag_name} 的安装资产缺少 GitHub SHA-256 摘要`)
  const downloadUrl = String(asset.browser_download_url || '')
  const expectedPrefix = `https://github.com/${repository}/releases/download/`
  if (!downloadUrl.toLowerCase().startsWith(expectedPrefix.toLowerCase())) {
    throw new Error('Release 安装资产下载地址不属于预期 GitHub 仓库')
  }
  const comparison = compareVersions(latestVersion, currentVersion)
  return {
    status: comparison > 0 ? 'update-available' : comparison === 0 ? 'up-to-date' : 'ahead-of-release',
    currentVersion,
    latestVersion,
    releaseUrl: String(release.html_url || ''),
    publishedAt: release.published_at || null,
    asset: {
      name: SETUP_ASSET,
      url: downloadUrl,
      size: Number(asset.size || 0),
      digest
    }
  }
}

export function planReleaseUpdate(release, options = {}) {
  if (release?.status !== 'update-available') throw new Error('没有可安装的新版本')
  const paths = windowsPaths(options.machine || {})
  const defaultInstallRoot = path.join(process.env.LOCALAPPDATA || path.dirname(paths.root), 'Programs', 'ai-toolops')
  const configuredTarget = options.target || process.env.AI_TOOLOPS_EXECUTABLE
  const runningExecutable = path.basename(process.execPath).toLowerCase() === 'ai-toolops.exe' ? process.execPath : null
  const installRoot = path.resolve(options.installRoot || (configuredTarget ? path.dirname(configuredTarget) : null) || (runningExecutable ? path.dirname(runningExecutable) : defaultInstallRoot))
  const target = path.resolve(configuredTarget || runningExecutable || path.join(installRoot, 'ai-toolops.exe'))
  return createActionPlan({
    action: 'release-update',
    providerId: 'core.release-update',
    tool: 'ai-toolops',
    changes: [{ scope: 'machine', operation: 'install-release-after-exit', target, version: release.latestVersion }],
    permissions: {
      network: true,
      processes: ['powershell.exe', SETUP_ASSET, 'ai-toolops.exe'],
      writePaths: [installRoot, paths.cache, paths.receipts]
    },
    details: {
      currentVersion: release.currentVersion,
      version: release.latestVersion,
      releaseUrl: release.releaseUrl,
      source: release.asset.url,
      checksum: release.asset.digest,
      assetSize: release.asset.size,
      installRoot,
      target
    }
  })
}

export function applyReleaseUpdate(plan, options = {}) {
  const paths = windowsPaths(options.machine || {})
  let staged = null
  let helper = null
  return executeTransaction(plan, async (transaction) => {
    staged = path.join(paths.cache, `${SETUP_ASSET.replace('.exe', '')}-${plan.id}.exe`)
    helper = path.join(paths.cache, `complete-release-update-${plan.id}.ps1`)
    await download(plan.details.source, staged, options.fetchImpl)
    const actual = sha256(staged)
    if (actual.toLowerCase() !== String(plan.details.checksum).toLowerCase()) {
      throw new Error(`安装包 SHA-256 不匹配：expected=${plan.details.checksum} actual=${actual}`)
    }
    fs.writeFileSync(helper, releaseUpdateHelperScript(), 'utf8')
    transaction.step('release-update.staged', { version: plan.details.version, checksum: actual })
    if (options.launchHelper !== false) {
      const spawnImpl = options.spawnImpl || spawn
      const child = spawnImpl('powershell.exe', [
        '-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
        '-File', helper,
        '-ParentPid', String(process.pid),
        '-Setup', staged,
        '-InstallRoot', plan.details.installRoot,
        '-Target', plan.details.target,
        '-ExpectedVersion', plan.details.version,
        '-Receipt', transaction.receiptFile
      ], { detached: true, stdio: 'ignore', windowsHide: true })
      child.unref()
      transaction.step('release-update.helper-launched')
    }
    return {
      status: options.launchHelper === false ? 'staged' : 'scheduled',
      version: plan.details.version,
      target: plan.details.target,
      helper,
      staged,
      checksum: actual,
      deferredCompletion: options.launchHelper !== false
    }
  }, {
    machine: options.machine,
    dryRun: options.dryRun,
    confirmed: options.confirmed,
    rollback: async () => {
      if (staged) fs.rmSync(staged, { force: true })
      if (helper) fs.rmSync(helper, { force: true })
      return { stagedFilesRemoved: true }
    }
  })
}

export function compareVersions(left, right) {
  const a = normalizeVersion(left).split('.').map(Number)
  const b = normalizeVersion(right).split('.').map(Number)
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1
  }
  return 0
}

function normalizeVersion(value) {
  const match = String(value || '').trim().match(/^v?(\d+)\.(\d+)\.(\d+)$/)
  if (!match) throw new Error(`不支持的版本号：${value}`)
  return `${Number(match[1])}.${Number(match[2])}.${Number(match[3])}`
}

function parseDigest(value) {
  const match = String(value || '').match(/^sha256:([a-fA-F0-9]{64})$/)
  return match?.[1]?.toLowerCase() || null
}

async function download(source, destination, fetchImpl = fetch) {
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  const response = await fetchImpl(source, {
    redirect: 'follow',
    headers: { 'user-agent': `ai-toolops-manager/${VERSION}` },
    signal: AbortSignal.timeout(120000)
  })
  if (!response.ok) throw new Error(`安装包下载失败：HTTP ${response.status}`)
  fs.writeFileSync(destination, Buffer.from(await response.arrayBuffer()))
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}

function releaseUpdateHelperScript() {
  return `[CmdletBinding()]
param(
  [int]$ParentPid,
  [string]$Setup,
  [string]$InstallRoot,
  [string]$Target,
  [string]$ExpectedVersion,
  [string]$Receipt
)
$ErrorActionPreference = 'Stop'
function Complete-Receipt {
  param(
    [string]$Status,
    [string]$ErrorMessage
  )
  if (-not $Receipt -or -not (Test-Path -LiteralPath $Receipt)) { return }
  $value = Get-Content -LiteralPath $Receipt -Raw | ConvertFrom-Json
  $value.status = $Status
  $value.finishedAt = [DateTime]::UtcNow.ToString('o')
  if ($value.result) {
    $value.result.status = $Status
    $value.result.deferredCompletion = $false
  }
  if ($ErrorMessage) {
    $value.error = [pscustomobject]@{ message = $ErrorMessage; code = 'UPDATE_HELPER_FAILED' }
  } else {
    $value.error = $null
  }
  $temporary = "$Receipt.tmp-$PID"
  $json = $value | ConvertTo-Json -Depth 20
  $utf8 = New-Object System.Text.UTF8Encoding($false)
  [IO.File]::WriteAllText($temporary, $json + [Environment]::NewLine, $utf8)
  Move-Item -LiteralPath $temporary -Destination $Receipt -Force
}
Wait-Process -Id $ParentPid -ErrorAction SilentlyContinue
try {
  & $Setup --silent --install-root $InstallRoot --no-launch
  if ($LASTEXITCODE -ne 0) { throw "Setup failed with exit code $LASTEXITCODE." }
  $actual = (& $Target --version | Out-String).Trim()
  if ($LASTEXITCODE -ne 0 -or $actual -ne $ExpectedVersion) {
    throw "Updated executable validation failed. expected=$ExpectedVersion actual=$actual"
  }
  Complete-Receipt -Status 'succeeded'
} catch {
  Complete-Receipt -Status 'failed' -ErrorMessage $_.Exception.Message
  throw
} finally {
  Remove-Item -LiteralPath $Setup -Force -ErrorAction SilentlyContinue
}
`
}
