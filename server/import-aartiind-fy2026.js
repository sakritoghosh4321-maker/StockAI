const pool = require("./db");

const record = {
    symbol: "AARTIIND",
    periodType: "ANNUAL",
    reportingBasis: "CONSOLIDATED",
    periodEnd: "2026-03-31",
    currency: "INR",
    amountUnit: "INR_CRORE",
    revenue: 8286.10,
    netProfit: 419.00,
    eps: 11.56,
    totalAssets: 13299,
    totalDebt: null,
    shareholdersEquity: 5955,
    operatingCashFlow: 781,
    sourceName: "NSE audited consolidated FY 2025-26 results and statements",
    sourceUrl: "https://nsearchives.nseindia.com/corporate/AARTIIND_04052026181240_Outcomemarch.pdf",
    verificationStatus: "VERIFIED"
};

async function main() {
    const connection = await pool.getConnection();

    try {
        const [listings] = await connection.execute(
            `SELECT exchange, symbol, isin
             FROM exchange_directory
             WHERE symbol = ?
               AND isin = ?
               AND listing_status = 'ACTIVE'`,
            ["AARTIIND", "INE769A01020"]
        );

        const exchanges = listings.map(row => row.exchange);

        if (!exchanges.includes("NSE") || !exchanges.includes("BSE")) {
            throw new Error("NSE/BSE listing and ISIN verification failed.");
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
            console.log("STOPPED: Matching fundamentals record already exists.");
            return;
        }

        console.log("\n--- AARTIIND IMPORT PREVIEW ---");
        console.table([record]);

        if (!process.argv.includes("--confirm")) {
            console.log("\nDRY RUN ONLY. No database changes made.");
            console.log("Review the figures before using --confirm.");
            return;
        }

        await connection.beginTransaction();

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
        console.log("\nSUCCESS: AARTIIND FY 2025-26 record inserted.");

    } catch (error) {
        await connection.rollback();
        console.error("IMPORT FAILED:", error.message);
        process.exitCode = 1;
    } finally {
        connection.release();
        await pool.end();
    }
}

main();


