const fs = require("fs");
const mysql = require("mysql2/promise");
require("dotenv").config();

async function main() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 2
    });

    try {
        const [existing] = await pool.query(
            "SELECT exchange, exchange_symbol, security_code, isin FROM exchange_directory WHERE exchange = 'BSE'"
        );

        const lines = fs.readFileSync(
            "./exchange-data/FYERS-BSE_CM.csv",
            "utf8"
        ).split(/\r?\n/).filter(Boolean);

        const candidates = [];
        for (const line of lines) {
            const c = line.split(",");
            if (
                c.length >= 15 &&
                c[2] === "0" &&
                c[9]?.startsWith("BSE:") &&
                /^INE[A-Z0-9]{9}$/.test(c[5] || "") &&
                /^\d+$/.test(c[12] || "") &&
                (c[1] || "").trim()
            ) {
                candidates.push({
                    name: c[1].trim(),
                    isin: c[5],
                    symbol: c[13],
                    code: c[12]
                });
            }
        }

        const existingIsins = new Set(existing.map(r => r.isin).filter(Boolean));
        const existingCodes = new Set(existing.map(r => String(r.security_code || "")).filter(Boolean));

        const alreadyPresent = candidates.filter(r =>
            existingIsins.has(r.isin) || existingCodes.has(r.code)
        );
        const newCandidates = candidates.filter(r =>
            !existingIsins.has(r.isin) && !existingCodes.has(r.code)
        );

        console.log("Existing BSE directory rows:", existing.length);
        console.log("Validated equity candidates:", candidates.length);
        console.log("Already represented by ISIN or BSE code:", alreadyPresent.length);
        console.log("Potential new records:", newCandidates.length);
        console.log("\nFirst 15 potential additions:");
        console.table(newCandidates.slice(0, 15));

        console.log("\nDRY RUN ONLY — no database records were changed.");
    } finally {
        await pool.end();
    }
}

main().catch(err => {
    console.error("Check failed:", err.message);
    process.exitCode = 1;
});
