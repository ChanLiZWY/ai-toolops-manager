[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$File
)

$ErrorActionPreference = 'Stop'
$certificate = $env:AI_TOOLOPS_SIGN_CERTIFICATE
$password = $env:AI_TOOLOPS_SIGN_PASSWORD
$timestampUrl = if ($env:AI_TOOLOPS_TIMESTAMP_URL) { $env:AI_TOOLOPS_TIMESTAMP_URL } else { 'http://timestamp.digicert.com' }

if (-not $certificate -or -not $password) {
  throw 'Signing requires AI_TOOLOPS_SIGN_CERTIFICATE and AI_TOOLOPS_SIGN_PASSWORD.'
}
if (-not (Test-Path -LiteralPath $File)) {
  throw "Signing target does not exist: $File"
}
if (-not (Test-Path -LiteralPath $certificate)) {
  throw "Signing certificate does not exist: $certificate"
}

$signTool = Get-Command signtool.exe -ErrorAction SilentlyContinue
if (-not $signTool) {
  $candidate = Get-ChildItem "${env:ProgramFiles(x86)}\Windows Kits\10\bin" -Filter signtool.exe -Recurse -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -match '\\x64\\signtool\.exe$' } |
    Sort-Object FullName -Descending |
    Select-Object -First 1
  if (-not $candidate) {
    throw 'signtool.exe was not found. Install the Windows SDK signing tools.'
  }
  $signToolPath = $candidate.FullName
} else {
  $signToolPath = $signTool.Source
}

& $signToolPath sign /fd SHA256 /td SHA256 /tr $timestampUrl /f $certificate /p $password $File
if ($LASTEXITCODE -ne 0) {
  throw "signtool sign failed with exit code $LASTEXITCODE."
}
& $signToolPath verify /pa /all $File
if ($LASTEXITCODE -ne 0) {
  throw "signtool verification failed with exit code $LASTEXITCODE."
}

$signature = Get-AuthenticodeSignature -LiteralPath $File
if ($signature.Status -ne 'Valid') {
  throw "Authenticode signature is not valid: $($signature.StatusMessage)"
}
Write-Host "Signed and verified $File"
