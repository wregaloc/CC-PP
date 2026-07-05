<#
.SYNOPSIS
    Prepara el entorno de desarrollo local de PodPulse (backend + frontend), sin Docker.
.DESCRIPTION
    Idempotente: puede volver a ejecutarse en cualquier momento para sincronizar el entorno
    con requirements.txt / package.json actualizados, sin necesidad de borrar nada manualmente.
#>

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$BackendDir = Join-Path $RepoRoot "backend"
$FrontendDir = Join-Path $RepoRoot "frontend"

Write-Host "== PodPulse: configurando entorno de desarrollo local ==" -ForegroundColor Cyan

# ---------- Backend ----------
Write-Host "`n-- Backend (Python / FastAPI) --" -ForegroundColor Yellow

$VenvDir = Join-Path $BackendDir ".venv"
if (-not (Test-Path $VenvDir)) {
    Write-Host "Creando entorno virtual en $VenvDir"
    python -m venv $VenvDir
} else {
    Write-Host "Entorno virtual ya existe en $VenvDir"
}

$VenvPython = Join-Path $VenvDir "Scripts\python.exe"
& $VenvPython -m pip install --upgrade pip
& $VenvPython -m pip install -r (Join-Path $BackendDir "requirements.txt")

$BackendEnv = Join-Path $BackendDir ".env"
$BackendEnvExample = Join-Path $BackendDir ".env.example"
if (-not (Test-Path $BackendEnv)) {
    Copy-Item $BackendEnvExample $BackendEnv
    Write-Host "Se creo backend\.env a partir de .env.example. Editalo con la cadena de conexion (DATABASE_URL) de tu proyecto Supabase de desarrollo -- ver database\README.md." -ForegroundColor Magenta
} else {
    Write-Host "backend\.env ya existe, no se sobrescribe."
}

# ---------- Frontend ----------
Write-Host "`n-- Frontend (React / Vite) --" -ForegroundColor Yellow

$NodeModulesDir = Join-Path $FrontendDir "node_modules"
Write-Host "Instalando/actualizando dependencias de npm..."
Push-Location $FrontendDir
npm install
Pop-Location

$FrontendEnv = Join-Path $FrontendDir ".env"
$FrontendEnvExample = Join-Path $FrontendDir ".env.example"
if (-not (Test-Path $FrontendEnv)) {
    Copy-Item $FrontendEnvExample $FrontendEnv
    Write-Host "Se creo frontend\.env a partir de .env.example." -ForegroundColor Magenta
} else {
    Write-Host "frontend\.env ya existe, no se sobrescribe."
}

Write-Host "`n== Entorno listo. Usa run_backend.ps1 y run_frontend.ps1 para levantar el proyecto. ==" -ForegroundColor Green
