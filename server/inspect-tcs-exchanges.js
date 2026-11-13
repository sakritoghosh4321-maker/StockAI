const pool = require("./db");

async function main() {
    const [rows] = await pool.query(
        `SELECT
            id,
            company_name,
            symbol,
            exchange,
            exchange_symbol,
            security_code,
            isin,
            listing_status
         FROM exchange_directory
         WHERE isin = ? OR symbol = ?
         ORDER BY exchange`,
        ["INE467B01029", "TCS"]
    );

    console.table(rows);
}

main()
    .catch(console.error)
    .finally(() => pool.end());
