const pool = require("./db");

async function main() {
    try {
        const [counts] = await pool.query(`
            SELECT exchange, listing_status, COUNT(*) AS total
            FROM exchange_directory
            GROUP BY exchange, listing_status
            ORDER BY exchange, listing_status
        `);

        console.table(counts);

        const [samples] = await pool.query(`
            SELECT company_name, symbol, exchange, listing_status
            FROM exchange_directory
            WHERE exchange = 'NSE'
              AND symbol IN ('RELIANCE', 'INFY')
        `);

        console.log("\nNSE sample records:");
        console.table(samples);
    } finally {
        await pool.end();
    }
}

main().catch(error => {
    console.error("Database check failed:", error.message);
    process.exitCode = 1;
});
