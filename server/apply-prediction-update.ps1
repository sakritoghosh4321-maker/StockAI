
$ErrorActionPreference = "Stop"

$serverPath = Join-Path $PSScriptRoot "server.js"
$routePath = Join-Path $PSScriptRoot "prediction-route.js.txt"
$backupPath = Join-Path $PSScriptRoot "server-before-prediction-final-update.js"

if (!(Test-Path $serverPath)) { throw "server.js not found." }
if (!(Test-Path $routePath)) { throw "prediction-route.js.txt not found." }

$content = [System.IO.File]::ReadAllText($serverPath)
$newRoute = [System.IO.File]::ReadAllText($routePath).Trim()

$startMarker = 'app.get("/api/prediction/:symbol", async (req, res) => {'
$riskMarker = 'RISK ANALYSIS API'

if (([regex]::Matches($content, [regex]::Escape($startMarker))).Count -ne 1) {
    throw "Expected exactly one prediction route. No changes made."
}

$start = $content.IndexOf($startMarker)
$risk = $content.IndexOf($riskMarker, $start)

if ($risk -lt 0) {
    throw "Risk analysis section not found after prediction route. No changes made."
}

$close = $content.LastIndexOf("});", $risk)

if ($close -lt $start) {
    throw "Could not find the end of the prediction route. No changes made."
}

$close += 3
$oldRoute = $content.Substring($start, $close - $start)

if ($oldRoute -notmatch 'Demo Random Forest Model') {
    throw "The expected original demo route was not found. No changes made."
}

if ($newRoute -notmatch 'BASELINE ESTIMATE') {
    throw "Replacement file is missing the expected new route. No changes made."
}

$newContent = $content.Substring(0, $start) + $newRoute + $content.Substring($close)

Copy-Item $serverPath $backupPath -ErrorAction Stop

[System.IO.File]::WriteAllText(
    $serverPath,
    $newContent,
    [System.Text.UTF8Encoding]::new($false)
)

Write-Host "Prediction route replaced." -ForegroundColor Green
Write-Host "Backup saved: $backupPath"
