$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$serverTarget = "huy1111@100.114.150.77"
$serverRoot = "/home/huy1111/apps/datn-monitor"

Write-Output "Upload the collector recovery fix. Enter your SSH password if requested."
& scp (Join-Path $projectRoot "backend/src/readings/archive.service.ts") "${serverTarget}:${serverRoot}/archive.service.ts.pending"
if ($LASTEXITCODE -ne 0) { throw "Source upload failed; server source has not been changed." }
& scp (Join-Path $PSScriptRoot "install-archive-recovery.sh") "${serverTarget}:${serverRoot}/install-archive-recovery.sh"
if ($LASTEXITCODE -ne 0) { throw "Installer upload failed; server source has not been changed." }
& ssh -t $serverTarget "cd $serverRoot && bash install-archive-recovery.sh"
if ($LASTEXITCODE -ne 0) { throw "Deployment did not finish. Review the server output above." }
