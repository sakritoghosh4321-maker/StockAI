const pool = require("./db");

async function check() {
  try {
    const [tables] = await pool.query("SHOW TABLES");
    console.log("\n=== DATABASE TABLES ===");
    console.table(tables);

    const [companies] = await pool.query(`
      SELECT id, name, symbol, sector
      FROM companies
      WHERE symbol IN ('BEL', 'TCS')
      ORDER BY symbol
    `);
    console.log("\n=== BEL AND TCS IN COMPANIES ===");
    console.table(companies);

    const [listings] = await pool.query(`
      SELECT exchange, exchange_symbol, company_id, listing_status
      FROM company_listings
      WHERE exchange_symbol IN ('BEL', 'TCS')
      ORDER BY exchange, exchange_symbol
    `);
    console.log("\n=== BEL AND TCS IN COMPANY LISTINGS ===");
    console.table(listings);

    const [counts] = await pool.query(`
      SELECT exchange, COUNT(*) AS total
      FROM company_listings
      GROUP BY exchange
    `);
    console.log("\n=== LISTING COUNTS ===");
    console.table(counts);

  } catch (error) {
    console.error("CHECK FAILED:", error.message);
  } finally {
    await pool.end();
  }
}

check();
