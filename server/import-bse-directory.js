const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const { parse } = require("csv-parse/sync");
require("dotenv").config();

const DRY_RUN = !process.argv.includes("--import");
const SOURCE_FILE = path.join(__dirname, "exchange-data", "FYERS-BSE_CM.csv");
const SOURCE_NAME = "FYERS BSE CM symbol master (2026-10-25)";

function getCandidates() {
    if (!fs.existsSync(SOURCE_FILE)) {
        throw new Error(`Source file not found: ${SOURCE_FILE}`);
    }

    const content = fs.readFileSync(SOURCE_FILE, "utf8").replace(/^\uFEFF/, "");
    const rows = parse(content, {
        relax_quotes: false,
        skip_empty_lines: true,
        bom: true
    });

    const candidates = [];
    let rejected = 0;

    for (const c of rows) {
        const name = (c[1] || "").trim();
        const instrumentType = (c[2] || "").trim();
        const isin = (c[5] || "").trim();
        const exchangeSymbol = (c[9] || "").trim();
        const securityCode = (c[12] || "").trim();
        const symbol = (c[13] || "").trim();

        if (
            instrumentType !== "0" ||
            !name ||
            !exchangeSymbol.startsWith("BSE:") ||
            !/^INE[A-Z0-9]{9}$/.test(isin) ||
            !/^\d+$/.test(securityCode) ||
            !symbol
        ) {
            rejected++;
            continue;
        }

        candidates.push({
            company_name: name.slice(0, 200),
            symbol: symbol.slice(0, 50),
            exchange: "BSE",
            exchange_symbol: exchangeSymbol.slice(0, 50),
            security_code: securityCode.slice(0, 30),
            isin: isin.slice(0, 20),
            instrument_type: "EQUITY",
            listing_status: "ACTIVE",
            source_name: SOURCE_NAME
        });
    }

    return { candidates, rejected, sourceRows: rows.length };
}

async function main() {
    const { candidates, rejected, sourceRows } = getCandidates();

    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 2
    });

    let connection;

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [existingRows] = await connection.query(`
            SELECT company_name, exchange_symbol, security_code, isin
            FROM exchange_directory
            WHERE exchange = 'BSE'
            FOR UPDATE
        `);

        const existingIsins = new Set(existingRows.map(r => r.isin).filter(Boolean));
        const existingCodes = new Set(existingRows.map(r => String(r.security_code || "")).filter(Boolean));
        const existingSymbols = new Set(existingRows.map(r => r.exchange_symbol).filter(Boolean));

        const seenIsins = new Set();
        const seenCodes = new Set();
        const seenSymbols = new Set();
        const additions = [];
        let skippedExisting = 0;
        let skippedDuplicateSource = 0;

        for (const row of candidates) {
            if (
                seenIsins.has(row.isin) ||
                seenCodes.has(row.security_code) ||
                seenSymbols.has(row.exchange_symbol)
            ) {
                skippedDuplicateSource++;
                continue;
            }

            seenIsins.add(row.isin);
            seenCodes.add(row.security_code);
            seenSymbols.add(row.exchange_symbol);

            if (
                existingIsins.has(row.isin) ||
                existingCodes.has(row.security_code) ||
                existingSymbols.has(row.exchange_symbol)
            ) {
                skippedExisting++;
                continue;
            }

            additions.push(row);
        }

        console.log("\n--- BSE IMPORT SUMMARY ---");
        console.log("Source rows:", sourceRows);
        console.log("Validated equity candidates:", candidates.length);
        console.log("Rejected rows:", rejected);
        console.log("Existing records skipped:", skippedExisting);
        console.log("Duplicate source rows skipped:", skippedDuplicateSource);
        console.log("Potential additions:", additions.length);
        console.log("Mode:", DRY_RUN ? "DRY RUN — NO INSERTS" : "IMPORT ENABLED");

        console.log("\n--- FIRST 10 ADDITIONS ---");
        console.table(additions.slice(0, 10).map(r => ({
            company_name: r.company_name,
            symbol: r.symbol,
            exchange_symbol: r.exchange_symbol,
            security_code: r.security_code,
            isin: r.isin
        })));

        if (DRY_RUN) {
            await connection.rollback();
            console.log("\nDry run finished. No database records were changed.");
            return;
        }

        let inserted = 0;

        for (const row of additions) {
            await connection.query(`
                INSERT INTO exchange_directory
                    (company_name, symbol, sector, exchange,
                     exchange_symbol, security_code, isin,
                     instrument_type, listing_status, source_name,
                     source_imported_at, updated_at)
                VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
            `, [
                row.company_name,
                row.symbol,
                row.exchange,
                row.exchange_symbol,
                row.security_code,
                row.isin,
                row.instrument_type,
                row.listing_status,
                row.source_name
            ]);

            inserted++;
        }

        await connection.commit();
        console.log("\nImport committed. New rows inserted:", inserted);
        console.log("The companies table was not modified.");
    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});
        throw error;
    } finally {
        if (connection) connection.release();
        await pool.end();
    }
}

main().catch(error => {
    console.error("\nBSE import failed:", error.message);
    process.exitCode = 1;
});
