const pool = require("./db");

async function main() {
  try {
    const [rows] = await pool.execute(`
      SELECT
        symbol,
        period_type,
        reporting_basis,
        period_end,
        currency,
        amount_unit,
        verification_status
      FROM company_fundamentals
      WHERE symbol = 'BEL'
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
