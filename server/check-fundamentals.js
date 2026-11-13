const pool = require("./db");

async function main() {
  try {
    const [rows] = await pool.query(`
      SELECT symbol, period_type, period_end, verification_status
      FROM company_fundamentals
      ORDER BY symbol, period_end DESC
    `);

    console.log("Existing financial records:", rows.length);
    console.table(rows);
  } catch (error) {
    console.error("Database check failed:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
