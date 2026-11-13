require("dotenv").config();
const pool = require("./db");

async function main() {
    const [rows] = await pool.query(`
        SELECT
            exchange,
            listing_status,
            COUNT(*) AS total
        FROM exchange_directory
        GROUP BY exchange, listing_status
        ORDER BY exchange, listing_status
    `);

    console.table(rows);
}

main()
    .catch(console.error)
    .finally(() => pool.end());
