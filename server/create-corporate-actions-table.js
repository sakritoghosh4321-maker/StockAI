const pool = require("./db");

async function main() {
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS company_corporate_actions (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        symbol VARCHAR(30) NOT NULL,
        action_type ENUM('BONUS', 'STOCK_SPLIT') NOT NULL,
        ratio_numerator INT UNSIGNED NOT NULL,
        ratio_denominator INT UNSIGNED NOT NULL,
        announcement_date DATE NULL,
        record_date DATE NULL,
        effective_date DATE NOT NULL,
        source_name VARCHAR(150) NOT NULL,
        source_url TEXT NULL,
        verification_status ENUM('PENDING', 'VERIFIED', 'REJECTED')
          NOT NULL DEFAULT 'PENDING',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
          ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_corporate_action_symbol_date (symbol, effective_date),
        INDEX idx_corporate_action_status (verification_status)
      ) ENGINE=InnoDB
    `);

    const [rows] = await pool.execute(
      "SHOW CREATE TABLE company_corporate_actions"
    );

    console.log("Corporate-actions table created and verified.");
    console.log(rows[0]["Create Table"]);
  } catch (error) {
    console.error("Table creation failed:", error.message);
  } finally {
    await pool.end();
  }
}

main();
