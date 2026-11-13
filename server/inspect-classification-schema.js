const db = require("./db");

async function inspect() {
    try {
        const tables = [
            "exchange_directory",
            "companies",
            "company_listings"
        ];

        for (const table of tables) {
            const [rows] = await db.query(
                `SHOW COLUMNS FROM \`${table}\``
            );

            console.log(`\n--- ${table} ---`);

            console.table(rows.map(column => ({
                Field: column.Field,
                Type: column.Type,
                Null: column.Null,
                Key: column.Key
            })));
        }
    } catch (error) {
        console.error("INSPECTION FAILED:", error.message);
    } finally {
        await db.end();
    }
}

inspect();
