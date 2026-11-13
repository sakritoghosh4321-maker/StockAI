async function testSymbol(symbol) {
    const url =
        `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=5d&interval=1d`;

    try {
        const response = await fetch(url, {
            headers: { "User-Agent": "Mozilla/5.0" }
        });

        const data = await response.json();
        const chart = data.chart?.result?.[0];

        console.log("\nSymbol:", symbol);
        console.log("HTTP:", response.status);
        console.log("Provider error:", data.chart?.error?.description || "None");
        console.log("Currency:", chart?.meta?.currency || "Unavailable");
        console.log("Latest close:", chart?.indicators?.quote?.[0]?.close?.filter(Number.isFinite).at(-1) ?? "Unavailable");
    } catch (error) {
        console.log(symbol, "FAILED:", error.message);
    }
}

(async () => {
    await testSymbol("TCS.NS");
    await testSymbol("532540.BO");
})();
