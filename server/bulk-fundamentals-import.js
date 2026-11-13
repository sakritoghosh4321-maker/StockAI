const fs = require("fs");
const pool = require("./db");

const REVIEW_FILE = "./bulk-fundamentals-import-review-2026-03-31.json";
const APPROVAL_FILE = "./bulk-fundamentals-approved-symbols-2026-03-31.json";

const APPLY = process.argv.includes("--apply");

function readJsonFile(path) {
    const content = fs.readFileSync(path, "utf8").replace(/^\uFEFF/, "");
    return JSON.parse(content);
}

async function main() {
    const review = readJsonFile(REVIEW_FILE);
    const approval = readJsonFile(APPROVAL_FILE);

    if (
        review.periodEnd !== "2026-03-31" ||
        review.periodType !== "ANNUAL" ||
        review.reportingBasis !== "CONSOLIDATED" ||
        review.databaseWritePerformed !== false
    ) {
        throw new Error("Review report is invalid or has the wrong period.");
    }

    if (
        approval.periodEnd !== review.periodEnd ||
        approval.periodType !== review.periodType ||
        approval.reportingBasis !== review.reportingBasis ||
        !Array.isArray(approval.approvedSymbols) ||
        approval.approvedSymbols.length === 0
    ) {
        throw new Error("Approval file is invalid.");
    }

    const approvedSymbols = [...new Set(
        approval.approvedSymbols.map(s => String(s).trim().toUpperCase())
    )];

    const reviewRecords = [
        ...(review.eligibleForApproval || []),
        ...(review.manualReview || [])
    ];

    const selected = [];

    for (const symbol of approvedSymbols) {
        const matches = reviewRecords.filter(
            r => String(r.symbol).toUpperCase() === symbol
        );

        if (matches.length !== 1) {
            throw new Error(
                `Expected exactly one reviewed record for ${symbol}; found ${matches.length}.`
            );
        }

        const r = matches[0];

        if ((r.manualReviewWarnings || []).length > 0) {
            throw new Error(
                `${symbol} has manual-review warnings and cannot be imported.`
            );
        }

        if (
            !r.sourceUrl ||
            !r.sourceUrl.startsWith("https://nsearchives.nseindia.com/") ||
            r.periodEnd !== approval.periodEnd ||
            r.periodType !== approval.periodType ||
            r.reportingBasis !== approval.reportingBasis ||
            r.currency !== "INR" ||
            r.amountUnit !== "INR_CRORE" ||
            !r.isin ||
            !r.matchedExchanges?.length
        ) {
            throw new Error(`${symbol} failed source or identity validation.`);
        }

        const required = [
            r.revenue,
            r.netProfit,
            r.eps,
            r.totalAssets,
            r.shareholdersEquity
        ];

        if (!required.every(v =>
            typeof v === "number" && Number.isFinite(v)
        )) {
            throw new Error(`${symbol} has missing required financial values.`);
        }

        for (const field of ["totalDebt", "operatingCashFlow"]) {
            if (
                r[field] !== null &&
                (typeof r[field] !== "number" ||
                 !Number.isFinite(r[field]))
            ) {
                throw new Error(`${symbol} has an invalid ${field} value.`);
            }
        }

        selected.push(r);
    }

    const [existing] = await pool.query(
        `SELECT symbol
         FROM company_fundamentals
         WHERE period_type = ?
           AND reporting_basis = ?
           AND period_end = ?`,
        [approval.periodType, approval.reportingBasis, approval.periodEnd]
    );

    const existingSymbols = new Set(
        existing.map(r => String(r.symbol).toUpperCase())
    );

    const candidates = selected.filter(
        r => !existingSymbols.has(String(r.symbol).toUpperCase())
    );

    const alreadyPresent = selected.filter(
        r => existingSymbols.has(String(r.symbol).toUpperCase())
    );

    console.log("\n========== APPROVED FUNDAMENTALS IMPORT ==========");
    console.log("Mode:", APPLY ? "APPLY" : "DRY RUN");
    console.log("Approved symbols:", approvedSymbols.join(", "));
    console.log("Approved records:", selected.length);
    console.log("Already present:", alreadyPresent.length);
    console.log("New import candidates:", candidates.length);

    console.table(candidates.map(r => ({
        symbol: r.symbol,
        revenue: r.revenue,
        netProfit: r.netProfit,
        eps: r.eps,
        totalAssets: r.totalAssets,
        totalDebt: r.totalDebt,
        shareholdersEquity: r.shareholdersEquity,
        operatingCashFlow: r.operatingCashFlow
    })));

    if (!APPLY) {
        console.log("\nDRY RUN ONLY.");
        console.log("No database records inserted, updated or deleted.");
        await pool.end();
        return;
    }

    if (alreadyPresent.length) {
        throw new Error(
            "An approved record already exists. Refusing to import."
        );
    }

    if (candidates.length !== approvedSymbols.length) {
        throw new Error("Candidate count does not match approved symbol count.");
    }

    const connection = await pool.getConnection();

    let inserted = 0;

    try {
        await connection.beginTransaction();

        for (const r of candidates) {
            await connection.execute(
                `INSERT INTO company_fundamentals (
                    symbol, period_type, reporting_basis, period_end,
                    currency, amount_unit, revenue, net_profit, eps,
                    total_assets, total_debt, shareholders_equity,
                    operating_cash_flow, source_name, source_url,
                    verification_status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    r.symbol,
                    approval.periodType,
                    approval.reportingBasis,
                    approval.periodEnd,
                    r.currency,
                    r.amountUnit,
                    r.revenue,
                    r.netProfit,
                    r.eps,
                    r.totalAssets,
                    r.totalDebt,
                    r.shareholdersEquity,
                    r.operatingCashFlow,
                    r.sourceName,
                    r.sourceUrl,
                    "PENDING"
                ]
            );

            inserted++;
        }

        await connection.commit();

        console.log("\n========== IMPORT RESULT ==========");
        console.log("Inserted:", inserted);
        console.log("Updated: 0");
        console.log("Deleted: 0");
        console.log("Verification status: PENDING");
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
        await pool.end();
    }
}

main().catch(async error => {
    console.error("\nIMPORT ERROR:", error.message);
    await pool.end();
    process.exitCode = 1;
});

