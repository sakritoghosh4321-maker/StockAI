const pool = require("./db");

async function createCompanyIntelligenceTable() {
    try {

        await pool.query(`
            CREATE TABLE IF NOT EXISTS company_intelligence (

                id INT AUTO_INCREMENT PRIMARY KEY,

                symbol VARCHAR(30) NOT NULL UNIQUE,

                company_overview TEXT,

                business_activities TEXT,

                products_services TEXT,

                order_book TEXT,

                contracts TEXT,

                projects TEXT,

                partnerships TEXT,

                future_developments TEXT,

                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    ON UPDATE CURRENT_TIMESTAMP

            )
        `);

        console.log(
            "Company Intelligence table created successfully!"
        );

    } catch (error) {

        console.error(
            "Error creating Company Intelligence table:",
            error.message
        );

    } finally {

        await pool.end();

    }
}

createCompanyIntelligenceTable();