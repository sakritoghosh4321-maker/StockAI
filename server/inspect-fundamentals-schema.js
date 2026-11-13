const pool = require("./db");

async function main() {
    const [rows] = await pool.query(
        "DESCRIBE company_fundamentals"
    );

    console.table(rows.map(r => ({
        Field: r.Field,
        Type: r.Type,
        Null: r.Null,
        Key: r.Key,
        Default: r.Default
    })));
}

main()
    .catch(console.error)
    .finally(() => pool.end());
