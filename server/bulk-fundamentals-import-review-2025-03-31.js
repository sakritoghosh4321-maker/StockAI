const fs = require("fs");
const pool = require("./db");

const INPUT = "./bulk-fundamentals-preview-2025-03-31.json";
const OUTPUT = "./bulk-fundamentals-import-review-2025-03-31.json";

async function main() {
    const report = JSON.parse(fs.readFileSync(INPUT, "utf8"));

    if (report.mode !== "PREVIEW_ONLY") {
        throw new Error("Input is not a PREVIEW_ONLY report.");
    }

    if (report.financialYear !== "2024-04-01 to 2025-03-31") {
        throw new Error("Unexpected financial year in preview.");
    }

    const records = report.readyForReview || [];

    if (!records.length) {
        throw new Error("No records found for review.");
    }

    const symbols = [...new Set(records.map(r => r.symbol))];

    const [listings] = await pool.query(
        `SELECT symbol, isin, exchange
         FROM exchange_directory
         WHERE listing_status = 'ACTIVE'
           AND symbol IN (?)`,
        [symbols]
    );

    const listingMap = new Map();

    for (const row of listings) {
        const key =
            `${row.symbol}|${String(row.isin || "").toUpperCase()}`;

        if (!listingMap.has(key)) listingMap.set(key, []);
        listingMap.get(key).push(row.exchange);
    }

    const [existing] = await pool.query(
        `SELECT symbol
         FROM company_fundamentals
         WHERE period_type = 'ANNUAL'
           AND reporting_basis = 'CONSOLIDATED'
           AND period_end = '2025-03-31'`
    );

    const existingSymbols = new Set(existing.map(r => r.symbol));

    const eligible = [];
    const manualReview = [];
    const listingMismatch = [];
    const alreadyExists = [];
    const invalid = [];

    for (const r of records) {
        const required = [
            "revenue",
            "totalIncome",
            "netProfit",
            "eps",
            "totalAssets",
            "shareholdersEquity"
        ];

        const valid =
            r.symbol &&
            r.isin &&
            r.financialYearStart === "2024-04-01" &&
            r.financialYearEnd === "2025-03-31" &&
            r.periodEnd === "2025-03-31" &&
            r.periodType === "ANNUAL" &&
            r.reportingBasis === "CONSOLIDATED" &&
            r.currency === "INR" &&
            r.amountUnit === "INR_CRORE" &&
            r.sourceUrl?.startsWith(
                "https://nsearchives.nseindia.com/"
            ) &&
            required.every(key =>
                typeof r[key] === "number" &&
                Number.isFinite(r[key])
            ) &&
            (r.otherIncome === null ||
                (typeof r.otherIncome === "number" &&
                 Number.isFinite(r.otherIncome))) &&
            (r.totalDebt === null ||
                (typeof r.totalDebt === "number" &&
                 Number.isFinite(r.totalDebt))) &&
            (r.operatingCashFlow === null ||
                (typeof r.operatingCashFlow === "number" &&
                 Number.isFinite(r.operatingCashFlow)));

        if (!valid) {
            invalid.push(r);
            continue;
        }

        const key = `${r.symbol}|${r.isin.toUpperCase()}`;
        const exchanges = listingMap.get(key);

        if (!exchanges || !exchanges.length) {
            listingMismatch.push(r);
            continue;
        }

        if (existingSymbols.has(r.symbol)) {
            alreadyExists.push({
                symbol: r.symbol,
                company: r.company
            });
            continue;
        }

        const warnings = [];

        if (r.revenue <= 0) warnings.push("ZERO_OR_NEGATIVE_REVENUE");
        if (r.shareholdersEquity < 0) warnings.push("NEGATIVE_EQUITY");
        if (r.totalDebt === null) warnings.push("MISSING_DEBT_DATA");
        if (r.netProfit < 0) warnings.push("NET_LOSS");
        if (r.operatingCashFlow !== null &&
            r.operatingCashFlow < 0) {
            warnings.push("NEGATIVE_OPERATING_CASH_FLOW");
        }
        if (r.nameMatchWarning) warnings.push("COMPANY_NAME_WARNING");

        if (r.sourceName?.includes("BANKING")) {
            warnings.push("BANKING_TAXONOMY_REQUIRES_MANUAL_SOURCE_CHECK");
        }

        const item = {
            ...r,
            matchedExchanges: [...new Set(exchanges)],
            manualReviewWarnings: warnings,
            verificationStatus: "PENDING"
        };

        if (warnings.length) {
            manualReview.push(item);
        } else {
            eligible.push(item);
        }
    }

    const output = {
        generatedAt: new Date().toISOString(),
        inputFile: INPUT,
        inputGeneratedAt: report.generatedAt,
        periodEnd: "2025-03-31",
        reportingBasis: "CONSOLIDATED",
        periodType: "ANNUAL",
        databaseWritePerformed: false,
        approvalRequired: true,
        counts: {
            totalPreviewRecords: records.length,
            eligibleForApproval: eligible.length,
            manualReview: manualReview.length,
            listingMismatch: listingMismatch.length,
            alreadyExists: alreadyExists.length,
            invalid: invalid.length
        },
        eligibleForApproval: eligible,
        manualReview,
        listingMismatch,
        alreadyExists,
        invalid
    };

    fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2));

    console.log("\n========== FY2025 SAFE IMPORT REVIEW ==========");
    console.table(output.counts);

    console.log("\nFive target companies:");
    const targets = ["SBIN", "HDFCBANK", "AARTIIND", "RELIANCE", "TCS"];

    for (const symbol of targets) {
        const found =
            eligible.find(r => r.symbol === symbol) ||
            manualReview.find(r => r.symbol === symbol) ||
            listingMismatch.find(r => r.symbol === symbol) ||
            invalid.find(r => r.symbol === symbol);

        console.log(
            symbol,
            found
                ? manualReview.some(r => r.symbol === symbol)
                    ? "MANUAL REVIEW"
                    : eligible.some(r => r.symbol === symbol)
                        ? "ELIGIBLE"
                        : "CHECK REQUIRED"
                : "NOT FOUND IN READY RECORDS"
        );
    }

    console.log("\nReview file:", OUTPUT);
    console.log("DATABASE INSERTS: 0");
    console.log("DATABASE UPDATES: 0");
    console.log("DATABASE DELETES: 0");

    await pool.end();
}

main().catch(async error => {
    console.error("\nREVIEW ERROR:", error.message);
    await pool.end();
    process.exitCode = 1;
});

