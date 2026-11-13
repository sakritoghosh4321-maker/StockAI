const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("./db");
const { authenticateToken } = require("./auth-middleware");

const router = express.Router();

function getJwtSecret() {
    const secret = process.env.JWT_SECRET;

    if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
        throw new Error("JWT_SECRET is missing or too short.");
    }

    return secret;
}

router.post("/login", async (req, res) => {
    try {
        const email = typeof req.body?.email === "string"
            ? req.body.email.trim().toLowerCase()
            : "";

        const password = typeof req.body?.password === "string"
            ? req.body.password
            : "";

        if (
            !email ||
            email.length > 254 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
            !password ||
            Buffer.byteLength(password, "utf8") > 72
        ) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        const [users] = await pool.execute(
            `SELECT id, email, password_hash, role, is_active
             FROM users
             WHERE email = ?
             LIMIT 1`,
            [email]
        );

        if (!users.length) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        const user = users[0];
        const passwordMatches = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!passwordMatches || Number(user.is_active) !== 1) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        if (!["USER", "ADMIN"].includes(user.role)) {
            return res.status(403).json({
                success: false,
                message: "This account does not have an application role."
            });
        }

        await pool.execute(
            "UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?",
            [user.id]
        );

        const token = jwt.sign(
            { sub: String(user.id) },
            getJwtSecret(),
            {
                expiresIn: process.env.JWT_EXPIRES_IN || "15m",
                issuer: "StockAI",
                audience: "StockAI"
            }
        );

        return res.json({
            success: true,
            token,
            expiresIn: process.env.JWT_EXPIRES_IN || "15m",
            user: {
                id: String(user.id),
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error("Login error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to process login."
        });
    }
});

router.get("/me", authenticateToken, (req, res) => {
    return res.json({
        success: true,
        user: req.user
    });
});

module.exports = router;
