const pool = require("./db");

async function main() {
  try {
    const [tables] = await pool.execute(
      "SHOW TABLES"
    );

    console.log("DATABASE TABLES:");
    console.table(tables);

    const [columns] = await pool.execute(
      "SHOW COLUMNS FROM company_fundamentals"
    );

    console.log("FUNDAMENTALS TABLE:");
    console.table(columns);
  } catch (error) {
    console.error(error);
  } finally {
    await pool.end();
  }
}

main();
