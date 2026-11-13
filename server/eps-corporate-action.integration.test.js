const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

let mockActionStatus = "VERIFIED";
let corporateActionQuery = "";

const mockPool = {
    async execute(sql) {
        if (sql.includes("FROM company_fundamentals")) {
            return [[
                {
                    symbol: "HDFCBANK",
                    periodType: "ANNUAL",
                    periodEndDate: "2026-03-31",
                    reportingBasis: "CONSOLIDATED",
                    currency: "INR",
                    amountUnit: "CRORE",
                    revenue: "1000",
                    netProfit: "200",
                    eps: "100",
                    totalAssets: "5000",
                    totalDebt: "1000",
                    shareholdersEquity: "3000",
                    operatingCashFlow: "250",
                    verificationStatus: "VERIFIED"
                },
                {
                    symbol: "HDFCBANK",
                    periodType: "ANNUAL",
                    periodEndDate: "2025-03-31",
                    reportingBasis: "CONSOLIDATED",
                    currency: "INR",
                    amountUnit: "CRORE",
                    revenue: "900",
                    netProfit: "180",
                    eps: "92.8100",
                    totalAssets: "4500",
                    totalDebt: "900",
                    shareholdersEquity: "2700",
                    operatingCashFlow: "220",
                    verificationStatus: "VERIFIED"
                }
            ], []];
        }

        if (sql.includes("FROM company_corporate_actions")) {
            corporateActionQuery = sql;

            const verifiedOnly =
                /verification_status\s*=\s*'VERIFIED'/i.test(sql);

            if (!verifiedOnly || mockActionStatus !== "VERIFIED") {
                return [[], []];
            }

            return [[{
                id: 999,
                symbol: "HDFCBANK",
                actionType: "BONUS",
                ratioNumerator: 1,
                ratioDenominator: 1,
                effectiveDate: "2025-08-26",
                verificationStatus: "VERIFIED",
                sourceName: "Mock test action",
                sourceUrl: "https://example.com/test"
            }], []];
        }

        throw new Error("Unexpected SQL query in test: " + sql);
    }
};

const dbPath = require.resolve("./db");

require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: mockPool
};

const router = require("./fundamentals");

const routeLayer = router.stack.find(
    layer => layer.route && layer.route.path === "/:symbol"
);

assert.ok(routeLayer, "Production fundamentals route must exist");

const handler = routeLayer.route.stack.find(
    layer => layer.method === "get"
).handle;

async function callProductionRoute(status) {
    mockActionStatus = status;
    corporateActionQuery = "";

    let response;

    const req = {
        params: { symbol: "HDFCBANK" }
    };

    const res = {
        json(data) {
            response = data;
            return this;
        },
        status(code) {
            this.statusCode = code;
            return this;
        }
    };

    await handler(req, res);

    assert.ok(response, "Production route must return JSON");

    return response;
}

test("Production route adjusts EPS for VERIFIED bonus", async () => {
    const response = await callProductionRoute("VERIFIED");
    const adjustment = response.yearOverYear.epsAdjustment;

    assert.equal(response.yearOverYear.status,
        "CALCULATED_FROM_VERIFIED_RECORDS");
    assert.equal(adjustment.status,
        "ADJUSTED_FOR_VERIFIED_CORPORATE_ACTIONS");
    assert.equal(adjustment.adjustmentFactor, 2);
    assert.equal(adjustment.adjustedPreviousEPS, 46.405);
    assert.match(corporateActionQuery,
        /verification_status\s*=\s*'VERIFIED'/i);
});

test("Production route excludes PENDING bonus", async () => {
    const response = await callProductionRoute("PENDING");
    const adjustment = response.yearOverYear.epsAdjustment;

    assert.equal(adjustment.status,
        "NO_VERIFIED_CORPORATE_ACTIONS");
    assert.equal(adjustment.adjustmentFactor, 1);
    assert.equal(Number(adjustment.adjustedPreviousEPS), 92.81);
});

test("Production route excludes REJECTED bonus", async () => {
    const response = await callProductionRoute("REJECTED");
    const adjustment = response.yearOverYear.epsAdjustment;

    assert.equal(adjustment.status,
        "NO_VERIFIED_CORPORATE_ACTIONS");
    assert.equal(adjustment.adjustmentFactor, 1);
    assert.equal(Number(adjustment.adjustedPreviousEPS), 92.81);
});

test("Production route leaves EPS unchanged without corporate actions", async () => {
    const response = await callProductionRoute("NONE");
    const adjustment = response.yearOverYear.epsAdjustment;

    assert.equal(adjustment.adjustmentFactor, 1);
    assert.equal(Number(adjustment.adjustedPreviousEPS), 92.81);
});

