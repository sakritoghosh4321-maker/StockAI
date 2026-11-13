const pool = require("./db");

async function main() {
    const connection = await pool.getConnection();

    try {
        await connection.query(`
            CREATE TABLE IF NOT EXISTS exchange_directory (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_name VARCHAR(200) NOT NULL,
                symbol VARCHAR(50) NOT NULL,
                sector VARCHAR(100) NULL,
                exchange ENUM('NSE', 'BSE') NOT NULL,
                exchange_symbol VARCHAR(50) NOT NULL,
                security_code VARCHAR(30) NULL,
                isin VARCHAR(20) NULL,
                instrument_type VARCHAR(30) DEFAULT 'EQUITY',
                listing_status VARCHAR(20) DEFAULT 'ACTIVE',
                source_name VARCHAR(100) NOT NULL DEFAULT 'StockAI existing listings',
                source_imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_directory_exchange_symbol (
                    exchange, exchange_symbol
                ),
                UNIQUE KEY unique_directory_security_code (
                    exchange, security_code
                ),
                INDEX idx_directory_isin (isin),
                INDEX idx_directory_company_name (company_name)
            )
        `);

        await connection.beginTransaction();

        const [result] = await connection.query(`
            INSERT INTO exchange_directory (
                company_name, symbol, sector, exchange,
                exchange_symbol, security_code, isin,
                instrument_type, listing_status, source_name
            )
            SELECT
                c.name,
                c.symbol,
                c.sector,
                cl.exchange,
                cl.exchange_symbol,
                cl.security_code,
                cl.isin,
                cl.instrument_type,
                cl.listing_status,
                'StockAI existing listings'
            FROM company_listings cl
            INNER JOIN companies c ON c.id = cl.company_id
            ON DUPLICATE KEY UPDATE
                company_name = VALUES(company_name),
                symbol = VALUES(symbol),
                sector = VALUES(sector),
                security_code = VALUES(security_code),
                isin = VALUES(isin)
        `);

        await connection.commit();

        const [counts] = await connection.query(`
            SELECT exchange, COUNT(*) AS total
            FROM exchange_directory
            GROUP BY exchange
            ORDER BY exchange
        `);

        console.log("SUCCESS: exchange_directory is ready.");
        console.log("Existing listings copied or matched:", result.affectedRows);
        console.table(counts);
        console.log("Original companies and company_listings tables were not deleted.");

    } catch (error) {
        await connection.rollback();
        console.error("Setup failed:", error.message);
        process.exitCode = 1;
    } finally {
        connection.release();
        await pool.end();
    }
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
