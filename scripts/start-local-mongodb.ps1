$ErrorActionPreference = "Stop"
$projectRoot = Split-Path $PSScriptRoot -Parent
$mongoExe = Get-ChildItem -LiteralPath "C:\Program Files\MongoDB\Server" -Filter mongod.exe -Recurse | Sort-Object FullName -Descending | Select-Object -First 1
if (-not $mongoExe) { throw "MongoDB is not installed." }
$listener = Get-NetTCPConnection -LocalPort 27017 -State Listen -ErrorAction SilentlyContinue
if ($listener) { Write-Output "Port 27017 already has a listener; no second MongoDB started."; exit 0 }
$dataPath = Join-Path $projectRoot ".local\mongodb\data"
$logPath = Join-Path $projectRoot ".local\mongodb\mongo.log"
New-Item -ItemType Directory -Force -Path $dataPath | Out-Null
Start-Process -FilePath $mongoExe.FullName -ArgumentList @("--dbpath", "`"$dataPath`"", "--logpath", "`"$logPath`"", "--logappend", "--bind_ip", "127.0.0.1", "--port", "27017") -WindowStyle Hidden
Write-Output "MongoDB starting on localhost:27017. Log: $logPath"
