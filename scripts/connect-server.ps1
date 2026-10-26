$ErrorActionPreference = "Stop"
Write-Output "Connecting the local website to the Ubuntu API. Keep this window open while viewing history and alerts."
Write-Output "The server continues collecting measurements when this connection is closed."
ssh -N -L 127.0.0.1:3001:127.0.0.1:3000 -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=3 huy1111@100.114.150.77
