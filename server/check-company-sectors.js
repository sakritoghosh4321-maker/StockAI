const db = require("./db");

async function check() {
    try {
        const [summary] = await db.query(`
            SELECT
                COUNT(*) AS total,
                COUNT(NULLIF(TRIM(sector), '')) AS withSector
            FROM companies
        `);

        console.log("\n--- COMPANY SECTOR COVERAGE ---");
        console.table(summary);

        const [sectors] = await db.query(`
            SELECT sector, COUNT(*) AS total
            FROM companies
            WHERE sector IS NOT NULL AND TRIM(sector) <> ''
            GROUP BY sector
            ORDER BY total DESC
        `);

        console.log("\n--- EXISTING SECTORS ---");
        console.table(sectors);

    } catch (error) {
        console.error("CHECK FAILED:", error.message);
    } finally {
        await db.end();
    }
}

check();
