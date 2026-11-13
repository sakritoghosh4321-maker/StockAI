const pool = require("./db");

pool.query(`
    SELECT exchange, symbol, exchange_symbol, company_name,
           isin, instrument_type, listing_status, source_name, series
    FROM exchange_directory
    ORDER BY exchange
    LIMIT 2
`)
.then(([rows]) => console.table(rows))
.catch(console.error)
.finally(() => pool.end());
