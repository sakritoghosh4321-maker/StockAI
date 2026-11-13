const pool = require("./db");

async function main() {
  try {
    await pool.query(`
      ALTER TABLE company_fundamentals
      ADD COLUMN amount_unit
      ENUM('INR', 'INR_LAKH', 'INR_CRORE')
      NOT NULL DEFAULT 'INR_CRORE'
      AFTER currency
    `);

    console.log("Success: amount_unit column added.");
  } catch (error) {
    if (error.code === "ER_DUP_FIELDNAME") {
      console.log("The amount_unit column already exists.");
    } else {
      console.error("Migration failed:", error.message);
      process.exitCode = 1;
    }
  } finally {
    await pool.end();
  }
}

main();
