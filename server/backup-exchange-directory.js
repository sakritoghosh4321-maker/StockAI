const db = require("./db");

async function backup() {
    const connection = await db.getConnection();
    const backupTable = "exchange_directory_backup_20261101";

    try {
        const [existing] = await connection.query(
            "SHOW TABLES LIKE ?",
            [backupTable]
        );

        if (existing.length > 0) {
            throw new Error("Backup table already exists. Stopping to avoid overwriting it.");
        }

        await connection.query(
            `CREATE TABLE ${backupTable} LIKE exchange_directory`
        );

        await connection.query(
            `INSERT INTO ${backupTable} SELECT * FROM exchange_directory`
        );

        const [[original]] = await connection.query(
            "SELECT COUNT(*) AS total FROM exchange_directory"
        );

        const [[backup]] = await connection.query(
            `SELECT COUNT(*) AS total FROM ${backupTable}`
        );

        console.log("\n--- BACKUP VERIFICATION ---");
        console.log("Original rows:", original.total);
        console.log("Backup rows:", backup.total);
        console.log("Backup table:", backupTable);

        if (Number(original.total) !== Number(backup.total)) {
            throw new Error("Row counts differ. Do not proceed with the import.");
        }

        console.log("BACKUP VERIFIED.");
    } finally {
        connection.release();
    }
}

backup().catch(error => {
    console.error("BACKUP FAILED:", error.message);
    process.exitCode = 1;
});
