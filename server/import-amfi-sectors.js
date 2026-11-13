const fs = require("fs");
const db = require("./db");

async function importSectors() {
    const rows = JSON.parse(
        fs.readFileSync("./exchange-data/amfi-sector-import-preview.json", "utf8")
    );

    const backupTable = "exchange_directory_backup_20261101";
    const connection = await db.getConnection();

    let transactionStarted = false;

    try {
        // Validate the import file
        if (rows.length !== 449) {
            throw new Error(`Expected 449 rows, found ${rows.length}`);
        }

        const keys = new Set();

        for (const row of rows) {
            const key = `${row.Exchange}|${row.ISIN}`;

            if (
                !["NSE", "BSE"].includes(row.Exchange) ||
                !/^INE[A-Z0-9]{9}$/.test(row.ISIN) ||
                !row.ProposedSector ||
                keys.has(key)
            ) {
                throw new Error(`Invalid or duplicate import record: ${key}`);
            }

            keys.add(key);
        }

        // Confirm backup exists
        const [backupCheck] = await connection.query(
            "SHOW TABLES LIKE ?",
            [backupTable]
        );

        if (backupCheck.length === 0) {
            throw new Error("Verified backup table not found. Import stopped.");
        }

        // Begin protected transaction
        await connection.beginTransaction();
        transactionStarted = true;

        let updated = 0;

        for (const row of rows) {
            const [result] = await connection.query(
                `UPDATE exchange_directory
                 SET sector = ?
                 WHERE exchange = ?
                   AND isin = ?
                   AND listing_status = 'ACTIVE'
                   AND (sector IS NULL OR TRIM(sector) = '')`,
                [
                    row.ProposedSector,
                    row.Exchange,
                    row.ISIN
                ]
            );

            if (result.affectedRows !== 1) {
                throw new Error(
                    `Expected 1 update for ${row.Exchange} ${row.ISIN}, got ${result.affectedRows}`
                );
            }

            updated++;
        }

        if (updated !== 449) {
            throw new Error(`Expected 449 updates, got ${updated}`);
        }

        // Verify every imported sector before committing
        for (const row of rows) {
            const [check] = await connection.query(
                `SELECT sector
                 FROM exchange_directory
                 WHERE exchange = ?
                   AND isin = ?
                   AND listing_status = 'ACTIVE'`,
                [row.Exchange, row.ISIN]
            );

            if (
                check.length !== 1 ||
                check[0].sector !== row.ProposedSector
            ) {
                throw new Error(
                    `Post-update verification failed: ${row.Exchange} ${row.ISIN}`
                );
            }
        }

        await connection.commit();
        transactionStarted = false;

        console.log("\n--- SECTOR IMPORT SUCCESS ---");
        console.log("Rows updated:", updated);
        console.log("Rows verified:", rows.length);
        console.log("Backup table:", backupTable);
        console.log("TRANSACTION COMMITTED.");
    } catch (error) {
        if (transactionStarted) {
            await connection.rollback();
            console.log("\nTRANSACTION ROLLED BACK.");
        }

        throw error;
    } finally {
        connection.release();
    }
}

importSectors().catch(error => {
    console.error("\nSECTOR IMPORT FAILED:", error.message);
    process.exitCode = 1;
});
