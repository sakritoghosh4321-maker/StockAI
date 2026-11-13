const pool = require("./db");

async function createTables() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS companies (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(150) NOT NULL,
                symbol VARCHAR(30) NOT NULL UNIQUE,
                sector VARCHAR(100),
                price DECIMAL(12,2) DEFAULT 0,
                change_amount DECIMAL(12,2) DEFAULT 0,
                change_percent DECIMAL(8,2) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log("Companies table created successfully!");
    } catch (error) {
        console.error("Error creating table:", error.message);
    } finally {
        await pool.end();
    }
}

createTables();