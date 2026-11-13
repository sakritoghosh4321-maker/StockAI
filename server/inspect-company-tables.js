const db = require("./db");

async function inspect() {
    const connection = await db.getConnection();

    try {
        for (const table of [
            "companies",
            "company_intelligence",
            "exchange_directory"
        ]) {
            console.log(`\n--- ${table.toUpperCase()} ---`);

            const [rows] = await connection.query(
                `SHOW COLUMNS FROM \`${table}\``
            );

            console.table(rows.map(row => ({
                Field: row.Field,
                Type: row.Type,
                Null: row.Null,
                Key: row.Key
            })));
        }
    } catch (error) {
        console.error("INSPECTION ERROR:", error.message);
    } finally {
        connection.release();
        await db.end();
    }
}

inspect();
