const express = require("express");
const cors = require("cors");
const pool = require("./db");
const newsRouter = require("./news");
const fundamentalsRouter = require("./fundamentals");
const corporateActionsRouter = require("./corporate-actions");
const authRouter = require("./auth");

const app = express();
const PORT = 5000;

// =====================================
// EXCHANGE-AWARE PROVIDER SYMBOL RESOLVER
// =====================================

async function resolveExchangeProviderSymbol(symbol, exchange = "NSE") {
    const normalizedSymbol = String(symbol || "").trim().toUpperCase();
    const normalizedExchange = String(exchange || "NSE").trim().toUpperCase();

    if (!["NSE", "BSE"].includes(normalizedExchange)) {
        return {
            ok: false,
            statusCode: 400,
            message: "Invalid exchange. Select NSE or BSE."
        };
    }

    if (!normalizedSymbol) {
        return {
            ok: false,
            statusCode: 400,
            message: "A company symbol is required."
        };
    }

    const [rows] = await pool.execute(
        `SELECT
            company_name,
            symbol,
            exchange,
            exchange_symbol,
            security_code,
            isin
         FROM exchange_directory
         WHERE listing_status = 'ACTIVE'
           AND exchange = ?
           AND (
               UPPER(symbol) = ?
               OR UPPER(exchange_symbol) = ?
           )
         ORDER BY
           CASE WHEN UPPER(symbol) = ? THEN 0 ELSE 1 END
         LIMIT 1`,
        [
            normalizedExchange,
            normalizedSymbol,
            normalizedSymbol,
            normalizedSymbol
        ]
    );

    if (!rows.length || !rows[0].exchange_symbol) {
        return {
            ok: false,
            statusCode: 404,
            exchange: normalizedExchange,
            message: `No active ${normalizedExchange} listing found for ${normalizedSymbol}.`
        };
    }

    const listing = rows[0];
    const exchangeSymbol = String(listing.exchange_symbol).trim().toUpperCase();

    return {
        ok: true,
        exchange: normalizedExchange,
        symbol: listing.symbol,
        companyName: listing.company_name,
        isin: listing.isin,
        providerSymbol: `${String(listing.symbol).trim().toUpperCase()}.${normalizedExchange === "NSE" ? "NS" : "BO"}`
    };
}


app.use(express.json());
app.use(cors());
app.use("/api/auth", authRouter);


/* =====================================
   NEWS ROUTER
===================================== */

app.use("/api/news", newsRouter);
app.use("/api/fundamentals", fundamentalsRouter);
app.use("/api/corporate-actions", corporateActionsRouter);


/* =====================================
   HOME ROUTE
===================================== */

app.get("/", (req, res) => {
    res.send("StockAI JavaScript Backend is running successfully!");
});


/* =====================================
   HEALTH CHECK API
===================================== */

app.get("/api/health", (req, res) => {

    res.json({
        status: "success",
        message: "StockAI Backend is running successfully!",
        technology: "Node.js + Express + MySQL"
    });

});


/* =====================================
   MARKET DASHBOARD API
===================================== */

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
        { name: "Tata Motors Passenger Vehicles", symbol: "TMPV", yahoo: "TMPV.NS" },
        { name: "Tata Motors Commercial Vehicles", symbol: "TMCV", yahoo: "TMCV.NS" },
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
                regularMarketTime: Number.isFinite(chart.meta?.regularMarketTime)
                    ? chart.meta.regularMarketTime
                    : latest.timestamp,
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
/* =====================================
   INDIVIDUAL COMPANY PROFILE API
===================================== */

app.get("/api/companies/:symbol", async (req, res) => {
    try {
        const symbol = String(req.params.symbol || "").trim().toUpperCase();
        const exchange = String(req.query.exchange || "NSE").trim().toUpperCase();

        if (!["NSE", "BSE"].includes(exchange)) {
            return res.status(400).json({
                status: "error",
                message: "Exchange must be NSE or BSE."
            });
        }

        const [companies] = await pool.query(
            `SELECT
                id, name, symbol, sector, price,
                change_amount AS ` + "`change`" + `,
                change_percent AS changePercent
             FROM companies
             WHERE symbol = ?
             LIMIT 1`,
            [symbol]
        );

        let company = companies.length > 0 ? companies[0] : null;

        if (!company) {
            const [listings] = await pool.query(
                `SELECT
                    id,
                    company_name AS name,
                    symbol,
                    sector,
                    exchange,
                    exchange_symbol AS exchangeSymbol,
                    security_code AS securityCode,
                    isin,
                    listing_status AS listingStatus
                 FROM exchange_directory
                 WHERE symbol = ?
                   AND exchange = ?
                 ORDER BY id ASC
                 LIMIT 1`,
                [symbol, exchange]
            );

            if (listings.length === 0) {
                return res.status(404).json({
                    status: "error",
                    message: "No company profile or exchange listing was found for this symbol and exchange."
                });
            }

            company = listings[0];
        }

        let quote = null;
        let quoteError = null;

        try {
            const resolved = await resolveExchangeProviderSymbol(symbol, exchange);

            if (!resolved.ok) {
                quoteError = resolved.message;
            } else {
                const url =
                    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(resolved.providerSymbol)}?range=5d&interval=1d`;

                const response = await fetch(url, {
                    headers: { "User-Agent": "Mozilla/5.0 StockAI/1.0" },
                    signal: AbortSignal.timeout(12000)
                });

                if (!response.ok) {
                    throw new Error(`Yahoo Finance returned HTTP ${response.status}.`);
                }

                const payload = await response.json();
                const result = payload?.chart?.result?.[0];

                if (!result) {
                    throw new Error("Yahoo Finance returned no quote data.");
                }

                const meta = result.meta || {};
                const closes = (result.indicators?.quote?.[0]?.close || [])
                    .filter(value => Number.isFinite(value));

                const currentPrice = Number.isFinite(meta.regularMarketPrice)
                    ? meta.regularMarketPrice
                    : closes.length
                        ? closes[closes.length - 1]
                        : null;

                const previousClose = closes.length >= 2
                    ? closes[closes.length - 2]
                    : null;

                if (currentPrice !== null) {
                    const change = previousClose !== null
                        ? currentPrice - previousClose
                        : null;

                    quote = {
                        price: Number(currentPrice.toFixed(2)),
                        change: change !== null ? Number(change.toFixed(2)) : null,
                        changePercent: previousClose !== null && previousClose !== 0
                            ? Number(((change / previousClose) * 100).toFixed(2))
                            : null,
                        asOf: meta.regularMarketTime
                            ? new Date(meta.regularMarketTime * 1000).toISOString()
                            : null,
                        providerSymbol: resolved.providerSymbol
                    };
                } else {
                    throw new Error("No valid current price was returned.");
                }
            }
        } catch (error) {
            quoteError = error.message;
            console.error("Company Profile Quote Error:", quoteError);
        }

        return res.json({
            status: "success",
            dataStatus: quote
                ? "DATABASE COMPANY PROFILE + YAHOO FINANCE PROVIDER QUOTE"
                : "COMPANY PROFILE - PROVIDER QUOTE UNAVAILABLE",
            quoteStatus: quote ? "PROVIDER DATA" : "UNAVAILABLE",
            quoteSource: quote ? "Yahoo Finance" : null,
            quoteError,
            company: {
                ...company,
                price: quote?.price ?? null,
                change: quote?.change ?? null,
                changePercent: quote?.changePercent ?? null,
                quoteAsOf: quote?.asOf ?? null,
                providerSymbol: quote?.providerSymbol ?? null
            }
        });
    } catch (error) {
        console.error("Company Profile API Error:", error.message);
        return res.status(500).json({
            status: "error",
            message: "Unable to fetch company profile."
        });
    }
});/* =====================================
   COMPANY INTELLIGENCE API
===================================== */

app.get("/api/company-intelligence/:symbol", async (req, res) => {
    try {
        const symbol = req.params.symbol.toUpperCase();

        const [rows] = await pool.query(
            `SELECT
                id, symbol, company_overview, business_activities,
                products_services, order_book, contracts, projects,
                partnerships, future_developments, created_at, updated_at
             FROM company_intelligence
             WHERE symbol = ?
             LIMIT 1`,
            [symbol]
        );

        if (rows.length > 0) {
            return res.json({
                status: "success",
                dataStatus: "DATABASE",
                intelligence: rows[0]
            });
        }

        return res.json({
            status: "success",
            dataStatus: "NOT AVAILABLE - VERIFIED COMPANY INTELLIGENCE HAS NOT BEEN ADDED",
            intelligence: {
                symbol,
                message: "Verified company intelligence is not available yet. Orders, contracts, projects and partnerships have not been independently populated."
            }
        });
    } catch (error) {
        console.error("Company Intelligence API Error:", error.message);
        return res.status(500).json({
            status: "error",
            message: "Unable to fetch company intelligence."
        });
    }
});
app.get("/api/technical-analysis/:symbol", async (req, res) => {
    try {
        const symbol = String(req.params.symbol || "").trim().toUpperCase();
        const exchange = String(req.query.exchange || "NSE").trim().toUpperCase();

        const resolved = await resolveExchangeProviderSymbol(symbol, exchange);

        if (!resolved.ok) {
            return res.status(resolved.statusCode).json({
                status: "error",
                exchange,
                message: resolved.message
            });
        }

        const providerSymbol = resolved.providerSymbol;
        console.log(`[RISK DEBUG] Exchange=${exchange}, Symbol=${symbol}, Provider=${providerSymbol}`);

        console.log(
            `[PREDICTION TEST] Exchange=${exchange}, Symbol=${symbol}, Provider=${providerSymbol}`
        );

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

        const recentReturns = returns;
        const returnMean = average(recentReturns);
        const returnVariance = average(
            recentReturns.map(value => (value - returnMean) ** 2)
        );
        const annualizedVolatility = Math.sqrt(returnVariance) *
            Math.sqrt(252) * 100;

        const recentRecords = records.slice(-60);

        const supportCandidates = recentRecords
            .map(row => row.low)
            .filter(value => Number.isFinite(value) && value < last)
            .sort((a, b) => b - a);

        const resistanceCandidates = recentRecords
            .map(row => row.high)
            .filter(value => Number.isFinite(value) && value > last)
            .sort((a, b) => a - b);

        const support = [...new Set(supportCandidates.map(round))].slice(0, 2);
        const resistance = [...new Set(resistanceCandidates.map(round))].slice(0, 2);

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
            dataStatus: "PROVIDER DATA - CALCULATED INDICATORS",
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
        console.error("Technical Analysis API Error:", error);
        return res.status(500).json({
            status: "error",
            message: "Unable to calculate technical analysis."
        });
    }
});

/* =========================
   AI / ML PREDICTION API
========================= */

app.get("/api/prediction/:symbol", async (req, res) => {
    try {
        const symbol = String(req.params.symbol || "").toUpperCase();

        const exchange = String(req.query.exchange || "NSE").trim().toUpperCase();

        const resolved = await resolveExchangeProviderSymbol(symbol, exchange);

        if (!resolved.ok) {
            return res.status(resolved.statusCode).json({
                status: "error",
                exchange,
                message: resolved.message
            });
        }

        const providerSymbol = resolved.providerSymbol;
        console.log(`[RISK DEBUG] Exchange=${exchange}, Symbol=${symbol}, Provider=${providerSymbol}`);

        console.log(
            `[PREDICTION TEST] Exchange=${exchange}, Symbol=${symbol}, Provider=${providerSymbol}`
        );
        const url =
            `https://query1.finance.yahoo.com/v8/finance/chart/${providerSymbol}` +
            "?range=1y&interval=1d";

        const response = await fetch(url, {
            headers: { "User-Agent": "Mozilla/5.0" }
        });

        if (!response.ok) {
            throw new Error(`Market-data provider returned HTTP ${response.status}`);
        }

        const providerResult = await response.json();
        const chart = providerResult.chart?.result?.[0];

        if (!chart?.timestamp || !chart?.indicators?.quote?.[0]) {
            return res.status(502).json({
                status: "error",
                message: "Historical prices are currently unavailable."
            });
        }

        const quote = chart.indicators.quote[0];

        const prices = chart.timestamp
            .map((timestamp, index) => ({
                timestamp,
                close: quote.close?.[index]
            }))
            .filter(item =>
                Number.isFinite(item.close) && item.close > 0
            )
            .sort((a, b) => a.timestamp - b.timestamp);

        if (prices.length < 60) {
            return res.status(422).json({
                status: "error",
                message: "At least 60 valid daily closing prices are needed."
            });
        }

        const closes = prices.map(item => item.close);
        const currentPrice = closes[closes.length - 1];

        const average = values =>
            values.reduce((sum, value) => sum + value, 0) / values.length;

        const sma20 = average(closes.slice(-20));
        const sma50 = average(closes.slice(-50));

        const recentCloses = closes.slice(-21);
        const dailyReturns = [];

        for (let i = 1; i < recentCloses.length; i++) {
            dailyReturns.push(
                recentCloses[i] / recentCloses[i - 1] - 1
            );
        }

        const rawDailyTrend = average(dailyReturns);
        const boundedDailyTrend = Math.max(
            -0.02,
            Math.min(0.02, rawDailyTrend)
        );

        const predictedPrice =
            currentPrice * Math.pow(1 + boundedDailyTrend, 5);

        const expectedChange =
            ((predictedPrice - currentPrice) / currentPrice) * 100;

        const direction =
            expectedChange > 0.1 ? "UP" :
            expectedChange < -0.1 ? "DOWN" : "SIDEWAYS";

        const errors = [];
        const percentageErrors = [];
        const evaluationStart = Math.max(50, closes.length - 20);

        for (let i = evaluationStart; i < closes.length; i++) {
            const trainingWindow = closes.slice(Math.max(0, i - 20), i);
            if (trainingWindow.length < 2) continue;

            const returns = [];

            for (let j = 1; j < trainingWindow.length; j++) {
                returns.push(
                    trainingWindow[j] / trainingWindow[j - 1] - 1
                );
            }

            const meanReturn = Math.max(
                -0.02,
                Math.min(0.02, average(returns))
            );

            const estimatedClose =
                trainingWindow[trainingWindow.length - 1] * (1 + meanReturn);

            const error = estimatedClose - closes[i];
            errors.push(error);
            percentageErrors.push(Math.abs(error / closes[i]) * 100);
        }

        const mae = errors.length
            ? average(errors.map(error => Math.abs(error)))
            : null;

        const rmse = errors.length
            ? Math.sqrt(average(errors.map(error => error * error)))
            : null;

        const mape = percentageErrors.length
            ? average(percentageErrors)
            : null;

        const prediction = {
            symbol,
            currentPrice: Number(currentPrice.toFixed(2)),
            predictedPrice: Number(predictedPrice.toFixed(2)),
            expectedChange: Number(expectedChange.toFixed(2)),
            direction,
            confidence: null,
            forecastPeriod: "Next 5 Trading Sessions",
            model: "Historical Statistical Baseline",
            modelMetrics: {
                mae: mae === null ? null : Number(mae.toFixed(2)),
                rmse: rmse === null ? null : Number(rmse.toFixed(2)),
                mape: mape === null ? null : Number(mape.toFixed(2)),
                evaluationMethod: "Rolling one-session historical estimate",
                evaluatedObservations: errors.length
            },
            indicators: {
                sma20: Number(sma20.toFixed(2)),
                sma50: Number(sma50.toFixed(2))
            },
            historicalObservations: closes.length,
            latestHistoricalTimestamp: prices[prices.length - 1].timestamp,
            currency: chart.meta?.currency || "INR",
            factors: [
                `20-session moving average: ${sma20.toFixed(2)}`,
                `50-session moving average: ${sma50.toFixed(2)}`,
                `Recent average daily return: ${(rawDailyTrend * 100).toFixed(3)}%`,
                `Historical observations used: ${closes.length}`
            ]
        };

        return res.json({
            status: "success",
            exchange,
            providerSymbol,
            dataStatus: "PROVIDER DATA - HISTORICAL STATISTICAL BASELINE",
            prediction,
            disclaimer: "This is a statistical estimate, not a trained machine-learning forecast or a guarantee of future prices."
        });
    } catch (error) {
        console.error("Prediction API Error:", error.message);

        return res.status(502).json({
            status: "error",
            message: "Unable to generate a historical baseline estimate right now."
        });
    }
});

/* =====================================
   RISK ANALYSIS API
===================================== */

app.get("/api/risk-analysis/:symbol", async (req, res) => {
    try {
        const symbol = String(req.params.symbol || "").trim().toUpperCase();
        const exchange = String(req.query.exchange || "NSE").trim().toUpperCase();

        const resolved = await resolveExchangeProviderSymbol(symbol, exchange);

        if (!resolved.ok) {
            return res.status(resolved.statusCode).json({
                status: "error",
                exchange,
                message: resolved.message
            });
        }

        const providerSymbol = resolved.providerSymbol;

        console.log(
            `[RISK DEBUG] Exchange=${exchange}, Symbol=${symbol}, Provider=${providerSymbol}`
        );

        const url =
            `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(providerSymbol)}?range=1y&interval=1d`;

        const response = await fetch(url, {
            headers: { "User-Agent": "Mozilla/5.0" }
        });

        if (!response.ok) {
            return res.status(502).json({
                status: "error",
                message: "Historical market data provider is unavailable."
            });
        }

        const payload = await response.json();

        if (payload?.chart?.error) {
            return res.status(502).json({
                status: "error",
                message: "The historical data provider returned an error."
            });
        }

        const chart = payload?.chart?.result?.[0];
        const quote = chart?.indicators?.quote?.[0];

        const timestamps = chart?.timestamp || [];
        const rawCloses = quote?.close || [];
        const adjustedCloses =
            chart?.indicators?.adjclose?.[0]?.adjclose || [];

        if (!chart || timestamps.length === 0) {
            return res.status(502).json({
                status: "error",
                message: "No one-year historical prices were returned."
            });
        }

        const prices = timestamps
            .map((timestamp, index) => ({
                timestamp,
                rawClose: rawCloses[index],
                adjustedClose: adjustedCloses[index]
            }))
            .filter(point =>
                Number.isFinite(point.timestamp) &&
                Number.isFinite(point.rawClose) &&
                point.rawClose > 0
            )
            .sort((a, b) => a.timestamp - b.timestamp);

        if (prices.length < 200) {
            return res.status(502).json({
                status: "error",
                message: "Not enough daily observations for a reliable one-year risk calculation.",
                observationsReceived: prices.length
            });
        }

        const firstDate = prices[0].timestamp;
        const lastDate = prices[prices.length - 1].timestamp;

        const periodDays = (lastDate - firstDate) / 86400;
        const latestAgeDays = (Date.now() / 1000 - lastDate) / 86400;

        let maximumGapDays = 0;

        for (let i = 1; i < prices.length; i++) {
            const gapDays =
                (prices[i].timestamp - prices[i - 1].timestamp) / 86400;

            maximumGapDays = Math.max(maximumGapDays, gapDays);
        }

        if (
            periodDays < 330 ||
            latestAgeDays > 7 ||
            maximumGapDays > 7
        ) {
            return res.status(502).json({
                status: "error",
                dataStatus: "DATA QUALITY WARNING",
                message: "Historical prices failed the one-year date-continuity checks. Risk score was not calculated.",
                observationsReceived: prices.length,
                periodDays: Number(periodDays.toFixed(1)),
                maximumGapDays: Number(maximumGapDays.toFixed(1)),
                latestPriceAgeDays: Number(latestAgeDays.toFixed(1))
            });
        }

        const adjustedPricesAvailable =
            adjustedCloses.length === timestamps.length &&
            prices.every(point =>
                Number.isFinite(point.adjustedClose) &&
                point.adjustedClose > 0
            );

        const calculationPrices = adjustedPricesAvailable
            ? prices.map(point => point.adjustedClose)
            : prices.map(point => point.rawClose);

        const returns = [];

        for (let i = 1; i < calculationPrices.length; i++) {
            returns.push(
                calculationPrices[i] / calculationPrices[i - 1] - 1
            );
        }

        if (returns.length < 199) {
            return res.status(502).json({
                status: "error",
                message: "Not enough valid daily returns to calculate risk."
            });
        }

        const mean =
            returns.reduce((sum, value) => sum + value, 0) /
            returns.length;

        const variance = returns.reduce(
            (sum, value) => sum + Math.pow(value - mean, 2),
            0
        ) / Math.max(1, returns.length - 1);

        const annualizedVolatility =
            Math.sqrt(variance * 252) * 100;

        const downsideReturns = returns.filter(value => value < 0);

        const downsideVariance = returns.reduce(
            (sum, value) =>
                sum + Math.pow(Math.min(value, 0), 2),
            0
        ) / returns.length;

        const annualizedDownsideRisk =
            Math.sqrt(downsideVariance * 252) * 100;

        let peak = calculationPrices[0];
        let maximumDrawdown = 0;

        for (const price of calculationPrices) {
            peak = Math.max(peak, price);

            const drawdown = (peak - price) / peak * 100;

            maximumDrawdown = Math.max(
                maximumDrawdown,
                drawdown
            );
        }

        const round = value => Number(value.toFixed(2));
        const clamp = value => Math.max(0, Math.min(100, value));

        const volatilityRisk = clamp(
            annualizedVolatility / 60 * 100
        );

        const drawdownRisk = clamp(
            maximumDrawdown / 50 * 100
        );

        const downsideRisk = clamp(
            annualizedDownsideRisk / 40 * 100
        );

        const overallRiskScore = round(
            volatilityRisk * 0.5 +
            drawdownRisk * 0.3 +
            downsideRisk * 0.2
        );

        const riskLevel = overallRiskScore < 33
            ? "LOW"
            : overallRiskScore < 66
                ? "MODERATE"
                : "HIGH";

        const rawValues = prices.map(point => point.rawClose);

        const currentPrice = rawValues[rawValues.length - 1];

        const last50Prices = rawValues.slice(-50);

        const average50 =
            last50Prices.reduce((sum, value) => sum + value, 0) /
            last50Prices.length;

        const riskFactors = [
            `One-year annualized historical volatility: ${round(annualizedVolatility)}%`,
            `One-year maximum drawdown: ${round(maximumDrawdown)}%`,
            `One-year annualized downside deviation: ${round(annualizedDownsideRisk)}%`
        ];

        if (currentPrice < average50) {
            riskFactors.push(
                "Latest price is below its 50-session average."
            );
        } else {
            riskFactors.push(
                "Latest price is at or above its 50-session average."
            );
        }

        const positiveFactors = [];

        if (currentPrice >= average50) {
            positiveFactors.push(
                "Latest price is at or above its 50-session average."
            );
        }

        if (maximumDrawdown < 15) {
            positiveFactors.push(
                "Observed maximum drawdown in this one-year period was below 15%."
            );
        }

        if (positiveFactors.length === 0) {
            positiveFactors.push(
                "No positive historical risk signal met the selected thresholds."
            );
        }

        const firstDateText = new Date(firstDate * 1000)
            .toISOString()
            .slice(0, 10);

        const lastDateText = new Date(lastDate * 1000)
            .toISOString()
            .slice(0, 10);

        const riskData = {
            symbol,
            overallRiskScore,
            riskLevel,
            volatilityRisk: round(volatilityRisk),
            financialRisk: null,
            marketRisk: null,
            businessRisk: null,
            liquidityRisk: null,
            annualizedHistoricalVolatility: round(annualizedVolatility),
            annualizedDownsideRisk: round(annualizedDownsideRisk),
            maximumDrawdown: round(maximumDrawdown),
            currentPrice: round(currentPrice),
            average50Session: round(average50),
            riskFactors,
            positiveFactors,
            riskOutlook: riskLevel,
            assessmentPeriod: `One year of daily prices (${firstDateText} to ${lastDateText})`,
            historicalObservations: prices.length,
            downsideObservationCount: downsideReturns.length,
            asOf: new Date(lastDate * 1000).toISOString(),
            dataQuality: {
                status: "PASSED",
                maximumGapDays: round(maximumGapDays),
                periodDays: round(periodDays),
                priceSeriesUsed: adjustedPricesAvailable
                    ? "Adjusted closing prices"
                    : "Raw closing prices (adjusted data unavailable)"
            }
        };

        return res.json({
            status: "success",
            exchange,
            providerSymbol,
            providerReturnedSymbol: chart?.meta?.symbol || null,
            dataStatus: adjustedPricesAvailable
                ? "PROVIDER DATA - ONE-YEAR ADJUSTED DAILY RISK CALCULATIONS"
                : "PROVIDER DATA - ONE-YEAR RAW DAILY RISK CALCULATIONS",
            source: "Yahoo Finance chart history (unofficial; data may be delayed)",
            methodology: "One-year daily historical returns, annualized volatility, downside deviation and maximum drawdown; heuristic 0-100 score.",
            limitations: [
                "This is historical market risk, not a forecast.",
                "Financial, business, market-wide and liquidity risks are not independently measured.",
                "The risk score is a heuristic and is not a probability of loss.",
                "Large genuine market movements are retained in the calculation.",
                "Adjusted closing prices are used when complete adjusted data is available."
            ],
            riskAnalysis: riskData
        });
    } catch (error) {
        console.error("Risk Analysis API Error:", error.message);

        return res.status(500).json({
            status: "error",
            message: "Unable to calculate risk analysis from one-year historical prices."
        });
    }
});
/* =========================
   FINANCIAL ANALYSIS API
========================= */

app.get("/api/financial-analysis/:symbol", async (req, res) => {
    try {
        const symbol = String(req.params.symbol || "").trim().toUpperCase();
        const exchange = String(req.query.exchange || "NSE").trim().toUpperCase();

        const resolved = await resolveExchangeProviderSymbol(symbol, exchange);

        if (!resolved.ok) {
            return res.status(resolved.statusCode).json({
                status: "error",
                exchange,
                message: resolved.message
            });
        }

        const providerSymbol = resolved.providerSymbol;

        // Read only verified annual financial statements.
        const [statementRows] = await pool.execute(
            `SELECT
                symbol,
                period_type AS periodType,
                period_end AS periodEnd,
                reporting_basis AS reportingBasis,
                currency,
                amount_unit AS amountUnit,
                revenue,
                net_profit AS netProfit,
                eps,
                total_assets AS totalAssets,
                total_debt AS totalDebt,
                shareholders_equity AS shareholdersEquity,
                operating_cash_flow AS operatingCashFlow,
                source_name AS sourceName,
                source_url AS sourceUrl
             FROM company_fundamentals
             WHERE symbol = ?
               AND period_type = 'ANNUAL'
               AND verification_status = 'VERIFIED'
             ORDER BY period_end DESC
             LIMIT 2`,
            [symbol]
        );

        const latestStatement = statementRows[0] || null;
        const previousStatement = statementRows[1] || null;

        const toNumber = value => {
            if (value === null || value === undefined || value === "") {
                return null;
            }

            const number = Number(value);
            return Number.isFinite(number) ? number : null;
        };

        const round = value =>
            Number.isFinite(value) ? Number(value.toFixed(2)) : null;

        let revenueGrowth = null;
        let profitGrowth = null;

        if (latestStatement && previousStatement) {
            const latestYear = new Date(latestStatement.periodEnd).getUTCFullYear();
            const previousYear = new Date(previousStatement.periodEnd).getUTCFullYear();

            const comparable =
                latestStatement.reportingBasis === previousStatement.reportingBasis &&
                latestStatement.currency === previousStatement.currency &&
                latestStatement.amountUnit === previousStatement.amountUnit &&
                latestYear - previousYear === 1;

            if (comparable) {
                const currentRevenue = toNumber(latestStatement.revenue);
                const previousRevenue = toNumber(previousStatement.revenue);

                const currentProfit = toNumber(latestStatement.netProfit);
                const previousProfit = toNumber(previousStatement.netProfit);

                if (currentRevenue !== null && previousRevenue > 0) {
                    revenueGrowth = round(
                        ((currentRevenue - previousRevenue) / previousRevenue) * 100
                    );
                }

                if (currentProfit !== null && previousProfit > 0) {
                    profitGrowth = round(
                        ((currentProfit - previousProfit) / previousProfit) * 100
                    );
                }
            }
        }

        const revenue = toNumber(latestStatement?.revenue);
        const netProfit = toNumber(latestStatement?.netProfit);
        const totalDebt = toNumber(latestStatement?.totalDebt);
        const shareholdersEquity = toNumber(latestStatement?.shareholdersEquity);

        const debtToEquity =
            totalDebt !== null && shareholdersEquity > 0
                ? round(totalDebt / shareholdersEquity)
                : null;

        const profitMargin =
            revenue > 0 && netProfit !== null
                ? round((netProfit / revenue) * 100)
                : null;

        const url =
            `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(providerSymbol)}?range=1y&interval=1d`;

        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 StockAI/1.0"
            }
        });

        if (!response.ok) {
            throw new Error(`Yahoo Finance returned HTTP ${response.status}`);
        }

        const payload = await response.json();
        const result = payload?.chart?.result?.[0];

        if (!result) {
            throw new Error("No historical market data was returned by the provider.");
        }

        const quote = result.indicators?.quote?.[0];
        const closes = (quote?.close || []).filter(
            value => Number.isFinite(value) && value > 0
        );

        if (closes.length < 2) {
            throw new Error("Insufficient historical prices to calculate market metrics.");
        }

        const currentPrice = closes[closes.length - 1];
        const previousClose = closes[closes.length - 2];

        const changes = closes.slice(1).map((price, index) =>
            (price / closes[index]) - 1
        );

        const average = values =>
            values.length
                ? values.reduce((sum, value) => sum + value, 0) / values.length
                : null;

        const meanReturn = average(changes);

        const variance = average(changes.map(value =>
            (value - meanReturn) ** 2
        ));

        const dailyVolatility = Math.sqrt(variance);
        const annualizedVolatility = dailyVolatility * Math.sqrt(252) * 100;

        const average20 = average(closes.slice(-20));
        const average50 = average(closes.slice(-50));

        let peak = closes[0];
        let maximumDrawdown = 0;

        for (const price of closes) {
            peak = Math.max(peak, price);

            maximumDrawdown = Math.max(
                maximumDrawdown,
                ((peak - price) / peak) * 100
            );
        }

        const verifiedDataAvailable = Boolean(latestStatement);

        return res.json({
            status: "success",
            exchange,
            providerSymbol,
            providerReturnedSymbol: result?.meta?.symbol || null,
            dataStatus: verifiedDataAvailable
                ? "VERIFIED FUNDAMENTALS + PROVIDER MARKET DATA"
                : "PROVIDER DATA - MARKET METRICS ONLY",
            source: "Yahoo Finance chart history (unofficial; data may be delayed)",
            verifiedFundamentals: latestStatement
                ? {
                    periodType: latestStatement.periodType,
                    periodEnd: latestStatement.periodEnd,
                    reportingBasis: latestStatement.reportingBasis,
                    currency: latestStatement.currency,
                    amountUnit: latestStatement.amountUnit,
                    sourceName: latestStatement.sourceName,
                    sourceUrl: latestStatement.sourceUrl,
                    verificationStatus: "VERIFIED"
                }
                : null,
            limitations: [
                "Only VERIFIED annual financial statements are used.",
                "Growth rates require comparable consecutive annual records.",
                "Market capitalization, P/E, ROE, ROCE, dividend yield and book value require additional verified data.",
                "Historical volatility and drawdown describe past price behavior, not future performance."
            ],
            financialAnalysis: {
                symbol,
                currentPrice: round(currentPrice),
                previousClose: round(previousClose),
                dailyChangePercent: round(((currentPrice / previousClose) - 1) * 100),
                average20Session: round(average20),
                average50Session: round(average50),
                annualizedHistoricalVolatility: round(annualizedVolatility),
                maximumDrawdown: round(maximumDrawdown),
                marketTrend: currentPrice > average50
                    ? "ABOVE 50-SESSION AVERAGE"
                    : "BELOW 50-SESSION AVERAGE",

                marketCap: null,
                revenue,
                revenueGrowth,
                netProfit,
                profitGrowth,
                eps: toNumber(latestStatement?.eps),
                peRatio: null,
                roe: null,
                roce: null,
                debtToEquity,
                profitMargin,
                dividendYield: null,
                bookValue: null,

                totalAssets: toNumber(latestStatement?.totalAssets),
                totalDebt,
                shareholdersEquity,
                operatingCashFlow: toNumber(latestStatement?.operatingCashFlow),

                financialHealth: verifiedDataAvailable
                    ? "VERIFIED FINANCIAL DATA AVAILABLE - FULL ASSESSMENT PENDING"
                    : "NOT ASSESSED",
                growthOutlook: verifiedDataAvailable
                    ? "INSUFFICIENT COMPARABLE DATA FOR GROWTH OUTLOOK"
                    : "NOT ASSESSED",

                riskLevel: "SEE HISTORICAL MARKET RISK",
                historicalObservations: closes.length,
                asOf: result.timestamp?.length
                    ? new Date(result.timestamp[result.timestamp.length - 1] * 1000).toISOString()
                    : null
            }
        });

    } catch (error) {
        console.error("Financial Analysis API Error:", error.message);

        return res.status(502).json({
            status: "error",
            message: "Unable to retrieve financial and market metrics.",
            detail: error.message
        });
    }
});
/* =====================================
   COMPANY SEARCH API
===================================== */

app.get("/api/companies", async (req, res) => {

    try {

        const search = req.query.search || "";

        const sql = `
            SELECT
                id,
                name,
                symbol,
                sector,
                price,
                change_amount AS \`change\`,
                change_percent AS changePercent
            FROM companies
            WHERE name LIKE ? OR symbol LIKE ?
            ORDER BY name ASC
        `;

        const searchValue = `%${search}%`;

        const [companies] = await pool.query(
            sql,
            [
                searchValue,
                searchValue
            ]
        );

        res.json({
            status: "success",
            dataStatus: "DATABASE",
            total: companies.length,
            companies: companies
        });

    } catch (error) {

        console.error(
            "Companies API Error:",
            error.message
        );

        res.status(500).json({
            status: "error",
            message: "Unable to fetch companies from MySQL database."
        });

    }

});


/* =====================================
   START SERVER
===================================== */


/* =====================================
   HISTORICAL STOCK PRICE API
===================================== */

/* =====================================
   STOCK PRICE ALERTS API
===================================== */

const allowedAlertSymbols = [
    "RELIANCE",
    "TATAMOTORS",
    "BEL",
    "ADANIPOWER",
    "TCS",
    "SBIN"
];

// GET: List saved price alerts
app.get("/api/alerts", async (req, res) => {
    try {
        const [alerts] = await pool.execute(
            `SELECT id, symbol, condition_type, target_price,
                    is_active, is_triggered, triggered_at, created_at
             FROM stock_alerts
             ORDER BY created_at DESC`
        );

        res.json({
            status: "success",
            total: alerts.length,
            alerts
        });
    } catch (error) {
        console.error("Get Alerts Error:", error.message);

        res.status(500).json({
            status: "error",
            message: "Unable to load price alerts."
        });
    }
});

// POST: Create a price alert
app.post("/api/alerts", async (req, res) => {
    try {
        const symbol = String(req.body.symbol || "")
            .trim()
            .toUpperCase();

        const conditionType = String(req.body.condition_type || "")
            .trim()
            .toUpperCase();

        const targetPrice = Number(req.body.target_price);

        if (!allowedAlertSymbols.includes(symbol)) {
            return res.status(400).json({
                status: "error",
                message: "Unsupported stock symbol."
            });
        }

        if (!["ABOVE", "BELOW"].includes(conditionType)) {
            return res.status(400).json({
                status: "error",
                message: "Condition must be ABOVE or BELOW."
            });
        }

        if (
            !Number.isFinite(targetPrice) ||
            targetPrice <= 0 ||
            targetPrice > 9999999999.99
        ) {
            return res.status(400).json({
                status: "error",
                message: "Enter a valid positive target price."
            });
        }

        const [result] = await pool.execute(
            `INSERT INTO stock_alerts
                (symbol, condition_type, target_price)
             VALUES (?, ?, ?)`,
            [symbol, conditionType, targetPrice]
        );

        res.status(201).json({
            status: "success",
            message: "Price alert created successfully.",
            id: result.insertId
        });
    } catch (error) {
        console.error("Create Alert Error:", error.message);

        res.status(500).json({
            status: "error",
            message: "Unable to create the price alert."
        });
    }
});

// DELETE: Remove a saved price alert
app.delete("/api/alerts/:id", async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isSafeInteger(id) || id <= 0) {
            return res.status(400).json({
                status: "error",
                message: "Invalid alert ID."
            });
        }

        const [result] = await pool.execute(
            "DELETE FROM stock_alerts WHERE id = ?",
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                status: "error",
                message: "Alert not found."
            });
        }

        res.json({
            status: "success",
            message: "Price alert deleted successfully."
        });
    } catch (error) {
        console.error("Delete Alert Error:", error.message);

        res.status(500).json({
            status: "error",
            message: "Unable to delete the price alert."
        });
    }
});

/* =====================================
   CHECK STOCK PRICE ALERTS API
===================================== */

app.get("/api/alerts/check", async (req, res) => {
    try {
        // Get current prices from the existing market dashboard API.
        const marketResponse = await fetch(
            `http://127.0.0.1:${PORT}/api/market`,
            { signal: AbortSignal.timeout(25000) }
        );

        if (!marketResponse.ok) {
            throw new Error("Market API could not provide prices.");
        }

        const marketData = await marketResponse.json();

        if (
            marketData.status !== "success" ||
            !Array.isArray(marketData.stockData)
        ) {
            throw new Error("Invalid market API response.");
        }

        const pricesBySymbol = new Map();

        for (const stock of marketData.stockData) {
            const price = Number(stock.price);

            // Ignore missing, unavailable, or invalid prices.
            if (
                stock.dataStatus === "PROVIDER DATA" &&
                Number.isFinite(price) &&
                price > 0
            ) {
                pricesBySymbol.set(stock.symbol, price);
            }
        }

        // Load active alerts that have not triggered yet.
        const [alerts] = await pool.execute(
            `SELECT id, symbol, condition_type, target_price
             FROM stock_alerts
             WHERE is_active = TRUE
               AND is_triggered = FALSE`
        );

        const results = [];

        for (const alert of alerts) {
            const currentPrice = pricesBySymbol.get(alert.symbol);
            const targetPrice = Number(alert.target_price);

            if (currentPrice === undefined) {
                results.push({
                    id: alert.id,
                    symbol: alert.symbol,
                    status: "PRICE_UNAVAILABLE",
                    message: "A valid provider price is unavailable."
                });
                continue;
            }

            const triggered =
                alert.condition_type === "ABOVE"
                    ? currentPrice >= targetPrice
                    : currentPrice <= targetPrice;

            if (!triggered) {
                results.push({
                    id: alert.id,
                    symbol: alert.symbol,
                    currentPrice,
                    targetPrice,
                    condition: alert.condition_type,
                    status: "PENDING"
                });
                continue;
            }

            // Mark the alert as triggered only once.
            const [updateResult] = await pool.execute(
                `UPDATE stock_alerts
                 SET is_triggered = TRUE,
                     triggered_at = CURRENT_TIMESTAMP
                 WHERE id = ?
                   AND is_active = TRUE
                   AND is_triggered = FALSE`,
                [alert.id]
            );

            results.push({
                id: alert.id,
                symbol: alert.symbol,
                currentPrice,
                targetPrice,
                condition: alert.condition_type,
                status: updateResult.affectedRows > 0
                    ? "TRIGGERED"
                    : "ALREADY_TRIGGERED"
            });
        }

        res.json({
            status: "success",
            provider: marketData.provider,
            checkedAt: new Date().toISOString(),
            checkedAlerts: results.length,
            results
        });
    } catch (error) {
        console.error("Check Alerts Error:", error.message);

        res.status(502).json({
            status: "error",
            message: "Unable to check alerts against market prices."
        });
    }
});

app.get("/api/history/:symbol", async (req, res) => {
    try {
        const allowedRanges = ["1mo", "3mo", "6mo", "1y"];
        const requestedRange = req.query.range || "3mo";
        const range = allowedRanges.includes(requestedRange)
            ? requestedRange
            : "3mo";

        const symbol = req.params.symbol.toUpperCase();

        // Convert common StockAI symbols to Yahoo Finance symbols.
        const yahooSymbols = {
            RELIANCE: "RELIANCE.NS",
            TATAMOTORS: "TATAMOTORS.NS",
            TMPV: "TMPV.NS",
            TMCV: "TMCV.NS",
            BEL: "BEL.NS",
            ADANIPOWER: "ADANIPOWER.NS",
            TCS: "TCS.NS",
            SBIN: "SBIN.NS",            INFY: "INFY.NS",
            HDFCBANK: "HDFCBANK.NS",
            ICICIBANK: "ICICIBANK.NS",
            ITC: "ITC.NS",
            LT: "LT.NS",
            AXISBANK: "AXISBANK.NS",
            KOTAKBANK: "KOTAKBANK.NS",
            HINDUNILVR: "HINDUNILVR.NS",
            BHARTIARTL: "BHARTIARTL.NS",
            MARUTI: "MARUTI.NS",
            SUNPHARMA: "SUNPHARMA.NS",
            WIPRO: "WIPRO.NS",
            NTPC: "NTPC.NS",
            POWERGRID: "POWERGRID.NS",
            TATASTEEL: "TATASTEEL.NS",
            ONGC: "ONGC.NS",
            TATAPOWER: "TATAPOWER.NS",
            JSWSTEEL: "JSWSTEEL.NS",
            ULTRACEMCO: "ULTRACEMCO.NS",
            ASIANPAINT: "ASIANPAINT.NS"
        };

        const yahooSymbol = yahooSymbols[symbol];

        if (!yahooSymbol) {
            return res.status(400).json({
                status: "error",
                message: "Historical data is not configured for this symbol."
            });
        }

        const url =
            `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}` +
            `?range=${range}&interval=1d`;

        const response = await fetch(url, {
            headers: { "User-Agent": "Mozilla/5.0" }
        });

        if (!response.ok) {
            throw new Error(`Market-data provider returned HTTP ${response.status}`);
        }

        const result = await response.json();
        const chartResult = result.chart?.result?.[0];

        if (!chartResult?.timestamp || !chartResult?.indicators?.quote?.[0]) {
            return res.status(502).json({
                status: "error",
                message: "Historical market data is currently unavailable."
            });
        }

        const timestamps = chartResult.timestamp;
        const quote = chartResult.indicators.quote[0];

        const prices = timestamps.map((timestamp, index) => ({
            date: new Date(timestamp * 1000).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "2-digit",
                timeZone: "Asia/Kolkata"
            }),
            timestamp,
            open: quote.open?.[index] ?? null,
            high: quote.high?.[index] ?? null,
            low: quote.low?.[index] ?? null,
            close: quote.close?.[index] ?? null,
            volume: quote.volume?.[index] ?? null
        })).filter(item => item.close !== null);

        res.json({
            status: "success",
            dataStatus: "PROVIDER DATA",
            symbol,
            providerSymbol: yahooSymbol,
            currency: chartResult.meta?.currency || "INR",
            range,
            prices
        });
    } catch (error) {
        console.error("Historical Prices API Error:", error.message);

        res.status(502).json({
            status: "error",
            message: "Unable to fetch historical prices right now."
        });
    }
});

/* =====================================
   EXCHANGE-AWARE COMPANY LISTINGS API
   GET /api/company-listings?exchange=NSE&search=BEL
===================================== */

app.get("/api/company-listings", async (req, res) => {
    try {
        const search = String(req.query.search || "").trim();
        const exchange = String(req.query.exchange || "").trim().toUpperCase();

        if (exchange && !["NSE", "BSE"].includes(exchange)) {
            return res.status(400).json({
                status: "error",
                message: "Invalid exchange. Use NSE or BSE."
            });
        }

        const conditions = ["d.listing_status = 'ACTIVE'"];
        const params = [];

        if (exchange) {
            conditions.push("d.exchange = ?");
            params.push(exchange);
        }

        if (search) {
            conditions.push(
                "(d.company_name LIKE ? OR d.symbol LIKE ? OR d.exchange_symbol LIKE ? OR d.security_code LIKE ? OR d.isin LIKE ?)"
            );
            const nameSearch = "%" + search + "%";
            const symbolSearch = search + "%";
            const identifierSearch = "%" + search + "%";

            params.push(
                nameSearch,
                symbolSearch,
                symbolSearch,
                identifierSearch,
                identifierSearch
            );
        }

        const sql = `
            SELECT
                d.id AS companyId,
                d.company_name AS name,
                d.symbol,
                d.sector,
                d.exchange,
                d.exchange_symbol AS exchangeSymbol,
                d.series,
                d.security_code AS securityCode,
                d.isin,
                d.instrument_type AS instrumentType,
                d.listing_status AS listingStatus
            FROM exchange_directory d
            WHERE ${conditions.join(" AND ")}
            ORDER BY d.company_name ASC, d.exchange ASC
            LIMIT 5000
        `;

        const [listings] = await pool.query(sql, params);

        if (search) {
            const term = search.toUpperCase();

            listings.sort((a, b) => {
                const rank = (item) => {
                    const symbol = String(item.symbol || "").toUpperCase();
                    const exchangeSymbol = String(item.exchangeSymbol || "").toUpperCase();

                    const companyName = String(item.name || "").toUpperCase();
                    if (symbol === term) return 0;
                    if (exchangeSymbol === term) return 1;
                    if (symbol.startsWith(term)) return 2;
                    if (exchangeSymbol.startsWith(term)) return 3;
                    if (companyName.startsWith(term)) return 4;
                    return 5;
                };

                return rank(a) - rank(b)
                    || String(a.name || "").localeCompare(String(b.name || ""));
            });
        }

        res.json({
            status: "success",
            dataStatus: "EXCHANGE LISTINGS DATABASE",
            note: "This endpoint returns imported listing identifiers, not live prices.",
            exchange: exchange || "ALL",
            total: listings.length,
            listings
        });
    } catch (error) {
        console.error("Company Listings API Error:", error.message);
        res.status(500).json({
            status: "error",
            message: "Unable to fetch exchange listings from MySQL."
        });
    }
});


// API_NOT_FOUND_HANDLER
app.use("/api", (req, res) => {
    res.status(404).json({
        status: "error",
        message: "API endpoint not found."
    });
});

// Global error handler
app.use((error, req, res, next) => {
    console.error("Unhandled server error:", error);

    if (res.headersSent) {
        return next(error);
    }

    const requestedStatus = Number(error.status || error.statusCode) || 500;
    const statusCode =
        requestedStatus >= 400 && requestedStatus < 500
            ? requestedStatus
            : 500;

    res.status(statusCode).json({
        status: "error",
        message: statusCode < 500
            ? "Invalid request."
            : "An unexpected server error occurred."
    });
});

app.listen(PORT, () => {

    console.log(
        `StockAI Backend running at http://localhost:${PORT}`
    );

});




























