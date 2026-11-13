const pool = require("./db");

async function main() {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const [rows] = await connection.execute(
            `SELECT id, symbol,
                    DATE_FORMAT(period_end, '%Y-%m-%d') AS periodEnd,
                    period_type, reporting_basis, currency, amount_unit,
                    revenue, net_profit, eps, total_assets, total_debt,
                    shareholders_equity, operating_cash_flow,
                    source_url, verification_status
             FROM company_fundamentals
             WHERE id = 1042
             FOR UPDATE`
        );

        if (rows.length !== 1) {
            throw new Error("Expected exactly one record with ID 1042.");
        }

        const r = rows[0];

        const expected = {
            symbol: "TMPV",
            periodEnd: "2026-03-31",
            period_type: "ANNUAL",
            reporting_basis: "CONSOLIDATED",
            currency: "INR",
            amount_unit: "INR_CRORE",
            revenue: 335582,
            net_profit: 82390,
            eps: -0.61,
            total_assets: 381922,
            total_debt: 69953,
            shareholders_equity: 118842,
            operating_cash_flow: 13041,
            source_url: "https://nsearchives.nseindia.com/corporate/xbrl/INTEGRATED_FILING_INDAS_1667179_14052026062810_WEB.xml",
            verification_status: "PENDING"
        };

        for (const [key, value] of Object.entries(expected)) {
            const actual = r[key];

            const matches =
                typeof value === "number"
                    ? Number(actual) === value
                    : String(actual) === value;

            if (!matches) {
                throw new Error(
                    `Safety check failed for ${key}: found ${actual}`
                );
            }
        }

        const [result] = await connection.execute(
            `UPDATE company_fundamentals
             SET verification_status = 'VERIFIED'
             WHERE id = 1042
               AND symbol = 'TMPV'
               AND verification_status = 'PENDING'`
        );

        if (result.affectedRows !== 1) {
            throw new Error("Update did not affect exactly one record.");
        }

        await connection.commit();

        console.log("SUCCESS: TMPV record 1042 is now VERIFIED.");
        console.log("Only verification_status was changed.");

    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
        await pool.end();
    }
}

main().catch(error => {
    console.error("UPDATE FAILED:", error.message);
    process.exitCode = 1;
});
