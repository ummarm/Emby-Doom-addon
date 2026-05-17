$ErrorActionPreference = "Stop"

$repoPath = "C:\server\Emby-Doom-addon"

Set-Location $repoPath
git pull --ff-only
docker compose up -d
docker compose restart emby-doom-addon
