const fs = require("fs");
const pool = require("./db");

const REVIEW_FILE =
    "./bulk-fundamentals-import-review-2025-03-31.json";

const APPROVAL_FILE =
    "./bulk-fundamentals-approved-symbols-2025-03-31.json";

const APPLY = process.argv.includes("--apply");

function readJsonFile(path) {
    return JSON.parse(
        fs.readFileSync(path, "utf8").replace(/^\uFEFF/, "")
    );
}

async function main() {
    const review = readJsonFile(REVIEW_FILE);
    const approval = readJsonFile(APPROVAL_FILE);

    if (
        review.periodEnd !== "2025-03-31" ||
        review.periodType !== "ANNUAL" ||
        review.reportingBasis !== "CONSOLIDATED" ||
        review.databaseWritePerformed !== false
    ) {
        throw new Error("Invalid FY2025 review report.");
    }

    if (
        approval.periodEnd !== review.periodEnd ||
        approval.periodType !== review.periodType ||
        approval.reportingBasis !== review.reportingBasis ||
        !Array.isArray(approval.approvedSymbols) ||
        approval.approvedSymbols.length !== 5
    ) {
        throw new Error("Invalid FY2025 approval file.");
    }

    const approvedSymbols = [
        ...new Set(
            approval.approvedSymbols.map(s =>
                String(s).trim().toUpperCase()
            )
        )
    ];

    if (approvedSymbols.length !== 5) {
        throw new Error("Expected exactly five unique approved symbols.");
    }

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
                `${symbol} has manual-review warnings. Import refused.`
            );
        }

        if (
            !r.sourceUrl ||
            !r.sourceUrl.startsWith(
                "https://nsearchives.nseindia.com/"
            ) ||
            r.periodEnd !== approval.periodEnd ||
            r.periodType !== approval.periodType ||
            r.reportingBasis !== approval.reportingBasis ||
            r.currency !== "INR" ||
            r.amountUnit !== "INR_CRORE" ||
            !r.isin ||
            !r.matchedExchanges?.length
        ) {
            throw new Error(
                `${symbol} failed source, period, or identity validation.`
            );
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
            throw new Error(
                `${symbol} has missing required financial values.`
            );
        }

        for (const field of [
            "totalDebt",
            "operatingCashFlow"
        ]) {
            if (
                r[field] !== null &&
                (typeof r[field] !== "number" ||
                 !Number.isFinite(r[field]))
            ) {
                throw new Error(
                    `${symbol} has invalid ${field}.`
                );
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
        [
            approval.periodType,
            approval.reportingBasis,
            approval.periodEnd
        ]
    );

    const existingSymbols = new Set(
        existing.map(r => String(r.symbol).toUpperCase())
    );

    const alreadyPresent = selected.filter(
        r => existingSymbols.has(String(r.symbol).toUpperCase())
    );

    const candidates = selected.filter(
        r => !existingSymbols.has(String(r.symbol).toUpperCase())
    );

    console.log("\n========== FY2025 APPROVED IMPORT ==========");
    console.log("Mode:", APPLY ? "APPLY" : "DRY RUN");
    console.log("Approved symbols:", approvedSymbols.join(", "));
    console.log("Selected records:", selected.length);
    console.log("Already present:", alreadyPresent.length);
    console.log("New import candidates:", candidates.length);

    console.table(candidates.map(r => ({
        symbol: r.symbol,
        revenue: r.revenue,
        netProfit: r.netProfit,
        eps: r.eps,
        assets: r.totalAssets,
        debt: r.totalDebt,
        equity: r.shareholdersEquity,
        operatingCashFlow: r.operatingCashFlow
    })));

    if (!APPLY) {
        console.log("\nDRY RUN ONLY.");
        console.log("No database records inserted, updated or deleted.");
        return;
    }

    if (alreadyPresent.length) {
        throw new Error(
            "Approved records already exist. Import refused."
        );
    }

    if (candidates.length !== approvedSymbols.length) {
        throw new Error(
            "Candidate count mismatch. Import refused."
        );
    }

    const connection = await pool.getConnection();

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
        }

        await connection.commit();

        console.log("\n========== IMPORT RESULT ==========");
        console.log("Inserted:", candidates.length);
        console.log("Updated: 0");
        console.log("Deleted: 0");
        console.log("Verification status: PENDING");
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

main()
    .catch(error => {
        console.error("\nIMPORT ERROR:", error.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
