const fs = require("fs");
const path = require("path");
const pool = require("./db");

const INPUT_FILE = path.join(
    __dirname,
    "exchange-data",
    "NSE-EQUITY-L.csv"
);

const OUTPUT_FILE = path.join(
    __dirname,
    "nse-be-bz-preview.json"
);

// =====================================
// CSV PARSER
// =====================================

function parseCSV(text) {
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;

    text = text.replace(/^\uFEFF/, "");

    for (let i = 0; i < text.length; i++) {
        const char = text[i];

        if (quoted) {
            if (char === '"' && text[i + 1] === '"') {
                field += '"';
                i++;
            } else if (char === '"') {
                quoted = false;
            } else {
                field += char;
            }
        } else {
            if (char === '"') {
                quoted = true;
            } else if (char === ",") {
                row.push(field);
                field = "";
            } else if (char === "\n") {
                row.push(field);
                rows.push(row);
                row = [];
                field = "";
            } else if (char !== "\r") {
                field += char;
            }
        }
    }

    if (field.length > 0 || row.length > 0) {
        row.push(field);
        rows.push(row);
    }

    if (rows.length === 0) return [];

    const headers = rows.shift().map(h => h.trim());

    return rows
        .filter(r => r.some(value => value.trim() !== ""))
        .map(r => {
            const record = {};
            headers.forEach((header, index) => {
                record[header] = (r[index] || "").trim();
            });
            return record;
        });
}

// =====================================
// NORMALIZATION
// =====================================

function normalize(value) {
    return String(value || "").trim().toUpperCase();
}

// =====================================
// MAIN PREVIEW
// =====================================

async function main() {
    console.log("\n=====================================");
    console.log(" NSE BE / BZ LISTINGS PREVIEW");
    console.log(" READ-ONLY - NO DATABASE WRITES");
    console.log("=====================================\n");

    if (!fs.existsSync(INPUT_FILE)) {
        throw new Error(`NSE source file not found: ${INPUT_FILE}`);
    }

    const csvText = fs.readFileSync(INPUT_FILE, "utf8");
    const allRows = parseCSV(csvText);

    const candidates = allRows
        .filter(row => ["BE", "BZ"].includes(normalize(row.SERIES)))
        .map(row => ({
            symbol: normalize(row.SYMBOL),
            companyName: String(row["NAME OF COMPANY"] || "").trim(),
            series: normalize(row.SERIES),
            isin: normalize(row["ISIN NUMBER"]),
            listingDate: row["DATE OF LISTING"] || ""
        }));

    console.log("Official NSE CSV records:", allRows.length);
    console.log("BE / BZ candidates:", candidates.length);

    const seriesCounts = {
        BE: candidates.filter(r => r.series === "BE").length,
        BZ: candidates.filter(r => r.series === "BZ").length
    };

    console.log("BE records:", seriesCounts.BE);
    console.log("BZ records:", seriesCounts.BZ);

    // Read existing NSE and BSE listings.
    const [existingRows] = await pool.query(`
        SELECT
            exchange,
            symbol,
            exchange_symbol,
            company_name,
            isin,
            series
        FROM exchange_directory
        WHERE exchange IN ('NSE', 'BSE')
    `);

    const nseRows = existingRows.filter(
        row => normalize(row.exchange) === "NSE"
    );

    const bseRows = existingRows.filter(
        row => normalize(row.exchange) === "BSE"
    );

    const results = [];

    // =====================================
    // CHECK EACH CANDIDATE
    // =====================================

    for (const candidate of candidates) {
        const issues = [];

        if (!candidate.symbol || !candidate.companyName || !candidate.isin) {
            issues.push("MISSING_REQUIRED_FIELD");
        }

        const sameNseSymbol = nseRows.filter(row =>
            normalize(row.exchange_symbol) === candidate.symbol ||
            normalize(row.symbol) === candidate.symbol
        );

        const sameNseIsin = nseRows.filter(row =>
            normalize(row.isin) === candidate.isin
        );

        const sameBseIsin = bseRows.filter(row =>
            candidate.isin &&
            normalize(row.isin) === candidate.isin
        );

        const sameSourceSymbol = candidates.filter(row =>
            row.symbol === candidate.symbol
        );

        const sameSourceIsin = candidates.filter(row =>
            row.isin === candidate.isin
        );

        let status = "POTENTIAL_ADD";

        if (issues.length > 0) {
            status = "INVALID_SOURCE_RECORD";
        } else if (sameSourceSymbol.length > 1) {
            status = "DUPLICATE_SYMBOL_IN_SOURCE";
        } else if (
            sameSourceIsin.length > 1 &&
            sameSourceIsin.some(row => row.symbol !== candidate.symbol)
        ) {
            status = "DUPLICATE_ISIN_IN_SOURCE";
        } else if (sameNseSymbol.length > 0) {
            const exactIsinMatch = sameNseSymbol.some(
                row => normalize(row.isin) === candidate.isin
            );

            status = exactIsinMatch
                ? "ALREADY_EXISTS"
                : "SYMBOL_ISIN_CONFLICT";
        } else if (sameNseIsin.length > 0) {
            status = "NSE_ISIN_USED_BY_DIFFERENT_SYMBOL";
        }

        results.push({
            ...candidate,
            status,
            issues,
            existingNseSymbolMatches: sameNseSymbol.map(row => ({
                symbol: row.symbol,
                exchangeSymbol: row.exchange_symbol,
                isin: row.isin,
                series: row.series
            })),
            existingNseIsinMatches: sameNseIsin.map(row => ({
                symbol: row.symbol,
                exchangeSymbol: row.exchange_symbol,
                isin: row.isin,
                series: row.series
            })),
            existingBseIsinMatches: sameBseIsin.map(row => ({
                symbol: row.symbol,
                exchangeSymbol: row.exchange_symbol,
                isin: row.isin
            }))
        });
    }

    // =====================================
    // SUMMARY
    // =====================================

    const statusCounts = {};

    for (const result of results) {
        statusCounts[result.status] =
            (statusCounts[result.status] || 0) + 1;
    }

    const preview = {
        generatedAt: new Date().toISOString(),
        sourceFile: "NSE-EQUITY-L.csv",
        mode: "READ_ONLY_PREVIEW",
        databaseWritesPerformed: false,
        sourceRecordCount: allRows.length,
        candidateCount: candidates.length,
        seriesCounts,
        existingDatabaseCounts: {
            NSE: nseRows.length,
            BSE: bseRows.length
        },
        statusCounts,
        results
    };

    fs.writeFileSync(
        OUTPUT_FILE,
        JSON.stringify(preview, null, 2),
        "utf8"
    );

    console.log("\n=====================================");
    console.log(" PREVIEW RESULTS");
    console.log("=====================================\n");

    console.table(statusCounts);

    console.log("\nExisting NSE records:", nseRows.length);
    console.log("Existing BSE records:", bseRows.length);

    console.log("\nPreview saved to:");
    console.log(OUTPUT_FILE);

    console.log("\nNo database records were inserted, updated, or deleted.");
}

main()
    .catch(error => {
        console.error("\nPREVIEW FAILED:");
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
    });