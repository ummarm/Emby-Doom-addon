$ErrorActionPreference = "Stop"

$repoPath = "C:\server\Doom-addon"

Set-Location $repoPath
git pull --ff-only
docker compose up -d
docker compose restart doom-addon
