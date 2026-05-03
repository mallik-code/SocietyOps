# build.ps1 - Windows Build Script for societyops-dependencies

# 1. Load version from .env if it exists
if (Test-Path ".env") {
    Write-Host "Loading environment variables from .env..." -ForegroundColor Cyan
    Get-Content .env | Where-Object { $_ -match "=" -and $_ -notmatch "^#" } | ForEach-Object {
        $name, $value = $_.Split('=', 2)
        [System.Environment]::SetEnvironmentVariable($name.Trim(), $value.Trim())
    }
}

# 2. Check if the specific SOCIETYOPS_DEPENDENCIES_PACKAGE_VERSION is set
$packageVersion = [System.Environment]::GetEnvironmentVariable("SOCIETYOPS_DEPENDENCIES_PACKAGE_VERSION")
if (-not $packageVersion) {
    Write-Error "SOCIETYOPS_DEPENDENCIES_PACKAGE_VERSION is not set. Please set it in your environment or .env file."
    exit 1
}

Write-Host "Building societyops-dependencies version: $packageVersion" -ForegroundColor Green

# 3. Replace placeholder and generate pyproject.toml
$template = Get-Content "pyproject.template.toml" -Raw
$finalContent = $template.Replace("`$SOCIETYOPS_DEPENDENCIES_PACKAGE_VERSION", $packageVersion)
$finalContent | Out-File -FilePath "pyproject.toml" -Encoding utf8

# 4. Build the package
Write-Host "Running python build..." -ForegroundColor Yellow
python -m build

Write-Host "Build complete! Artifacts are in the 'dist/' directory." -ForegroundColor Green
