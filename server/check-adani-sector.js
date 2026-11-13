const db = require("./db");

async function check() {
    try {
        const [rows] = await db.query(`
            SELECT id, company_name, symbol, exchange, isin, sector
            FROM exchange_directory
            WHERE symbol = 'ADANIPOWER'
            ORDER BY exchange
        `);

        console.log("\n--- ADANI POWER SECTOR CHECK ---");
        console.table(rows);
        console.log("Records found:", rows.length);
    } catch (error) {
        console.error("CHECK FAILED:", error.message);
    } finally {
        await db.end();
    }
}

check();
