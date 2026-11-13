const db = require("./db");

async function inspect() {
    try {
        for (const table of ["companies", "exchange_directory"]) {
            const [columns] = await db.query(`SHOW COLUMNS FROM ${table}`);

            console.log(`\n--- ${table.toUpperCase()} COLUMNS ---`);

            console.table(columns.map(c => ({
                Field: c.Field,
                Type: c.Type,
                Null: c.Null,
                Key: c.Key
            })));
        }
    } catch (error) {
        console.error("INSPECTION FAILED:", error.message);
    } finally {
        await db.end();
    }
}

inspect();
