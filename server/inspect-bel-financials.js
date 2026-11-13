const pool = require("./db");

async function main() {
  try {
    const [rows] = await pool.execute(`
      SELECT
        id, period_end, revenue, net_profit, eps,
        total_assets, total_debt, shareholders_equity,
        operating_cash_flow, source_name, source_url,
        verification_status
      FROM company_fundamentals
      WHERE symbol = 'BEL'
      ORDER BY period_end
    `);

    console.table(rows);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();

