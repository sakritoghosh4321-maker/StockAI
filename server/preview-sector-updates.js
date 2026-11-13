const db = require("./db");

async function preview() {
    try {
        const [rows] = await db.query(`
            SELECT
                d.id,
                d.company_name,
                d.symbol,
                d.exchange,
                d.isin,
                d.sector AS current_sector,
                c.sector AS proposed_sector
            FROM exchange_directory d
            INNER JOIN companies c
                ON UPPER(TRIM(d.symbol)) = UPPER(TRIM(c.symbol))
            WHERE
                (d.sector IS NULL OR TRIM(d.sector) = '')
                AND c.sector IS NOT NULL
                AND TRIM(c.sector) <> ''
                AND (
                    (d.symbol = 'ADANIPOWER' AND d.isin = 'INE814H01029')
                    OR (d.symbol = 'RELIANCE' AND d.isin = 'INE002A01018')
                    OR (d.symbol = 'SBIN' AND d.isin = 'INE062A01020')
                )
            ORDER BY d.symbol, d.exchange
        `);

        console.log("\n--- VERIFIED PROPOSED SECTOR UPDATES ---");
        console.table(rows);
        console.log("Total proposed updates:", rows.length);

    } catch (error) {
        console.error("PREVIEW FAILED:", error.message);
    } finally {
        await db.end();
    }
}

preview();
