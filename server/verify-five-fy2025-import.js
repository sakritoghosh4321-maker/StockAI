const pool = require("./db");

async function main() {
    const symbols = ["SBIN", "HDFCBANK", "AARTIIND", "RELIANCE", "TCS"];

    const [rows] = await pool.query(
        `SELECT
            symbol,
            period_type,
            reporting_basis,
            period_end,
            revenue,
            net_profit,
            eps,
            total_assets,
            verification_status,
            source_name,
            source_url
         FROM company_fundamentals
         WHERE symbol IN (?)
           AND period_type = 'ANNUAL'
           AND period_end = '2025-03-31'
         ORDER BY symbol`,
        [symbols]
    );

    console.table(rows.map(r => ({
        symbol: r.symbol,
        period: r.period_end,
        basis: r.reporting_basis,
        revenue: r.revenue,
        netProfit: r.net_profit,
        eps: r.eps,
        status: r.verification_status,
        source: r.source_name
    })));

    console.log("Verified record count:", rows.length);
    console.log(
        "All PENDING:",
        rows.length === 5 &&
        rows.every(r => r.verification_status === "PENDING")
    );
}

main()
    .catch(console.error)
    .finally(() => pool.end());
