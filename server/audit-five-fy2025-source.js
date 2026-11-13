const fs = require("fs");
const vm = require("vm");
const path = require("path");
const pool = require("./db");

const source = fs.readFileSync(
    path.join(__dirname, "bulk-fundamentals-preview-2025-03-31.js"),
    "utf8"
);

const end = source.indexOf("async function getNseFilings()");
if (end < 0) throw new Error("Extraction function not found.");

const sandbox = {
    require,
    module: { exports: {} },
    console
};

vm.runInNewContext(
    source.slice(0, end) + "\nmodule.exports = extractFinancials;",
    sandbox
);

const extractFinancials = sandbox.module.exports;

const symbols = ["SBIN", "HDFCBANK", "AARTIIND", "RELIANCE", "TCS"];

const fields = [
    ["revenue", "revenue"],
    ["netProfit", "net_profit"],
    ["eps", "eps"],
    ["totalAssets", "total_assets"],
    ["totalDebt", "total_debt"],
    ["shareholdersEquity", "shareholders_equity"],
    ["operatingCashFlow", "operating_cash_flow"]
];

async function main() {
    const [rows] = await pool.query(
        `SELECT * FROM company_fundamentals
         WHERE symbol IN (?)
         AND period_type = 'ANNUAL'
         AND period_end = '2025-03-31'
         AND reporting_basis = 'CONSOLIDATED'`,
        [symbols]
    );

    let allPassed = rows.length === 5;

    for (const symbol of symbols) {
        const xml = fs.readFileSync(
            path.join(__dirname, `${symbol}_FY2025_NSE_filing.xml`),
            "utf8"
        );

        const extracted = extractFinancials(xml);
        const db = rows.find(r => r.symbol === symbol);

        console.log(`\n========== ${symbol} ==========`);

        if (!db) {
            console.log("FAIL: Database record missing");
            allPassed = false;
            continue;
        }

        let passed = true;

        for (const [sourceField, dbField] of fields) {
            const expected = extracted[sourceField];
            const actual = db[dbField] === null ? null : Number(db[dbField]);

            const match =
                expected === null || expected === undefined
                    ? actual === null
                    : actual !== null &&
                      Math.abs(Number(expected) - actual) < 0.011;

            if (!match) passed = false;

            console.log(
                `${sourceField}: XML=${expected}, DB=${actual}, ${match ? "MATCH" : "MISMATCH"}`
            );
        }

        const identityMatch =
            extracted.symbol === symbol &&
            db.reporting_basis === "CONSOLIDATED" &&
            db.verification_status === "PENDING";

        console.log("Identity/basis/PENDING:", identityMatch ? "PASS" : "FAIL");

        if (!identityMatch) passed = false;

        console.log("RESULT:", passed ? "PASS" : "FAIL");

        if (!passed) allPassed = false;
    }

    console.log("\n========== FINAL AUDIT ==========");
    console.log("Database records:", rows.length);
    console.log("All five source comparisons:", allPassed ? "PASS" : "FAIL");
}

main()
    .catch(console.error)
    .finally(() => pool.end());
