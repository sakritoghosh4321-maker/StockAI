
app.get("/api/technical-analysis/:symbol", async (req, res) => {
    const symbols = {
        RELIANCE: "RELIANCE.NS",
        TATAMOTORS: "TATAMOTORS.NS",
        BEL: "BEL.NS",
        ADANIPOWER: "ADANIPOWER.NS",
        TCS: "TCS.NS",
        SBIN: "SBIN.NS"
    };

    try {
        const symbol = String(req.params.symbol || "").toUpperCase();
        const providerSymbol = symbols[symbol];

        if (!providerSymbol) {
            return res.status(400).json({
                status: "error",
                message: "Unsupported symbol.",
                supportedSymbols: Object.keys(symbols)
            });
        }

        const url =
            `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(providerSymbol)}?range=1y&interval=1d`;

        const response = await fetch(url, {
            headers: { "User-Agent": "Mozilla/5.0" }
        });

        if (!response.ok) {
            return res.status(502).json({
                status: "error",
                dataStatus: "PROVIDER ERROR",
                message: `Historical data provider returned HTTP ${response.status}.`
            });
        }

        const payload = await response.json();
        const result = payload?.chart?.result?.[0];

        if (!result) {
            return res.status(502).json({
                status: "error",
                dataStatus: "PROVIDER DATA UNAVAILABLE",
                message: "No historical prices were returned."
            });
        }

        const closes = (result.indicators?.quote?.[0]?.close || [])
            .map(Number)
            .filter(Number.isFinite);

        const highs = (result.indicators?.quote?.[0]?.high || [])
            .map(Number);
        const lows = (result.indicators?.quote?.[0]?.low || [])
            .map(Number);

        // Yahoo arrays can contain nulls, so retain aligned OHLC records.
        const quote = result.indicators?.quote?.[0] || {};
        const timestamps = result.timestamp || [];
        const records = timestamps.map((timestamp, i) => ({
            timestamp,
            close: quote.close?.[i],
            high: quote.high?.[i],
            low: quote.low?.[i]
        })).filter(row =>
            Number.isFinite(row.close) &&
            Number.isFinite(row.high) &&
            Number.isFinite(row.low)
        );

        const prices = records.map(row => Number(row.close));

        if (prices.length < 30) {
            return res.status(502).json({
                status: "error",
                dataStatus: "INSUFFICIENT HISTORICAL DATA",
                message: "At least 30 valid daily records are required."
            });
        }

        const last = prices[prices.length - 1];

        const average = values =>
            values.reduce((sum, value) => sum + value, 0) / values.length;

        const sma = (values, period) =>
            values.length >= period
                ? average(values.slice(-period))
                : null;

        const emaSeries = (values, period) => {
            if (values.length < period) return [];
            const output = [];
            let current = average(values.slice(0, period));
            output.push(current);
            const multiplier = 2 / (period + 1);

            for (let i = period; i < values.length; i++) {
                current = values[i] * multiplier +
                    current * (1 - multiplier);
                output.push(current);
            }
            return output;
        };

        const ema = (values, period) => {
            const series = emaSeries(values, period);
            return series.length ? series[series.length - 1] : null;
        };

        const round = value =>
            Number.isFinite(value) ? Number(value.toFixed(2)) : null;

        // RSI using average gains and losses over the last 14 changes.
        const changes = prices.slice(1).map((price, i) =>
            price - prices[i]
        );
        const recentChanges = changes.slice(-14);
        const gains = recentChanges.map(v => Math.max(v, 0));
        const losses = recentChanges.map(v => Math.max(-v, 0));
        const avgGain = average(gains);
        const avgLoss = average(losses);

        let rsi = null;
        if (avgLoss === 0) {
            rsi = avgGain === 0 ? 50 : 100;
        } else {
            rsi = 100 - 100 / (1 + avgGain / avgLoss);
        }

        // MACD line and its 9-period signal line.
        const ema12 = emaSeries(prices, 12);
        const ema26 = emaSeries(prices, 26);
        const macdSeries = [];
        const offset = 26 - 12;

        for (let i = 0; i < ema26.length; i++) {
            macdSeries.push(ema12[i + offset] - ema26[i]);
        }

        const macd = macdSeries.length
            ? macdSeries[macdSeries.length - 1]
            : null;
        const macdSignal = ema(macdSeries, 9);

        const sma20 = sma(prices, 20);
        const sma50 = sma(prices, 50);
        const sma200 = sma(prices, 200);
        const ema20 = ema(prices, 20);

        const last20 = prices.slice(-20);
        const bollingerMiddle = average(last20);
        const variance = average(
            last20.map(price => (price - bollingerMiddle) ** 2)
        );
        const standardDeviation = Math.sqrt(variance);

        const returns = [];
        for (let i = 1; i < prices.length; i++) {
            if (prices[i - 1] > 0) {
                returns.push(prices[i] / prices[i - 1] - 1);
            }
        }

        const recentReturns = returns.slice(-20);
        const returnMean = average(recentReturns);
        const returnVariance = average(
            recentReturns.map(value => (value - returnMean) ** 2)
        );
        const annualizedVolatility = Math.sqrt(returnVariance) *
            Math.sqrt(252) * 100;

        const recentRecords = records.slice(-60);
        const lows20 = records.slice(-20).map(row => row.low);
        const highs20 = records.slice(-20).map(row => row.high);
        const earlierRecords = recentRecords.slice(0, 40);
        const earlierLows = earlierRecords.map(row => row.low);
        const earlierHighs = earlierRecords.map(row => row.high);

        const support = [
            Math.min(...lows20),
            earlierLows.length ? Math.min(...earlierLows) : null
        ].filter(Number.isFinite).map(round);

        const resistance = [
            Math.max(...highs20),
            earlierHighs.length ? Math.max(...earlierHighs) : null
        ].filter(Number.isFinite).map(round);

        let trend = "NEUTRAL";
        if (sma20 !== null && sma50 !== null) {
            if (last > sma20 && sma20 > sma50) trend = "BULLISH";
            else if (last < sma20 && sma20 < sma50) trend = "BEARISH";
        }

        let signal = "NEUTRAL";
        if (macd !== null && macdSignal !== null &&
            rsi < 70 && macd > macdSignal) {
            signal = "BULLISH MOMENTUM";
        } else if (macd !== null && macdSignal !== null &&
            rsi > 30 && macd < macdSignal) {
            signal = "BEARISH MOMENTUM";
        }

        const volatility = annualizedVolatility < 20
            ? "LOW"
            : annualizedVolatility < 40
                ? "MODERATE"
                : "HIGH";

        return res.json({
            status: "success",
            dataStatus: "PROVIDER DATA — CALCULATED INDICATORS",
            source: "Yahoo Finance chart history",
            asOf: new Date(records[records.length - 1].timestamp * 1000)
                .toISOString(),
            historicalObservations: prices.length,
            technicalAnalysis: {
                symbol,
                currentPrice: round(last),
                trend,
                signal,
                volatility,
                annualizedHistoricalVolatility: round(annualizedVolatility),
                support,
                resistance,
                indicators: {
                    sma20: round(sma20),
                    sma50: round(sma50),
                    sma200: round(sma200),
                    ema20: round(ema20),
                    rsi: round(rsi),
                    macd: round(macd),
                    macdSignal: round(macdSignal),
                    bollingerUpper: round(
                        bollingerMiddle + 2 * standardDeviation
                    ),
                    bollingerMiddle: round(bollingerMiddle),
                    bollingerLower: round(
                        bollingerMiddle - 2 * standardDeviation
                    )
                }
            },
            disclaimer:
                "Indicators are calculated from historical daily prices. " +
                "They are not guaranteed forecasts or personalized investment advice."
        });
    } catch (error) {
        console.error("Technical Analysis API Error:", error.message);
        return res.status(500).json({
            status: "error",
            message: "Unable to calculate technical analysis."
        });
    }
});
