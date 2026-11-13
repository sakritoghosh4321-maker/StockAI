const pool = require("./db");

async function upgradeDatabase() {
    let connection;

    try {
        connection = await pool.getConnection();

        await connection.beginTransaction();

        await connection.query(`
            CREATE TABLE IF NOT EXISTS company_listings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id INT NOT NULL,
                exchange ENUM('NSE', 'BSE') NOT NULL,
                exchange_symbol VARCHAR(50) NOT NULL,
                security_code VARCHAR(30) NULL,
                isin VARCHAR(20) NULL,
                instrument_type VARCHAR(30) DEFAULT 'EQUITY',
                listing_status VARCHAR(20) DEFAULT 'ACTIVE',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_exchange_symbol (
                    exchange,
                    exchange_symbol
                ),
                UNIQUE KEY unique_exchange_security_code (
                    exchange,
                    security_code
                ),
                CONSTRAINT fk_company_listings_company
                    FOREIGN KEY (company_id)
                    REFERENCES companies(id)
                    ON DELETE CASCADE
            )
        `);

        await connection.commit();

        console.log("SUCCESS: company_listings table is ready.");
        console.log("Existing companies table was not modified.");
        console.log("No sample or fake prices were inserted.");

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        console.error("Database upgrade failed:", error.message);
        process.exitCode = 1;

    } finally {
        if (connection) {
            connection.release();
        }

        await pool.end();
    }
}

upgradeDatabase();
