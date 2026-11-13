const db = require("./db");

async function diagnose() {
    const connection = await db.getConnection();

    try {
        const [rows] = await connection.query(`
            SELECT
                d.id,
                d.company_name,
                d.symbol,
                d.exchange,
                d.isin,
                d.sector AS current_sector,
                c.sector AS company_sector
            FROM exchange_directory d
            INNER JOIN companies c
                ON UPPER(TRIM(d.symbol)) = UPPER(TRIM(c.symbol))
            WHERE
                d.symbol IN ('ADANIPOWER', 'RELIANCE', 'SBIN')
            ORDER BY d.symbol, d.exchange
        `);

        console.log("\n--- CURRENT DATABASE MATCHES ---");
        console.table(rows);
        console.log("Matching rows:", rows.length);

    } catch (error) {
        console.error("DIAGNOSTIC FAILED:", error.message);
    } finally {
        connection.release();
        await db.end();
    }
}

diagnose();
