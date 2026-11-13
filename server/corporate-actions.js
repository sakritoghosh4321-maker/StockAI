const express = require("express");
const pool = require("./db");
const {
    authenticateToken,
    requireAdmin
} = require("./auth-middleware");

const router = express.Router();

const VALID_STATUSES = ["PENDING", "VERIFIED", "REJECTED"];
const MAX_BIGINT = 18446744073709551615n;

function validateSymbol(symbol) {
    return /^[A-Z0-9&._-]{1,30}$/.test(symbol);
}

function validateStatus(status) {
    return !status || VALID_STATUSES.includes(status);
}

async function getCorporateActions(req, res) {
    try {
        const symbol = req.params.symbol
            ? String(req.params.symbol).trim().toUpperCase()
            : null;

        const status = req.query.status
            ? String(req.query.status).trim().toUpperCase()
            : null;

        if (symbol && !validateSymbol(symbol)) {
            return res.status(400).json({
                success: false,
                message: "Invalid company symbol."
            });
        }

        if (!validateStatus(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid status. Use PENDING, VERIFIED, or REJECTED."
            });
        }

        let sql = `
            SELECT
                id,
                symbol,
                action_type AS actionType,
                ratio_numerator AS ratioNumerator,
                ratio_denominator AS ratioDenominator,
                announcement_date AS announcementDate,
                record_date AS recordDate,
                effective_date AS effectiveDate,
                source_name AS sourceName,
                source_url AS sourceUrl,
                verification_status AS verificationStatus,
                created_at AS createdAt,
                updated_at AS updatedAt
            FROM company_corporate_actions
            WHERE 1 = 1
        `;

        const params = [];

        if (symbol) {
            sql += " AND symbol = ?";
            params.push(symbol);
        }

        if (status) {
            sql += " AND verification_status = ?";
            params.push(status);
        }

        sql += " ORDER BY effective_date DESC, id DESC";

        const [rows] = await pool.execute(sql, params);

        return res.json({
            success: true,
            count: rows.length,
            filters: { symbol, status },
            actions: rows
        });
    } catch (error) {
        console.error("Corporate actions API error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve corporate actions."
        });
    }
}

async function reviewCorporateAction(req, res) {
    const rawId = String(req.params.id || "");

    if (!/^[1-9]\d{0,19}$/.test(rawId)) {
        return res.status(400).json({
            success: false,
            message: "Invalid corporate action ID."
        });
    }

    if (BigInt(rawId) > MAX_BIGINT) {
        return res.status(400).json({
            success: false,
            message: "Corporate action ID is out of range."
        });
    }

    const status = typeof req.body?.status === "string"
        ? req.body.status.trim().toUpperCase()
        : "";

    const reviewNote = typeof req.body?.reviewNote === "string"
        ? req.body.reviewNote.trim()
        : "";

    if (!["VERIFIED", "REJECTED"].includes(status)) {
        return res.status(400).json({
            success: false,
            message: "Status must be VERIFIED or REJECTED."
        });
    }

    if (reviewNote.length < 10 || reviewNote.length > 1000) {
        return res.status(400).json({
            success: false,
            message: "Review note must contain between 10 and 1000 characters."
        });
    }

    if (!req.user?.id || !/^[1-9]\d{0,19}$/.test(String(req.user.id))) {
        return res.status(401).json({
            success: false,
            message: "A valid administrator identity is required."
        });
    }

    let connection;
    let transactionStarted = false;

    try {
        connection = await pool.getConnection();

        await connection.beginTransaction();
        transactionStarted = true;

        const [actions] = await connection.execute(
            `SELECT id, symbol, verification_status
             FROM company_corporate_actions
             WHERE id = ?
             LIMIT 1
             FOR UPDATE`,
            [rawId]
        );

        if (actions.length === 0) {
            await connection.rollback();
            transactionStarted = false;

            return res.status(404).json({
                success: false,
                message: "Corporate action not found."
            });
        }

        const action = actions[0];

        if (action.verification_status !== "PENDING") {
            await connection.rollback();
            transactionStarted = false;

            return res.status(409).json({
                success: false,
                message: "This corporate action has already been reviewed.",
                currentStatus: action.verification_status
            });
        }

        const [auditResult] = await connection.execute(
            `INSERT INTO corporate_action_verification_audit
                (
                    corporate_action_id,
                    admin_user_id,
                    previous_status,
                    new_status,
                    review_note
                )
             VALUES (?, ?, ?, ?, ?)`,
            [
                rawId,
                String(req.user.id),
                action.verification_status,
                status,
                reviewNote
            ]
        );

        const [updateResult] = await connection.execute(
            `UPDATE company_corporate_actions
             SET verification_status = ?
             WHERE id = ?
               AND verification_status = 'PENDING'`,
            [status, rawId]
        );

        if (updateResult.affectedRows !== 1) {
            throw new Error("Corporate action status update failed.");
        }

        await connection.commit();
        transactionStarted = false;

        return res.json({
            success: true,
            message: `Corporate action ${status.toLowerCase()} successfully.`,
            action: {
                id: String(action.id),
                symbol: action.symbol,
                previousStatus: "PENDING",
                verificationStatus: status
            },
            auditId: String(auditResult.insertId)
        });
    } catch (error) {
        if (connection && transactionStarted) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error(
                    "Corporate action rollback error:",
                    rollbackError.message
                );
            }
        }

        console.error("Corporate action review error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to complete corporate action review."
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
}

router.get("/", getCorporateActions);
router.get("/:symbol", getCorporateActions);

router.patch(
    "/:id/verification",
    authenticateToken,
    requireAdmin,
    reviewCorporateAction
);

module.exports = router;
