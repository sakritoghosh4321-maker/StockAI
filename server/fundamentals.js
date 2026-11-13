const express = require("express");
const pool = require("./db");

const router = express.Router();

const METRICS = [
    ["revenue", "Revenue"],
    ["netProfit", "Net Profit"],
    ["eps", "EPS"],
    ["totalAssets", "Total Assets"],
    ["totalDebt", "Total Debt"],
    ["shareholdersEquity", "Shareholders' Equity"],
    ["operatingCashFlow", "Operating Cash Flow"]
];

function isPreviousFinancialYear(current, previous) {
    if (!current || !previous) return false;

    const currentYear = Number(current.slice(0, 4));
    const previousYear = Number(previous.slice(0, 4));

    return (
        currentYear - previousYear === 1 &&
        current.slice(5) === previous.slice(5)
    );
}

function calculateGrowth(currentValue, previousValue) {
    if (
        currentValue === null ||
        currentValue === undefined ||
        previousValue === null ||
        previousValue === undefined
    ) {
        return {
            growthPercentage: null,
            reason: "FINANCIAL_VALUE_UNAVAILABLE"
        };
    }

    const current = Number(currentValue);
    const previous = Number(previousValue);

    if (!Number.isFinite(current) || !Number.isFinite(previous)) {
        return {
            growthPercentage: null,
            reason: "INVALID_FINANCIAL_VALUE"
        };
    }

    if (previous <= 0) {
        return {
            growthPercentage: null,
            reason: "PREVIOUS_VALUE_NOT_POSITIVE"
        };
    }

    return {
        growthPercentage: Number(
            (((current - previous) / previous) * 100).toFixed(2)
        ),
        reason: null
    };
}

function getCorporateActionMultiplier(action) {
    const numerator = Number(action.ratioNumerator);
    const denominator = Number(action.ratioDenominator);

    if (
        !Number.isFinite(numerator) ||
        !Number.isFinite(denominator) ||
        numerator <= 0 ||
        denominator <= 0
    ) {
        return null;
    }

    if (action.actionType === "BONUS") {
        return (denominator + numerator) / denominator;
    }

    if (action.actionType === "STOCK_SPLIT") {
        return numerator / denominator;
    }

    return null;
}

async function calculateEpsAdjustment(
    symbol,
    previousPeriodEnd,
    currentPeriodEnd,
    previousEps
) {
    const result = {
        status: "NO_VERIFIED_CORPORATE_ACTIONS",
        adjustmentFactor: 1,
        reportedPreviousEPS: previousEps,
        adjustedPreviousEPS: previousEps,
        actions: []
    };

    const [actions] = await pool.execute(
        `SELECT
            id,
            symbol,
            action_type AS actionType,
            ratio_numerator AS ratioNumerator,
            ratio_denominator AS ratioDenominator,
            DATE_FORMAT(effective_date, '%Y-%m-%d') AS effectiveDate,
            verification_status AS verificationStatus,
            source_name AS sourceName,
            source_url AS sourceUrl
         FROM company_corporate_actions
         WHERE symbol = ?
           AND verification_status = 'VERIFIED'
           AND effective_date > ?
           AND effective_date <= ?
         ORDER BY effective_date ASC, id ASC`,
        [symbol, previousPeriodEnd, currentPeriodEnd]
    );

    let adjustmentFactor = 1;
    const appliedActions = [];

    for (const action of actions) {
        const multiplier = getCorporateActionMultiplier(action);

        if (multiplier === null || multiplier <= 0) {
            continue;
        }

        adjustmentFactor *= multiplier;

        appliedActions.push({
            id: action.id,
            actionType: action.actionType,
            ratioNumerator: Number(action.ratioNumerator),
            ratioDenominator: Number(action.ratioDenominator),
            effectiveDate: action.effectiveDate,
            verificationStatus: action.verificationStatus,
            multiplier,
            sourceName: action.sourceName,
            sourceUrl: action.sourceUrl
        });
    }

    if (appliedActions.length === 0) {
        return result;
    }

    const numericPreviousEps =
        previousEps === null || previousEps === undefined
            ? null
            : Number(previousEps);

    const adjustedPreviousEPS =
        numericPreviousEps !== null &&
        Number.isFinite(numericPreviousEps)
            ? Number((numericPreviousEps / adjustmentFactor).toFixed(4))
            : previousEps;

    return {
        status: "ADJUSTED_FOR_VERIFIED_CORPORATE_ACTIONS",
        adjustmentFactor: Number(adjustmentFactor.toFixed(6)),
        reportedPreviousEPS: previousEps,
        adjustedPreviousEPS,
        actions: appliedActions
    };
}

router.get("/:symbol", async (req, res) => {
    try {
        const symbol = String(req.params.symbol || "")
            .trim()
            .toUpperCase();

        if (!/^[A-Z0-9.-]{1,30}$/.test(symbol)) {
            return res.status(400).json({
                status: "error",
                message: "Invalid company symbol."
            });
        }

        const [rows] = await pool.execute(
            `SELECT
                symbol,
                period_type AS periodType,
                period_end AS periodEnd,
                DATE_FORMAT(period_end, '%Y-%m-%d') AS periodEndDate,
                reporting_basis AS reportingBasis,
                currency,
                amount_unit AS amountUnit,
                revenue,
                net_profit AS netProfit,
                eps,
                total_assets AS totalAssets,
                total_debt AS totalDebt,
                shareholders_equity AS shareholdersEquity,
                operating_cash_flow AS operatingCashFlow,
                source_name AS sourceName,
                source_url AS sourceUrl,
                verification_status AS verificationStatus
             FROM company_fundamentals
             WHERE symbol = ?
               AND verification_status IN ('VERIFIED', 'PENDING')
             ORDER BY period_end DESC
             LIMIT 12`,
            [symbol]
        );

        const verifiedCount = rows.filter(
            r => r.verificationStatus === "VERIFIED"
        ).length;

        const pendingCount = rows.filter(
            r => r.verificationStatus === "PENDING"
        ).length;

        let dataStatus = "NO FUNDAMENTALS AVAILABLE";

        if (verifiedCount && pendingCount) {
            dataStatus = "VERIFIED AND PENDING FUNDAMENTALS AVAILABLE";
        } else if (verifiedCount) {
            dataStatus = "VERIFIED STORED FUNDAMENTALS";
        } else if (pendingCount) {
            dataStatus = "PENDING FUNDAMENTALS - NOT YET VERIFIED";
        }

        const current = rows.find(
            r =>
                r.verificationStatus === "VERIFIED" &&
                r.periodType === "ANNUAL"
        );

        let yearOverYear = {
            status: "CURRENT_VERIFIED_ANNUAL_RECORD_UNAVAILABLE",
            metrics: {}
        };

        if (current) {
            const matches = rows.filter(r =>
                r.periodType === "ANNUAL" &&
                r.reportingBasis === current.reportingBasis &&
                r.currency === current.currency &&
                r.amountUnit === current.amountUnit &&
                isPreviousFinancialYear(
                    current.periodEndDate,
                    r.periodEndDate
                )
            );

            const previousVerified = matches.find(
                r => r.verificationStatus === "VERIFIED"
            );

            const previousPending = matches.find(
                r => r.verificationStatus === "PENDING"
            );

            if (previousVerified) {
                const metrics = {};

                for (const [field] of METRICS) {
                    metrics[field] = calculateGrowth(
                        current[field],
                        previousVerified[field]
                    );
                }

                const epsAdjustment = await calculateEpsAdjustment(
                    symbol,
                    previousVerified.periodEndDate,
                    current.periodEndDate,
                    previousVerified.eps
                );

                metrics.eps = calculateGrowth(
                    current.eps,
                    epsAdjustment.adjustedPreviousEPS
                );

                yearOverYear = {
                    status: "CALCULATED_FROM_VERIFIED_RECORDS",
                    currentPeriodEnd: current.periodEndDate,
                    previousPeriodEnd: previousVerified.periodEndDate,
                    previousVerificationStatus: "VERIFIED",
                    epsAdjustment,
                    metrics
                };
            } else if (previousPending) {
                yearOverYear = {
                    status: "PREVIOUS_YEAR_PENDING_VERIFICATION",
                    currentPeriodEnd: current.periodEndDate,
                    previousPeriodEnd: previousPending.periodEndDate,
                    previousVerificationStatus: "PENDING",
                    message: "YoY growth will be calculated after previous-year financial statements are verified.",
                    metrics: {}
                };
            } else {
                yearOverYear = {
                    status: "PREVIOUS_YEAR_VERIFIED_RECORD_UNAVAILABLE",
                    currentPeriodEnd: current.periodEndDate,
                    metrics: {}
                };
            }
        }

        res.json({
            status: "success",
            dataStatus,
            source: "StockAI MySQL fundamentals records",
            symbol,
            count: rows.length,
            verifiedCount,
            pendingCount,
            fundamentals: rows,
            yearOverYear
        });

    } catch (error) {
        console.error("Fundamentals API Error:", error.message);

        res.status(500).json({
            status: "error",
            message: "Unable to retrieve company fundamentals."
        });
    }
});

module.exports = router;
