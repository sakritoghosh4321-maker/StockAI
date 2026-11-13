const mysql = require("mysql2/promise");
require("dotenv").config();

async function main() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        connectionLimit: 2
    });

    try {
        const [columns] = await pool.query(
            "SHOW COLUMNS FROM exchange_directory"
        );

        console.log("\n--- exchange_directory COLUMNS ---");
        console.table(columns.map(c => ({
            Field: c.Field,
            Type: c.Type,
            Null: c.Null,
            Key: c.Key,
            Default: c.Default
        })));

        const [indexes] = await pool.query(
            "SHOW INDEX FROM exchange_directory"
        );

        console.log("\n--- EXISTING INDEXES ---");
        console.table(indexes.map(i => ({
            Key_name: i.Key_name,
            Column_name: i.Column_name,
            Non_unique: i.Non_unique
        })));

        const [counts] = await pool.query(`
            SELECT exchange, COUNT(*) AS total
            FROM exchange_directory
            GROUP BY exchange
        `);

        console.log("\n--- CURRENT ROW COUNTS ---");
        console.table(counts);

        console.log("\nSchema inspection complete. No records changed.");
    } finally {
        await pool.end();
    }
}

main().catch(err => {
    console.error("Schema inspection failed:", err.message);
    process.exitCode = 1;
});
