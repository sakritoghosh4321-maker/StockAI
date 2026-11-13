const pool = require("./db");

const record = {
    symbol: "TCS",
    periodType: "ANNUAL",
    reportingBasis: "CONSOLIDATED",
    periodEnd: "2026-03-31",
    currency: "INR",
    amountUnit: "INR_CRORE",
    revenue: 267021,
    netProfit: 49454,
    eps: 136.01,
    totalAssets: 182372,
    totalDebt: null,
    shareholdersEquity: 107240,
    operatingCashFlow: 52094,
    sourceName: "TCS audited consolidated FY 2025-26 annual report",
    sourceUrl: "https://www.tcs.com/content/dam/tcs/investor-relations/financial-statements/2025-26/ar/annual-report-2025-2026.pdf",
    verificationStatus: "VERIFIED"
};

async function main() {
    const connection = await pool.getConnection();
    let transactionStarted = false;

    try {
        const [listings] = await connection.execute(
            `SELECT exchange, symbol, isin
             FROM exchange_directory
             WHERE symbol = ?
               AND isin = ?
               AND listing_status = 'ACTIVE'`,
            ["TCS", "INE467B01029"]
        );

        const exchanges = listings.map(row => row.exchange);

        if (!exchanges.includes("NSE") || !exchanges.includes("BSE")) {
            throw new Error("TCS NSE/BSE listing and ISIN verification failed.");
        }

        const [existing] = await connection.execute(
            `SELECT id
             FROM company_fundamentals
             WHERE symbol = ?
               AND period_type = ?
               AND period_end = ?
               AND reporting_basis = ?`,
            [
                record.symbol,
                record.periodType,
                record.periodEnd,
                record.reportingBasis
            ]
        );

        if (existing.length > 0) {
            console.log("STOPPED: Matching TCS fundamentals record already exists.");
            return;
        }

        console.log("\n--- TCS FY 2025-26 IMPORT PREVIEW ---");
        console.table([record]);

        if (!process.argv.includes("--confirm")) {
            console.log("\nDRY RUN ONLY. No database changes made.");
            console.log("Review the figures before using --confirm.");
            return;
        }

        await connection.beginTransaction();
        transactionStarted = true;

        await connection.execute(
            `INSERT INTO company_fundamentals (
                symbol, period_type, reporting_basis, period_end,
                currency, amount_unit, revenue, net_profit, eps,
                total_assets, total_debt, shareholders_equity,
                operating_cash_flow, source_name, source_url,
                verification_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                record.symbol,
                record.periodType,
                record.reportingBasis,
                record.periodEnd,
                record.currency,
                record.amountUnit,
                record.revenue,
                record.netProfit,
                record.eps,
                record.totalAssets,
                record.totalDebt,
                record.shareholdersEquity,
                record.operatingCashFlow,
                record.sourceName,
                record.sourceUrl,
                record.verificationStatus
            ]
        );

        await connection.commit();
        transactionStarted = false;

        console.log("\nSUCCESS: TCS FY 2025-26 record inserted.");

    } catch (error) {
        if (transactionStarted) {
            await connection.rollback();
        }

        console.error("IMPORT FAILED:", error.message);
        process.exitCode = 1;
    } finally {
        connection.release();
        await pool.end();
    }
}

main();
