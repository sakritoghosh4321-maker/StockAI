const pool = require("./db");

async function main() {
    const symbols = ["SBIN", "HDFCBANK", "AARTIIND", "RELIANCE", "TCS"];

    const [rows] = await pool.query(
        `SELECT symbol, period_end, period_type, reporting_basis,
                verification_status
         FROM company_fundamentals
         WHERE symbol IN (?)
           AND period_type = 'ANNUAL'
           AND period_end = '2025-03-31'
         ORDER BY symbol`,
        [symbols]
    );

    console.table(rows);
    console.log("Existing FY2025 records:", rows.length);
}

main()
    .catch(error => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
