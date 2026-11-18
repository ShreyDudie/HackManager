$env:NO_PROXY = "localhost,127.0.0.1"

# Free ports first
Get-NetTCPConnection -LocalPort 8000, 8080 -ErrorAction SilentlyContinue | ForEach-Object {
    Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 1

Write-Host "Starting Backend on port 8000..."
$backendProcess = Start-Process -FilePath "cmd.exe" -ArgumentList "/c npx tsx src/server.ts" -WorkingDirectory "D:\Projects\HackManager\backend-node" -PassThru -NoNewWindow

Write-Host "Starting Frontend on port 8080..."
$frontendProcess = Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run dev" -WorkingDirectory "D:\Projects\HackManager\Frontend" -PassThru -NoNewWindow

# Wait for both ports
$retries = 30
$backendReady = $false
$frontendReady = $false

for ($i = 0; $i -lt $retries; $i++) {
    Start-Sleep -Seconds 1
    if (-not $backendReady) {
        try {
            $resp = Invoke-WebRequest -Uri "http://127.0.0.1:8000/health" -UseBasicParsing -TimeoutSec 1 -ErrorAction SilentlyContinue
            if ($resp.StatusCode -eq 200) {
                $backendReady = $true
                Write-Host "Backend is ready!"
            }
        } catch {}
    }
    if (-not $frontendReady) {
        try {
            $resp = Invoke-WebRequest -Uri "http://127.0.0.1:8080" -UseBasicParsing -TimeoutSec 1 -ErrorAction SilentlyContinue
            if ($resp.StatusCode -eq 200) {
                $frontendReady = $true
                Write-Host "Frontend is ready!"
            }
        } catch {}
    }
    if ($backendReady -and $frontendReady) { break }
}

if (-not ($backendReady -and $frontendReady)) {
    Write-Host "Failed to start servers in time. Backend: $backendReady, Frontend: $frontendReady"
    Stop-Process -Id $backendProcess.Id -Force -ErrorAction SilentlyContinue
    Stop-Process -Id $frontendProcess.Id -Force -ErrorAction SilentlyContinue
    exit 1
}

Write-Host "Running Playwright Browser Verification..."
$testProcess = Start-Process -FilePath "node" -ArgumentList "D:\Projects\HackManager\Frontend\tests\browser\test-hackathon-stages.cjs" -PassThru -Wait -NoNewWindow

$exitCode = $testProcess.ExitCode

Write-Host "Cleaning up test processes..."
Stop-Process -Id $backendProcess.Id -Force -ErrorAction SilentlyContinue
Stop-Process -Id $frontendProcess.Id -Force -ErrorAction SilentlyContinue

Get-NetTCPConnection -LocalPort 8000, 8080 -ErrorAction SilentlyContinue | ForEach-Object {
    Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
}

exit $exitCode
