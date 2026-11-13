const pool = require("./db");

async function main() {
  try {
    const [rows] = await pool.query(
      "SHOW INDEX FROM company_fundamentals"
    );
    console.table(rows.map(r => ({
      key: r.Key_name,
      column: r.Column_name,
      sequence: r.Seq_in_index
    })));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
