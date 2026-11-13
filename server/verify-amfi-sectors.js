const db = require("./db");

async function verify() {
    const connection = await db.getConnection();

    try {
        const [summary] = await connection.query(`
            SELECT
                exchange,
                COUNT(*) AS total,
                SUM(CASE WHEN sector IS NOT NULL AND TRIM(sector) <> '' THEN 1 ELSE 0 END) AS populated,
                SUM(CASE WHEN sector IS NULL OR TRIM(sector) = '' THEN 1 ELSE 0 END) AS blank
            FROM exchange_directory
            WHERE listing_status = 'ACTIVE'
            GROUP BY exchange
            ORDER BY exchange
        `);

        const [sectors] = await connection.query(`
            SELECT sector, COUNT(*) AS listings
            FROM exchange_directory
            WHERE listing_status = 'ACTIVE'
              AND sector IS NOT NULL
              AND TRIM(sector) <> ''
            GROUP BY sector
            ORDER BY listings DESC
        `);

        const [originals] = await connection.query(`
            SELECT exchange, symbol, sector
            FROM exchange_directory
            WHERE listing_status = 'ACTIVE'
              AND (
                (symbol = 'ADANIPOWER' AND exchange IN ('NSE', 'BSE'))
                OR (symbol = 'RELIANCE' AND exchange IN ('NSE', 'BSE'))
                OR (symbol = 'SBIN' AND exchange IN ('NSE', 'BSE'))
              )
            ORDER BY symbol, exchange
        `);

        console.log("\n--- FINAL SECTOR COVERAGE ---");
        console.table(summary);

        console.log("\n--- SECTOR DISTRIBUTION ---");
        console.table(sectors);

        console.log("\n--- ORIGINAL SIX SECTOR VALUES ---");
        console.table(originals);

        console.log("\nVERIFICATION COMPLETE. NO DATABASE CHANGES MADE.");
    } finally {
        connection.release();
    }
}

verify().catch(error => {
    console.error("VERIFICATION FAILED:", error.message);
    process.exitCode = 1;
});
