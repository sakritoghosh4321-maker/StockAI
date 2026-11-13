const pool = require("./db");

async function main() {
  try {
    const [rows] = await pool.query(`
      SELECT
        symbol,
        period_type,
        period_end,
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
        source_name,
        source_url,
        verification_status
      FROM company_fundamentals
      WHERE symbol = ?
      ORDER BY period_end DESC
    `, ["BEL"]);

    console.log("BEL financial records:", rows.length);
    console.table(rows);
  } catch (error) {
    console.error("Inspection failed:", error.message);
  } finally {
    await pool.end();
  }
}

main();
