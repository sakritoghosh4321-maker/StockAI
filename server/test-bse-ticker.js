async function test(symbol) {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=5d&interval=1d`;

    try {
        const response = await fetch(url, {
            headers: { "User-Agent": "Mozilla/5.0" }
        });
        const data = await response.json();
        const chart = data.chart?.result?.[0];

        console.log({
            symbol,
            http: response.status,
            error: data.chart?.error?.description || null,
            currency: chart?.meta?.currency || null,
            latestClose: chart?.indicators?.quote?.[0]?.close?.filter(Number.isFinite).at(-1) ?? null
        });
    } catch (error) {
        console.log(symbol, error.message);
    }
}

(async () => {
    await test("TCS.BO");
})();
