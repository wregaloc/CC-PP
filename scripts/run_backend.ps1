<#
.SYNOPSIS
    Levanta el backend de PodPulse (FastAPI + Uvicorn) en modo desarrollo local, sin Docker.
#>

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$BackendDir = Join-Path $RepoRoot "backend"
$VenvActivate = Join-Path $BackendDir ".venv\Scripts\Activate.ps1"

if (-not (Test-Path $VenvActivate)) {
    Write-Host "No se encontro el entorno virtual. Ejecuta primero .\scripts\setup_dev.ps1" -ForegroundColor Red
    exit 1
}

Push-Location $BackendDir
try {
    & $VenvActivate
    uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
} finally {
    Pop-Location
}
