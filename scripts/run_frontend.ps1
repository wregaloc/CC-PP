<#
.SYNOPSIS
    Levanta el frontend de PodPulse (Vite + React) en modo desarrollo local, sin Docker.
.DESCRIPTION
    Instala dependencias automaticamente si node_modules no existe todavia o si
    package-lock.json cambio mas recientemente que node_modules.
#>

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$FrontendDir = Join-Path $RepoRoot "frontend"
$NodeModulesDir = Join-Path $FrontendDir "node_modules"
$LockFile = Join-Path $FrontendDir "package-lock.json"

Push-Location $FrontendDir
try {
    $needsInstall = $false
    if (-not (Test-Path $NodeModulesDir)) {
        $needsInstall = $true
    } elseif ((Test-Path $LockFile) -and ((Get-Item $LockFile).LastWriteTime -gt (Get-Item $NodeModulesDir).LastWriteTime)) {
        $needsInstall = $true
    }

    if ($needsInstall) {
        Write-Host "Instalando/actualizando dependencias de npm..." -ForegroundColor Yellow
        npm install
    }

    npm run dev
} finally {
    Pop-Location
}
