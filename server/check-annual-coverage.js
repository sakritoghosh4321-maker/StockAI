const pool = require("../server/db");

async function main() {
    try {
        const [rows] = await pool.execute(`
            SELECT
                COUNT(DISTINCT symbol) AS companies,
                COUNT(*) AS annual_records,
                COUNT(DISTINCT CONCAT(symbol, ':', YEAR(period_end))) AS company_years
            FROM company_fundamentals
            WHERE period_type = 'ANNUAL'
              AND verification_status = 'VERIFIED'
        `);

        console.table(rows);
    } catch (error) {
        console.error("Database check failed:", error.message);
    } finally {
        await pool.end();
    }
}

main();
