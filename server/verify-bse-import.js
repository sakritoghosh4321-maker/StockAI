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
        const [counts] = await pool.query(`
            SELECT exchange, COUNT(*) AS total
            FROM exchange_directory
            GROUP BY exchange
            ORDER BY exchange
        `);

        console.log("\n--- VERIFIED DIRECTORY COUNTS ---");
        console.table(counts);

        const [checks] = await pool.query(`
            SELECT company_name, symbol, exchange, security_code,
                   isin, instrument_type, listing_status, source_name
            FROM exchange_directory
            WHERE exchange = 'BSE'
              AND (isin IN ('INE263A01024', 'INE467B01029')
                   OR security_code IN ('500049', '532540'))
            ORDER BY security_code
        `);

        console.log("\n--- BEL AND TCS PRESERVATION CHECK ---");
        console.table(checks);

        const [samples] = await pool.query(`
            SELECT company_name, symbol, security_code, isin, source_name
            FROM exchange_directory
            WHERE exchange = 'BSE'
              AND isin = 'INE466L01038'
        `);

        console.log("\n--- NEW RECORD CHECK: 360 ONE WAM ---");
        console.table(samples);

        const [companies] = await pool.query(
            "SELECT COUNT(*) AS total FROM companies"
        );
        console.log("\nCompanies table row count:", companies[0].total);
    } finally {
        await pool.end();
    }
}

main().catch(error => {
    console.error("Verification failed:", error.message);
    process.exitCode = 1;
});
