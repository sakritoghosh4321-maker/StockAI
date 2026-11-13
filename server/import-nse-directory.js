const fs = require("fs");
const pool = require("./db");

function parseCSV(text) {
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;

    text = text.replace(/^\uFEFF/, "");

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];

        if (quoted) {
            if (ch === '"' && text[i + 1] === '"') {
                field += '"';
                i++;
            } else if (ch === '"') {
                quoted = false;
            } else {
                field += ch;
            }
        } else if (ch === '"' && field.length === 0) {
            quoted = true;
        } else if (ch === ",") {
            row.push(field);
            field = "";
        } else if (ch === "\n") {
            row.push(field.replace(/\r$/, ""));
            if (row.some(value => value.trim() !== "")) rows.push(row);
            row = [];
            field = "";
        } else {
            field += ch;
        }
    }

    if (field.length || row.length) {
        row.push(field.replace(/\r$/, ""));
        if (row.some(value => value.trim() !== "")) rows.push(row);
    }

    const headers = rows.shift().map(value => value.trim());

    return rows.map(values => {
        const record = {};
        headers.forEach((header, index) => {
            record[header] = (values[index] || "").trim();
        });
        return record;
    });
}

async function main() {
    const file = "./exchange-data/NSE-EQUITY-L.csv";

    if (!fs.existsSync(file)) {
        throw new Error(`Source file not found: ${file}`);
    }

    const records = parseCSV(fs.readFileSync(file, "utf8"));
    const required = [
        "SYMBOL",
        "NAME OF COMPANY",
        "SERIES",
        "ISIN NUMBER"
    ];

    for (const column of required) {
        if (!records.length || !(column in records[0])) {
            throw new Error(`Missing expected CSV column: ${column}`);
        }
    }

    const equities = records.filter(record =>
        record.SERIES === "EQ" &&
        record.SYMBOL &&
        record["NAME OF COMPANY"]
    );

    if (equities.length < 1000) {
        throw new Error(
            `Only ${equities.length} valid EQ rows found. Import cancelled.`
        );
    }

    const connection = await pool.getConnection();
    let processed = 0;

    try {
        await connection.beginTransaction();

        for (const item of equities) {
            const isin = item["ISIN NUMBER"] || null;

            await connection.query(
                `INSERT INTO exchange_directory (
                    company_name, symbol, exchange, exchange_symbol,
                    security_code, isin, instrument_type, listing_status,
                    source_name, source_imported_at
                ) VALUES (?, ?, 'NSE', ?, NULL, ?, 'EQUITY', 'ACTIVE',
                          'NSE official EQ CSV', CURRENT_TIMESTAMP)
                ON DUPLICATE KEY UPDATE
                    company_name = VALUES(company_name),
                    symbol = VALUES(symbol),
                    isin = COALESCE(VALUES(isin), isin),
                    instrument_type = 'EQUITY',
                    listing_status = 'ACTIVE',
                    source_name = 'NSE official EQ CSV',
                    source_imported_at = CURRENT_TIMESTAMP`,
                [
                    item["NAME OF COMPANY"],
                    item.SYMBOL,
                    item.SYMBOL,
                    isin
                ]
            );

            processed++;
        }

        await connection.commit();

        const [counts] = await connection.query(`
            SELECT exchange, COUNT(*) AS total
            FROM exchange_directory
            GROUP BY exchange
            ORDER BY exchange
        `);

        console.log("SUCCESS: NSE directory import completed.");
        console.log("Valid NSE EQ source rows:", equities.length);
        console.log("Processed rows:", processed);
        console.table(counts);
        console.log("Main companies table was not modified.");
    } catch (error) {
        await connection.rollback();
        console.error("Import failed; transaction rolled back:", error.message);
        process.exitCode = 1;
    } finally {
        connection.release();
        await pool.end();
    }
}

main().catch(error => {
    console.error("Import failed:", error.message);
    process.exitCode = 1;
});
