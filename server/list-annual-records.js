const pool = require("../server/db");

async function main() {
    try {
        const [rows] = await pool.execute(`
            SELECT
                symbol,
                YEAR(period_end) AS financial_year,
                reporting_basis,
                verification_status
            FROM company_fundamentals
            WHERE period_type = 'ANNUAL'
              AND verification_status = 'VERIFIED'
            ORDER BY symbol, period_end DESC
        `);

        console.table(rows);
    } catch (error) {
        console.error(error.message);
    } finally {
        await pool.end();
    }
}

main();
