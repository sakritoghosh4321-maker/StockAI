const fs = require("fs");
const vm = require("vm");
const path = require("path");

const source = fs.readFileSync(
    path.join(__dirname, "bulk-fundamentals-preview-2025-03-31.js"),
    "utf8"
);

const end = source.indexOf("async function getNseFilings()");

if (end < 0) throw new Error("Could not locate extraction function.");

const testSource =
    source.slice(0, end) +
    "\nmodule.exports = extractFinancials;";

const sandbox = {
    require,
    module: { exports: {} },
    console
};

vm.runInNewContext(testSource, sandbox);

const extractFinancials = sandbox.module.exports;

for (const symbol of ["SBIN", "HDFCBANK"]) {
    const file = `./${symbol}_FY2025_NSE_filing.xml`;
    const xml = fs.readFileSync(file, "utf8");
    const result = extractFinancials(xml);

    console.log(`\n========== ${symbol} ==========`);

    console.log(JSON.stringify(result, null, 2));
}
