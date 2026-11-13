const pool = require("./db");

async function testConnection() {
    try {
        const connection = await pool.getConnection();

        console.log("MySQL connected successfully!");

        const [rows] = await connection.query(
            "SELECT DATABASE() AS databaseName"
        );

        console.log("Connected Database:", rows[0].databaseName);

        connection.release();
        await pool.end();
    } catch (error) {
        console.error("MySQL connection failed:", error.message);
        process.exitCode = 1;
        await pool.end();
    }
}

testConnection();