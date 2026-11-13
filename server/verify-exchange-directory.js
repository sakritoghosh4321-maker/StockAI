const pool = require("./db");

async function main() {
    try {
        const [counts] = await pool.query(`
            SELECT exchange, COUNT(*) AS total
            FROM exchange_directory
            GROUP BY exchange
            ORDER BY exchange
        `);

        console.log("\n--- Listing totals ---");
        console.table(counts);

        const [samples] = await pool.query(`
            SELECT company_name, symbol, exchange,
                   exchange_symbol, security_code, isin
            FROM exchange_directory
            WHERE symbol IN ('BEL', 'TCS', 'RELIANCE', 'INFY')
            ORDER BY symbol, exchange
        `);

        console.log("\n--- Sample companies ---");
        console.table(samples);

        const [mainCount] = await pool.query(`
            SELECT COUNT(*) AS total FROM companies
        `);

        console.log(
            "\nMain companies table row count:",
            mainCount[0].total
        );
    } finally {
        await pool.end();
    }
}

main().catch(error => {
    console.error("Verification failed:", error.message);
    process.exitCode = 1;
});
