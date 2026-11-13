const pool = require("./db");

pool.query(`
    SELECT exchange, series, instrument_type, COUNT(*) AS total
    FROM exchange_directory
    GROUP BY exchange, series, instrument_type
    ORDER BY exchange, series, instrument_type
`)
.then(([rows]) => {
    console.table(rows);
    console.log("TOTAL DATABASE LISTINGS:", rows.reduce((sum, r) => sum + Number(r.total), 0));
})
.catch(console.error)
.finally(() => pool.end());
