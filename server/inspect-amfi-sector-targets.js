const fs = require("fs");
const db = require("./db");

async function inspect() {
    const rows = JSON.parse(
        fs.readFileSync("./exchange-data/amfi-sector-import-preview.json", "utf8")
    );

    const isins = [...new Set(rows.map(r => r.ISIN))];
    const connection = await db.getConnection();

    try {
        const [dbRows] = await connection.query(
            `SELECT exchange, isin, sector
             FROM exchange_directory
             WHERE listing_status = 'ACTIVE'
             AND isin IN (?)`,
            [isins]
        );

        const dbMap = new Map(
            dbRows.map(r => [
                `${r.exchange}|${String(r.isin).trim().toUpperCase()}`,
                r
            ])
        );

        let matched = 0;
        let blank = 0;
        let existing = 0;
        let missing = 0;

        for (const row of rows) {
            const key = `${row.Exchange}|${row.ISIN}`;
            const found = dbMap.get(key);

            if (!found) {
                missing++;
            } else {
                matched++;

                if (!found.sector || !found.sector.trim()) {
                    blank++;
                } else {
                    existing++;
                }
            }
        }

        console.log("\n--- LIVE DATABASE PREFLIGHT ---");
        console.log("Preview rows:", rows.length);
        console.log("Matching active database rows:", matched);
        console.log("Rows with blank database sector:", blank);
        console.log("Rows with existing database sector:", existing);
        console.log("Rows missing from database:", missing);

        console.log("\n--- EXISTING SECTORS IN PREVIEW TARGETS ---");
        console.table(
            rows
                .filter(r => {
                    const found = dbMap.get(`${r.Exchange}|${r.ISIN}`);
                    return found && found.sector && found.sector.trim();
                })
                .map(r => ({
                    Company: r.CompanyName,
                    Exchange: r.Exchange,
                    ISIN: r.ISIN,
                    ExistingSector: dbMap.get(`${r.Exchange}|${r.ISIN}`).sector,
                    ProposedSector: r.ProposedSector
                }))
        );

        console.log("\nREAD-ONLY CHECK COMPLETE. NO DATABASE CHANGES MADE.");
    } finally {
        connection.release();
    }
}

inspect().catch(error => {
    console.error("PREFLIGHT FAILED:", error.message);
    process.exitCode = 1;
});
