const pool = require("./db");

async function main() {
  try {
    const [rows] = await pool.execute(
      "SHOW COLUMNS FROM company_fundamentals"
    );
    console.table(rows);
  } catch (error) {
    console.error(error);
  } finally {
    await pool.end();
  }
}

main();
