const pool = require("./db");

async function insertCompanies() {
    try {
        const companies = [
            ["Reliance Industries", "RELIANCE", "Energy and Retail", 1450, 12.5, 0.87],
            ["Tata Motors", "TATAMOTORS", "Automobile", 720, -8, -1.10],
            ["Bharat Electronics", "BEL", "Defence", 410, 6.5, 1.61],
            ["Adani Power", "ADANIPOWER", "Power and Energy", 590, 10, 1.72],
            ["TCS", "TCS", "Information Technology", 3200, 25, 0.79],
            ["State Bank of India", "SBIN", "Banking", 800, -4, -0.50]
        ];

        const sql = `
            INSERT INTO companies
            (name, symbol, sector, price, change_amount, change_percent)
            VALUES ?
            ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            sector = VALUES(sector),
            price = VALUES(price),
            change_amount = VALUES(change_amount),
            change_percent = VALUES(change_percent)
        `;

        await pool.query(sql, [companies]);

        console.log("Company data inserted successfully!");
    } catch (error) {
        console.error("Error inserting companies:", error.message);
    } finally {
        await pool.end();
    }
}

insertCompanies();