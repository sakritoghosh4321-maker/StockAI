const pool = require("./db");

async function main() {
    const [rows] = await pool.execute(
        `SELECT
            id, symbol, period_type, period_end,
            reporting_basis, currency, amount_unit,
            revenue, net_profit, eps,
            total_assets, total_debt,
            shareholders_equity, operating_cash_flow,
            verification_status
         FROM company_fundamentals
         WHERE symbol IN ('BEL', 'TMPV')
           AND period_type = 'ANNUAL'
           AND verification_status = 'VERIFIED'
         ORDER BY symbol, period_end DESC`
    );

    console.table(rows);
    await pool.end();
}

main().catch(async error => {
    console.error(error.message);
    await pool.end();
});
