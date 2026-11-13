const db = require("./db");

async function updateSectors() {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const [result] = await connection.query(`
            UPDATE exchange_directory d
            INNER JOIN companies c
                ON UPPER(TRIM(d.symbol)) = UPPER(TRIM(c.symbol))
            SET d.sector = c.sector
            WHERE
                (d.sector IS NULL OR TRIM(d.sector) = '')
                AND (
                    (d.symbol = 'ADANIPOWER' AND d.isin = 'INE814H01029')
                    OR (d.symbol = 'RELIANCE' AND d.isin = 'INE002A01018')
                    OR (d.symbol = 'SBIN' AND d.isin = 'INE062A01020')
                )
        `);

        if (result.affectedRows !== 6) {
            throw new Error(
                `Expected 6 updates but found ${result.affectedRows}. Rolling back.`
            );
        }

        await connection.commit();

        console.log("\nSUCCESS: Six sector records updated.");

        const [rows] = await connection.query(`
            SELECT company_name, symbol, exchange, isin, sector
            FROM exchange_directory
            WHERE symbol IN ('ADANIPOWER', 'RELIANCE', 'SBIN', 'BEL', 'TCS')
            ORDER BY symbol, exchange
        `);

        console.log("\n--- VERIFIED SECTOR RECORDS ---");
        console.table(rows);

    } catch (error) {
        await connection.rollback();
        console.error("UPDATE FAILED:", error.message);
    } finally {
        connection.release();
        await db.end();
    }
}

updateSectors();
