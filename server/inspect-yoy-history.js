const pool = require("./db");

async function main() {
  try {
    const [rows] = await pool.execute(
      `SELECT
         id,
         symbol,
         DATE_FORMAT(period_end, '%Y-%m-%d') AS periodEnd,
         period_type,
         reporting_basis,
         currency,
         amount_unit,
         revenue,
         net_profit,
         eps,
         total_assets,
         total_debt,
         shareholders_equity,
         operating_cash_flow,
         verification_status,
         source_name,
         source_url
       FROM company_fundamentals
       WHERE symbol IN (?, ?, ?, ?, ?)
         AND period_type = 'ANNUAL'
         AND period_end = '2025-03-31'
       ORDER BY symbol`,
      ["SBIN", "HDFCBANK", "AARTIIND", "RELIANCE", "TCS"]
    );

    console.table(rows);
    console.log("Records found:", rows.length);
  } catch (error) {
    console.error(error);
  } finally {
    await pool.end();
  }
}

main();
