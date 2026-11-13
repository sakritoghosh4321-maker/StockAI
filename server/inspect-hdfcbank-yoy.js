const pool = require("./db");

async function main() {
  try {
    const [rows] = await pool.execute(
      `SELECT
         id,
         DATE_FORMAT(period_end, '%Y-%m-%d') AS periodEnd,
         reporting_basis,
         revenue,
         net_profit,
         eps,
         total_assets,
         total_debt,
         shareholders_equity,
         operating_cash_flow,
         verification_status,
         source_name
       FROM company_fundamentals
       WHERE symbol = 'HDFCBANK'
         AND period_type = 'ANNUAL'
         AND period_end IN ('2025-03-31', '2026-03-31')
       ORDER BY period_end`
    );

    console.table(rows);
  } catch (error) {
    console.error(error);
  } finally {
    await pool.end();
  }
}

main();
