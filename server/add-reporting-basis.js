const pool = require("./db");

async function main() {
  try {
    await pool.query(`
      ALTER TABLE company_fundamentals
      ADD COLUMN reporting_basis
      ENUM('STANDALONE', 'CONSOLIDATED')
      NOT NULL DEFAULT 'CONSOLIDATED'
      AFTER period_type
    `);

    console.log("Success: reporting_basis column added.");
  } catch (error) {
    if (error.code === "ER_DUP_FIELDNAME") {
      console.log("The reporting_basis column already exists.");
    } else {
      console.error("Migration failed:", error.message);
      process.exitCode = 1;
    }
  } finally {
    await pool.end();
  }
}

main();
