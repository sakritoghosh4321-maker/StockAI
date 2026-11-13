
$ErrorActionPreference = "Stop"

$serverFile = Join-Path $PSScriptRoot "server.js"
$backupFile = Join-Path $PSScriptRoot "server-backup-before-market-update.js"

if (!(Test-Path $serverFile)) {
    throw "server.js not found. No changes made."
}

if (!(Test-Path $backupFile)) {
    throw "Backup not found. No changes made."
}

$source = Get-Content $serverFile -Raw

$pattern = '(?s)app\.get\("/api/market",\s*\(req,\s*res\)\s*=>\s*\{.*?\r?\n\}\);\s*(?=\r?\n\s*/\*\s*=+\s*\r?\n\s*INDIVIDUAL COMPANY PROFILE API)'

if ($source -notmatch $pattern) {
    throw "Could not safely identify the market API. server.js was not changed."
}

$replacement = @'
app.get("/api/market", async (req, res) => {
    const indexSymbols = [
        { name: "NIFTY 50", symbol: "^NSEI" },
        { name: "SENSEX", symbol: "^BSESN" },
        { name: "BANK NIFTY", symbol: "^NSEBANK" }
    ];

    const stockSymbols = [
        { name: "Adani Power", symbol: "ADANIPOWER", yahoo: "ADANIPOWER.NS" },
        { name: "Bharat Electronics", symbol: "BEL", yahoo: "BEL.NS" },
        { name: "Reliance Industries", symbol: "RELIANCE", yahoo: "RELIANCE.NS" },
        { name: "Tata Motors", symbol: "TATAMOTORS", yahoo: "TATAMOTORS.NS" },
        { name: "State Bank of India", symbol: "SBIN", yahoo: "SBIN.NS" },
        { name: "TCS", symbol: "TCS", yahoo: "TCS.NS" }
    ];

    async function getQuote(item, isIndex = false) {
        const providerSymbol = isIndex ? item.symbol : item.yahoo;
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(providerSymbol)}?range=5d&interval=1d`;

        try {
            const response = await fetch(url, {
                headers: { "User-Agent": "Mozilla/5.0" },
                signal: AbortSignal.timeout(12000)
            });

            if (!response.ok) {
                throw new Error(`Provider HTTP ${response.status}`);
            }

            const json = await response.json();
            const chart = json.chart?.result?.[0];
            const timestamps = chart?.timestamp || [];
            const closes = chart?.indicators?.quote?.[0]?.close || [];

            const valid = timestamps
                .map((timestamp, i) => ({ timestamp, close: closes[i] }))
                .filter(point => Number.isFinite(point.close));

            if (valid.length === 0) {
                throw new Error("No closing prices returned");
            }

            const latest = valid[valid.length - 1];
            const previous = valid.length > 1 ? valid[valid.length - 2] : null;
            const change = previous ? latest.close - previous.close : null;

            return {
                name: item.name,
                symbol: item.symbol,
                value: Number(latest.close.toFixed(2)),
                price: Number(latest.close.toFixed(2)),
                change: change === null ? null : Number(change.toFixed(2)),
                changePercent: previous && previous.close !== 0
                    ? Number(((change / previous.close) * 100).toFixed(2))
                    : null,
                currency: chart.meta?.currency || "INR",
                providerSymbol,
                timestamp: latest.timestamp,
                dataStatus: "PROVIDER DATA"
            };
        } catch (error) {
            return {
                name: item.name,
                symbol: item.symbol,
                value: null,
                price: null,
                change: null,
                changePercent: null,
                providerSymbol,
                dataStatus: "UNAVAILABLE",
                error: error.message
            };
        }
    }

    const indices = await Promise.all(
        indexSymbols.map(item => getQuote(item, true))
    );

    const stocks = await Promise.all(
        stockSymbols.map(item => getQuote(item))
    );

    const availableStocks = stocks.filter(item => item.price !== null);

    const gainers = availableStocks
        .filter(item => item.change !== null && item.change > 0)
        .sort((a, b) => b.changePercent - a.changePercent);

    const losers = availableStocks
        .filter(item => item.change !== null && item.change < 0)
        .sort((a, b) => a.changePercent - b.changePercent);

    res.json({
        status: "success",
        dataStatus: "PROVIDER DATA WITH POSSIBLE UNAVAILABLE SYMBOLS",
        provider: "Yahoo Finance (unofficial; data may be delayed)",
        indices,
        gainers,
        losers,
        marketBreadth: {
            advancing: availableStocks.filter(item => item.change > 0).length,
            declining: availableStocks.filter(item => item.change < 0).length,
            unchanged: availableStocks.filter(item => item.change === 0).length,
            totalTracked: availableStocks.length
        },
        marketStatus: {
            market: "Indian Equity Market",
            status: "Check exchange hours separately",
            lastUpdated: new Date().toISOString()
        },
        stockData: stocks
    });
});
'@

$updated = [regex]::Replace($source, $pattern, $replacement, 1)

if ($updated -eq $source) {
    throw "No changes made. The market API replacement did not alter server.js."
}

Set-Content -Path $serverFile -Value $updated -Encoding utf8

Write-Host "Market API updated successfully." -ForegroundColor Green
Write-Host "Backup retained: $backupFile"
