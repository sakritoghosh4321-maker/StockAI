const pool = require("./db");

const listings = [
  {
    symbol: "BEL",
    exchange: "NSE",
    exchangeSymbol: "BEL",
    securityCode: null,
    isin: "INE263A01024"
  },
  {
    symbol: "BEL",
    exchange: "BSE",
    exchangeSymbol: "BEL",
    securityCode: "500049",
    isin: "INE263A01024"
  },
  {
    symbol: "TCS",
    exchange: "NSE",
    exchangeSymbol: "TCS",
    securityCode: null,
    isin: "INE467B01029"
  },
  {
    symbol: "TCS",
    exchange: "BSE",
    exchangeSymbol: "TCS",
    securityCode: "532540",
    isin: "INE467B01029"
  }
];

async function main() {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    for (const item of listings) {
      const [result] = await connection.query(
        `INSERT INTO company_listings
          (company_id, exchange, exchange_symbol, security_code,
           isin, instrument_type, listing_status)
         SELECT id, ?, ?, ?, ?, 'EQUITY', 'ACTIVE'
         FROM companies
         WHERE symbol = ?
         ON DUPLICATE KEY UPDATE
           company_id = VALUES(company_id),
           exchange_symbol = VALUES(exchange_symbol),
           isin = VALUES(isin),
           instrument_type = 'EQUITY',
           listing_status = 'ACTIVE'`,
        [
          item.exchange,
          item.exchangeSymbol,
          item.securityCode,
          item.isin,
          item.symbol
        ]
      );

      if (result.affectedRows === 0) {
        const [matches] = await connection.query(
          "SELECT id FROM companies WHERE symbol = ?",
          [item.symbol]
        );

        if (matches.length === 0) {
          throw new Error(
            `Company ${item.symbol} does not exist in companies table`
          );
        }
      }
    }

    await connection.commit();
    console.log("SUCCESS: Exchange listing import completed.");
    console.log("Imported or updated four BEL/TCS listing records.");
  } catch (error) {
    await connection.rollback();
    console.error("Import failed; transaction rolled back:", error.message);
    process.exitCode = 1;
  } finally {
    connection.release();
    await pool.end();
  }
}

main().catch(async error => {
  console.error("Import failed:", error.message);
  await pool.end();
  process.exitCode = 1;
});
