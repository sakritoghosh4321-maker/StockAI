const pool = require("./db");
const { XMLParser } = require("fast-xml-parser");
const fs = require("fs");
const path = require("path");

const PERIOD_START = "2025-04-01";
const PERIOD_END = "2026-03-31";
const PERIOD_API = "31-Mar-2026";
const CONCURRENCY = 4;

const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseTagValue: false
});

function normalize(value) {
    return String(value || "")
        .toUpperCase()
        .replace(/\b(THE|LIMITED|LTD|PRIVATE|PVT|COMPANY|CO)\b/g, "")
        .replace(/[^A-Z0-9]/g, "");
}

function parseDate(value) {
    if (!value) return 0;
    const match = String(value).match(
        /^(\d{1,2})-([A-Za-z]{3})-(\d{4})\s*(.*)$/
    );
    if (!match) return Date.parse(value) || 0;

    const months = {
        JAN: 0, FEB: 1, MAR: 2, APR: 3,
        MAY: 4, JUN: 5, JUL: 6, AUG: 7,
        SEP: 8, OCT: 9, NOV: 10, DEC: 11
    };

    const time = match[4] || "00:00:00";
    return new Date(
        Number(match[3]),
        months[match[2].toUpperCase()],
        Number(match[1]),
        ...time.split(":").map(Number)
    ).getTime();
}

function asArray(value) {
    if (value === undefined || value === null) return [];
    return Array.isArray(value) ? value : [value];
}

function getText(value) {
    if (value === undefined || value === null) return null;
    if (typeof value === "object") return value["#text"] ?? null;
    return value;
}

function getFact(root, names, contextId) {
    for (const name of names) {
        const key = Object.keys(root).find(
            item => item.split(":").pop() === name
        );

        if (!key) continue;

        for (const fact of asArray(root[key])) {
            if (
                typeof fact === "object" &&
                fact["@_contextRef"] === contextId
            ) {
                const value = Number(getText(fact));
                if (Number.isFinite(value)) return value;
            }
        }
    }
    return null;
}

function getIdentityFact(root, name) {
    const key = Object.keys(root).find(
        item => item.split(":").pop() === name
    );
    if (!key) return null;

    const facts = asArray(root[key]);
    const fact = facts.find(item => item && typeof item === "object");
    return fact ? String(getText(fact) || "").trim() : null;
}

function findContext(root, type) {
    const contexts = asArray(root["xbrli:context"]);

    return contexts.find(context => {
        if (context["xbrli:scenario"]) return false;

        const period = context["xbrli:period"] || {};

        if (type === "DURATION") {
            return (
                period["xbrli:startDate"] === PERIOD_START &&
                period["xbrli:endDate"] === PERIOD_END
            );
        }

        return period["xbrli:instant"] === PERIOD_END;
    });
}

function toCrore(value) {
    return value === null ? null : Number((value / 10000000).toFixed(2));
}

function extractFinancials(xml) {
    const parsed = parser.parse(xml);
    const root = parsed["xbrli:xbrl"];

    if (!root) throw new Error("XBRL root element missing");

    const symbol = getIdentityFact(root, "Symbol");
    const isin = getIdentityFact(root, "ISIN");
    const company = getIdentityFact(root, "NameOfTheCompany");

    const duration = findContext(root, "DURATION");
    const instant = findContext(root, "INSTANT");

    if (!duration || !instant) {
        throw new Error("Annual duration or year-end context missing");
    }

    const d = duration["@_id"];
    const i = instant["@_id"];

    const revenue = getFact(root, [
        "RevenueFromOperations",
        "RevenueFromOperationsContinuingOperations"
    ], d);

    const otherIncome = getFact(root, [
        "OtherIncome"
    ], d);

    const totalIncome = getFact(root, [
        "Income",
        "TotalIncome"
    ], d);

    const profitBeforeExceptionalItems = getFact(root, [
        "ProfitBeforeExceptionalItemsAndTax"
    ], d);

    const exceptionalItems = getFact(root, [
        "ExceptionalItemsBeforeTax"
    ], d);

    const profitBeforeTax = getFact(root, [
        "ProfitBeforeTax"
    ], d);

    const continuingOperationsProfit = getFact(root, [
        "ProfitLossForPeriodFromContinuingOperations"
    ], d);

    const discontinuedOperationsProfit = getFact(root, [
        "ProfitLossFromDiscontinuedOperationsAfterTax"
    ], d);

    const shareOfProfitLossAssociatesAndJointVentures = getFact(root, [
        "ShareOfProfitLossOfAssociatesAndJointVenturesAccountedForUsingEquityMethod"
    ], d);

    const netProfit = getFact(root, [
        "ProfitLossForPeriod",
        "ProfitOrLossAttributableToOwnersOfParent",
        "ProfitAfterTax",
        "ProfitLossAfterTax",
        "ProfitForTheYear"
    ], d);

    const eps = getFact(root, [
        "BasicEarningsLossPerShareFromContinuingAndDiscontinuedOperations",
        "BasicEarningsLossPerShareFromContinuingOperations",
        "BasicEarningsPerShare"
    ], d);

    const assets = getFact(root, ["Assets", "TotalAssets"], i);

    const equity = getFact(root, [
        "Equity",
        "EquityAttributableToOwnersOfParent",
        "TotalEquity"
    ], i);

    const currentDebt = getFact(root, [
    "BorrowingsCurrent",
    "ShortTermBorrowings"
], i);

const noncurrentDebt = getFact(root, [
    "BorrowingsNoncurrent",
    "LongTermBorrowings"
], i);

const singleBorrowings = getFact(root, [
    "Borrowings"
], i);

const debt =
    currentDebt !== null || noncurrentDebt !== null
        ? (currentDebt || 0) + (noncurrentDebt || 0)
        : singleBorrowings;

    const operatingCashFlow = getFact(root, [
        "CashFlowsFromUsedInOperatingActivities",
        "NetCashFlowsFromUsedInOperatingActivities",
        "CashFlowFromOperatingActivities"
    ], d);

    return {
        symbol,
        isin,
        company,
        financialYearStart: PERIOD_START,
        financialYearEnd: PERIOD_END,
        revenue: toCrore(revenue),
        otherIncome: toCrore(otherIncome),
        totalIncome: toCrore(totalIncome),
        profitBeforeExceptionalItems: toCrore(profitBeforeExceptionalItems),
        exceptionalItems: toCrore(exceptionalItems),
        profitBeforeTax: toCrore(profitBeforeTax),
        continuingOperationsProfit: toCrore(continuingOperationsProfit),
        discontinuedOperationsProfit: toCrore(discontinuedOperationsProfit),
        shareOfProfitLossAssociatesAndJointVentures: toCrore(shareOfProfitLossAssociatesAndJointVentures),
        netProfit: toCrore(netProfit),
        eps: eps === null ? null : Number(eps.toFixed(4)),
        totalAssets: toCrore(assets),
        totalDebt: toCrore(debt),
        shareholdersEquity: toCrore(equity),
        operatingCashFlow: toCrore(operatingCashFlow)
    };
}
async function getNseFilings() {
    const headers = {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json, text/plain, */*",
        "Referer": "https://www.nseindia.com/companies-listing/corporate-integrated-filing",
        "X-Requested-With": "XMLHttpRequest"
    };

    const page = await fetch(
        "https://www.nseindia.com/companies-listing/corporate-integrated-filing",
        { headers }
    );

    if (!page.ok) {
        throw new Error(`NSE session request failed: ${page.status}`);
    }

    const cookies = page.headers.getSetCookie()
        .map(cookie => cookie.split(";")[0])
        .join("; ");

    if (cookies) headers.Cookie = cookies;

    const all = [];
    let totalCount = Infinity;

    for (let pageNumber = 1; all.length < totalCount; pageNumber++) {
        const params = new URLSearchParams({
            index: "equities",
            type: "Integrated Filing- Financials",
            period_ended: PERIOD_API,
            page: String(pageNumber),
            size: "1000"
        });

        const response = await fetch(
            "https://www.nseindia.com/api/integrated-filing-results?" +
            params.toString(),
            { headers }
        );

        if (!response.ok) {
            throw new Error(`NSE filings API failed: ${response.status}`);
        }

        const result = await response.json();
        totalCount = Number(result.totalCount || 0);

        all.push(...(result.data || []));

        console.log(
            `Downloaded NSE page ${pageNumber}: ${all.length}/${totalCount}`
        );

        if (!(result.data || []).length) break;
    }

    return all.filter(row =>
        String(row.qe_Date).toUpperCase() === "31-MAR-2026" &&
        String(row.audited).toUpperCase() === "AUDITED" &&
        String(row.consolidated).toUpperCase() === "CONSOLIDATED" &&
        row.xbrl &&
        !String(row.xbrl).endsWith("/null")
    );
}

async function downloadXml(url) {
    let lastError;

    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const response = await fetch(url, {
                headers: {
                    "User-Agent": "Mozilla/5.0",
                    "Accept": "*/*",
                    "Referer": "https://www.nseindia.com/"
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            return await response.text();
        } catch (error) {
            lastError = error;
            await new Promise(resolve =>
                setTimeout(resolve, attempt * 1000)
            );
        }
    }

    throw lastError;
}

async function runWithLimit(items, limit, worker) {
    let next = 0;
    const results = new Array(items.length);

    async function runWorker() {
        while (true) {
            const index = next++;
            if (index >= items.length) return;

            try {
                results[index] = await worker(items[index], index);
            } catch (error) {
                results[index] = {
                    status: "DOWNLOAD_OR_PARSE_ERROR",
                    error: error.message,
                    symbol: items[index].symbol,
                    sourceUrl: items[index].xbrl
                };
            }

            if ((index + 1) % 25 === 0) {
                console.log(
                    `Processed ${index + 1}/${items.length} filings`
                );
            }
        }
    }

    await Promise.all(
        Array.from({ length: limit }, () => runWorker())
    );

    return results;
}

async function main() {
    console.log("\n--- STOCKAI BULK FUNDAMENTALS PREVIEW ---");
    console.log("Financial year:", PERIOD_START, "to", PERIOD_END);
    console.log("Mode: PREVIEW ONLY - NO DATABASE WRITES\n");

    const [listings] = await pool.query(`
        SELECT symbol, company_name, exchange, isin
        FROM exchange_directory
        WHERE listing_status = 'ACTIVE'
          AND isin IS NOT NULL
          AND isin <> ''
    `);

    const existingRows = await pool.query(`
        SELECT symbol
        FROM company_fundamentals
        WHERE period_type = 'ANNUAL'
          AND reporting_basis = 'CONSOLIDATED'
          AND period_end = ?
    `, [PERIOD_END]);

    const existing = new Set(
        existingRows[0].map(row => String(row.symbol).toUpperCase())
    );

    const byIsin = new Map();

    for (const listing of listings) {
        const isin = String(listing.isin).trim().toUpperCase();

        if (!byIsin.has(isin)) byIsin.set(isin, []);
        byIsin.get(isin).push(listing);
    }

    console.log("Active listings loaded:", listings.length);
    console.log("Unique listing ISINs:", byIsin.size);
    console.log("Existing annual records:", existing.size);

    const filings = await getNseFilings();

    console.log("\nEligible NSE filings:", filings.length);

    // Latest audited consolidated filing per NSE symbol.
    const latestBySymbol = new Map();

    for (const filing of filings) {
        const symbol = String(filing.symbol || "").trim().toUpperCase();
        if (!symbol) continue;

        const previous = latestBySymbol.get(symbol);

        if (
            !previous ||
            parseDate(filing.creation_Date) >
                parseDate(previous.creation_Date)
        ) {
            latestBySymbol.set(symbol, filing);
        }
    }

    const selected = [...latestBySymbol.values()];

    // Manually verified NSE XBRL fallback.
    // Add only when the NSE API selection omits this symbol.
    if (!latestBySymbol.has("LLOYDSENT")) {
        selected.push({
            symbol: "LLOYDSENT",
            xbrl: "https://nsearchives.nseindia.com/corporate/xbrl/INTEGRATED_FILING_INDAS_1664952_08052026055512_WEB.xml",
            creation_Date: "08-May-2026 05:55:12",
            type_Sub: "MANUALLY VERIFIED NSE XBRL FALLBACK"
        });

        console.log("Added verified fallback filing: LLOYDSENT");
    }

    console.log("Unique filing symbols:", selected.length);
    console.log("\nDownloading and validating XBRL files...");

    const results = await runWithLimit(
        selected,
        CONCURRENCY,
        async filing => {
            const xml = await downloadXml(filing.xbrl);
            const data = extractFinancials(xml);

            if (!data.symbol || !data.isin || !data.company) {
                return {
                    status: "IDENTITY_MISSING",
                    symbol: filing.symbol,
                    sourceUrl: filing.xbrl
                };
            }

            const filingSymbol = String(filing.symbol).toUpperCase();

            if (data.symbol.toUpperCase() !== filingSymbol) {
                return {
                    status: "SYMBOL_MISMATCH",
                    symbol: filingSymbol,
                    xmlSymbol: data.symbol,
                    isin: data.isin,
                    sourceUrl: filing.xbrl
                };
            }

            const matches = byIsin.get(data.isin.toUpperCase()) || [];

            if (!matches.length) {
                return {
                    status: "ISIN_NOT_IN_LISTINGS",
                    symbol: data.symbol,
                    isin: data.isin,
                    company: data.company,
                    sourceUrl: filing.xbrl
                };
            }

            const symbolMatches = matches.filter(
                item => String(item.symbol).toUpperCase() ===
                    data.symbol.toUpperCase()
            );

            if (!symbolMatches.length) {
                return {
                    status: "ISIN_SYMBOL_MISMATCH",
                    symbol: data.symbol,
                    isin: data.isin,
                    company: data.company,
                    listingSymbols: [
                        ...new Set(matches.map(item => item.symbol))
                    ],
                    sourceUrl: filing.xbrl
                };
            }

            const nameMatches = symbolMatches.filter(
                item => normalize(item.company_name) ===
                    normalize(data.company)
            );

            const nameMatchWarning = nameMatches.length === 0
                ? "ISIN and symbol match, but company names differ"
                : null;

            const missingFields = [
                "revenue",
                "netProfit",
                "eps",
                "totalAssets",
                "shareholdersEquity"
            ].filter(key => data[key] === null);

            const record = {
                ...data,
                periodType: "ANNUAL",
                reportingBasis: "CONSOLIDATED",
                periodEnd: PERIOD_END,
                currency: "INR",
                amountUnit: "INR_CRORE",
                sourceName: "NSE Audited Consolidated XBRL FY 2025-26",
                sourceUrl: filing.xbrl,
                filingType: filing.type_Sub,
                filingCreated: filing.creation_Date,
                nameMatchWarning,
                matchedExchanges: [
                    ...new Set(symbolMatches.map(item => item.exchange))
                ],
                verificationStatus: "PENDING"
            };

            if (existing.has(data.symbol.toUpperCase())) {
                return {
                    status: "EXISTING_RECORD_SKIPPED",
                    record
                };
            }

            if (missingFields.length) {
                return {
                    status: "INCOMPLETE_FINANCIAL_DATA",
                    symbol: data.symbol,
                    isin: data.isin,
                    missingFields,
                    record
                };
            }

            return {
                status: "READY_FOR_REVIEW",
                record
            };
        }
    );

    const counts = {};

    for (const result of results) {
        counts[result.status] = (counts[result.status] || 0) + 1;
    }

    const ready = results
        .filter(item => item.status === "READY_FOR_REVIEW")
        .map(item => item.record);

    const report = {
        generatedAt: new Date().toISOString(),
        mode: "PREVIEW_ONLY",
        financialYear: `${PERIOD_START} to ${PERIOD_END}`,
        eligibleFilingCount: filings.length,
        uniqueSymbols: selected.length,
        listingCount: listings.length,
        existingRecords: existing.size,
        statusCounts: counts,
        readyForReview: ready,
        allResults: results
    };

    const outputPath = path.join(
        __dirname,
        "bulk-fundamentals-preview-2026-03-31.json"
    );

    fs.writeFileSync(
        outputPath,
        JSON.stringify(report, null, 2),
        "utf8"
    );

    console.log("\n--- PREVIEW SUMMARY ---");
    console.table(
        Object.entries(counts).map(([status, count]) => ({
            status,
            count
        }))
    );

    console.log("\nReady for review:", ready.length);
    console.log("Existing records protected:", existing.size);
    console.log("\nPreview saved to:");
    console.log(outputPath);
    console.log("\nNO DATABASE RECORDS WERE INSERTED OR UPDATED.");
}

main()
    .catch(error => {
        console.error("\nBULK PREVIEW FAILED:", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
    });

