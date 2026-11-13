const db = require("./db");

async function check() {
    try {
        console.log("\n--- ALL EXISTING COMPANIES ---");

        const [companies] = await db.query(`
            SELECT id, name, symbol, sector
            FROM companies
            ORDER BY name
        `);

        console.table(companies);

        console.log("\n--- MATCHES IN EXCHANGE DIRECTORY ---");

        const [matches] = await db.query(`
            SELECT
                d.id,
                d.company_name,
                d.symbol,
                d.exchange,
                d.isin,
                d.sector AS directory_sector,
                c.sector AS company_sector
            FROM exchange_directory d
            INNER JOIN companies c
                ON UPPER(TRIM(d.symbol)) = UPPER(TRIM(c.symbol))
            ORDER BY d.company_name, d.exchange
        `);

        console.table(matches);

        console.log("\nTotal matching listings:", matches.length);

    } catch (error) {
        console.error("CHECK FAILED:", error.message);
    } finally {
        await db.end();
    }
}

check();
