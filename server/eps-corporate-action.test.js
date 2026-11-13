const test = require("node:test");
const assert = require("node:assert/strict");

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

function calculateEpsAdjustment(previousEps, actions) {
    const verifiedActions = actions.filter(
        action => action.verificationStatus === "VERIFIED"
    );

    let factor = 1;

    for (const action of verifiedActions) {
        const multiplier = getCorporateActionMultiplier(action);

        if (multiplier !== null && multiplier > 0) {
            factor *= multiplier;
        }
    }

    return {
        adjustmentFactor: factor,
        adjustedPreviousEPS: Number((previousEps / factor).toFixed(4))
    };
}

test("VERIFIED 1:1 bonus adjusts previous EPS", () => {
    const result = calculateEpsAdjustment(92.81, [{
        actionType: "BONUS",
        ratioNumerator: 1,
        ratioDenominator: 1,
        verificationStatus: "VERIFIED"
    }]);

    assert.equal(result.adjustmentFactor, 2);
    assert.equal(result.adjustedPreviousEPS, 46.405);
});

test("PENDING bonus does not adjust previous EPS", () => {
    const result = calculateEpsAdjustment(92.81, [{
        actionType: "BONUS",
        ratioNumerator: 1,
        ratioDenominator: 1,
        verificationStatus: "PENDING"
    }]);

    assert.equal(result.adjustmentFactor, 1);
    assert.equal(result.adjustedPreviousEPS, 92.81);
});

test("REJECTED bonus does not adjust previous EPS", () => {
    const result = calculateEpsAdjustment(92.81, [{
        actionType: "BONUS",
        ratioNumerator: 1,
        ratioDenominator: 1,
        verificationStatus: "REJECTED"
    }]);

    assert.equal(result.adjustmentFactor, 1);
    assert.equal(result.adjustedPreviousEPS, 92.81);
});

test("No corporate actions leaves previous EPS unchanged", () => {
    const result = calculateEpsAdjustment(92.81, []);

    assert.equal(result.adjustmentFactor, 1);
    assert.equal(result.adjustedPreviousEPS, 92.81);
});
