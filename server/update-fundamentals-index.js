const pool = require("./db");

async function main() {
  try {
    await pool.query(`
      ALTER TABLE company_fundamentals
      DROP INDEX uq_fundamental_period,
      ADD UNIQUE KEY uq_fundamental_period_basis
        (symbol, period_type, period_end, reporting_basis)
    `);

    console.log("Success: unique key now includes reporting_basis.");

    const [indexes] = await pool.query(
      "SHOW INDEX FROM company_fundamentals"
    );

    console.table(indexes
      .filter(row => row.Key_name === "uq_fundamental_period_basis")
      .map(row => ({
        key: row.Key_name,
        column: row.Column_name,
        sequence: row.Seq_in_index
      })));
  } catch (error) {
    console.error("Index update failed:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
