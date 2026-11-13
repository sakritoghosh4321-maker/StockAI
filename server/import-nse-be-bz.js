
const fs = require("fs");
const path = require("path");
const pool = require("./db");

const PREVIEW_FILE = path.join(__dirname, "nse-be-bz-preview.json");
const IMPORT_MODE = process.argv.includes("--import");

const EXCLUDED_SYMBOLS = new Set(["OLAELEC-RE"]);

const DVR_SYMBOLS = new Set([
    "FELDVR",
    "GATECHDVR"
]);

function normalize(value) {
    return String(value || "").trim().toUpperCase();
}

async function main() {
    console.log("\n=====================================");
    console.log(" NSE BE / BZ IMPORTER");
    console.log(IMPORT_MODE ? " IMPORT MODE" : " DRY-RUN MODE");
    console.log("=====================================\n");

    if (!fs.existsSync(PREVIEW_FILE)) {
        throw new Error("Preview JSON not found. Run preview script first.");
    }

    const preview = JSON.parse(
        fs.readFileSync(PREVIEW_FILE, "utf8")
    );

    if (preview.mode !== "READ_ONLY_PREVIEW") {
        throw new Error("Unexpected preview file mode.");
    }

    const candidates = preview.results.filter(row =>
        row.status === "POTENTIAL_ADD" &&
        ["BE", "BZ"].includes(normalize(row.series)) &&
        !EXCLUDED_SYMBOLS.has(normalize(row.symbol))
    );

    if (candidates.length !== 253) {
        throw new Error(
            `Expected 253 eligible records, found ${candidates.length}.`
        );
    }

    const symbols = new Set();
    const isins = new Set();

    for (const row of candidates) {
        const symbol = normalize(row.symbol);
        const isin = normalize(row.isin);

        if (!symbol || !isin || !row.companyName) {
            throw new Error(`Missing required data: ${symbol}`);
        }

        if (symbols.has(symbol)) {
            throw new Error(`Duplicate symbol: ${symbol}`);
        }

        if (isins.has(isin)) {
            throw new Error(`Duplicate ISIN: ${isin}`);
        }

        symbols.add(symbol);
        isins.add(isin);
    }

    const [existingRows] = await pool.query(`
        SELECT symbol, exchange_symbol, isin
        FROM exchange_directory
        WHERE exchange = 'NSE'
    `);

    const existingSymbols = new Set(
        existingRows.map(row => normalize(row.exchange_symbol))
    );

    const existingIsins = new Set(
        existingRows.map(row => normalize(row.isin))
    );

    const ready = [];
    const skipped = [];

    for (const row of candidates) {
        const symbol = normalize(row.symbol);
        const isin = normalize(row.isin);

        if (existingSymbols.has(symbol)) {
            skipped.push({ symbol, reason: "NSE symbol already exists" });
        } else if (existingIsins.has(isin)) {
            skipped.push({ symbol, reason: "NSE ISIN already exists" });
        } else {
            ready.push({
                exchange: "NSE",
                symbol,
                exchange_symbol: symbol,
                company_name: row.companyName.trim(),
                isin,
                series: normalize(row.series),
                instrument_type: DVR_SYMBOLS.has(symbol)
                    ? "DVR"
                    : "EQUITY",
                listing_status: "ACTIVE",
                source_name: "NSE official BE/BZ CSV"
            });
        }
    }

    const summary = {
        sourceCandidates: candidates.length,
        readyToImport: ready.length,
        skipped: skipped.length,
        BE: ready.filter(row => row.series === "BE").length,
        BZ: ready.filter(row => row.series === "BZ").length,
        DVR: ready.filter(row => row.instrument_type === "DVR").length,
        EQUITY: ready.filter(row => row.instrument_type === "EQUITY").length
    };

    console.log("IMPORT SUMMARY");
    console.table(summary);

    if (skipped.length) {
        console.log("\nSKIPPED RECORDS");
        console.table(skipped);
    }

    console.log("\nFIRST 15 READY RECORDS");
    console.table(ready.slice(0, 15));

    if (!IMPORT_MODE) {
        console.log("\nDRY RUN COMPLETE.");
        console.log("No database records were changed.");
        console.log("Use --import only after reviewing and approving.");
        return;
    }

    console.log("\nStarting database transaction...");

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        let inserted = 0;

        for (const row of ready) {
            await connection.query(
                `INSERT INTO exchange_directory
                (
                    exchange,
                    symbol,
                    exchange_symbol,
                    company_name,
                    isin,
                    series,
                    instrument_type,
                    listing_status,
                    source_name
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    row.exchange,
                    row.symbol,
                    row.exchange_symbol,
                    row.company_name,
                    row.isin,
                    row.series,
                    row.instrument_type,
                    row.listing_status,
                    row.source_name
                ]
            );

            inserted++;
        }

        await connection.commit();

        console.log("\nIMPORT SUCCESSFUL");
        console.log("Records inserted:", inserted);
        console.log("Records skipped:", skipped.length);

    } catch (error) {
        await connection.rollback();
        console.error("\nIMPORT FAILED. Transaction rolled back.");
        throw error;
    } finally {
        connection.release();
    }
}

main()
    .catch(error => {
        console.error("\nERROR:", error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
    });
