const jwt = require("jsonwebtoken");
const pool = require("./db");

async function authenticateToken(req, res, next) {
    const authorization = req.get("authorization") || "";
    const match = authorization.match(/^Bearer\s+(.+)$/i);

    if (!match) {
        return res.status(401).json({
            success: false,
            message: "Authentication required."
        });
    }

    const secret = process.env.JWT_SECRET;

    if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
        console.error("Authentication configuration is invalid.");

        return res.status(500).json({
            success: false,
            message: "Authentication service is unavailable."
        });
    }

    let payload;

    try {
        payload = jwt.verify(match[1], secret, {
            issuer: "StockAI",
            audience: "StockAI"
        });
    } catch {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired access token."
        });
    }

    if (!payload || !payload.sub) {
        return res.status(401).json({
            success: false,
            message: "Invalid access token."
        });
    }

    try {
        const [users] = await pool.execute(
            `SELECT id, email, role, is_active
             FROM users
             WHERE id = ?
             LIMIT 1`,
            [payload.sub]
        );

        if (!users.length || Number(users[0].is_active) !== 1) {
            return res.status(401).json({
                success: false,
                message: "Account is unavailable."
            });
        }

        req.user = {
            id: String(users[0].id),
            email: users[0].email,
            role: users[0].role
        };

        return next();
    } catch (error) {
        console.error("Authentication database error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to authenticate this request."
        });
    }
}

function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== "ADMIN") {
        return res.status(403).json({
            success: false,
            message: "Administrator access required."
        });
    }

    return next();
}

module.exports = {
    authenticateToken,
    requireAdmin
};
