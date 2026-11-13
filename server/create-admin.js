const bcrypt = require("bcryptjs");
const pool = require("./db");

async function main() {
    const email = String(process.env.ADMIN_EMAIL || "")
        .trim()
        .toLowerCase();

    const password = String(process.env.ADMIN_PASSWORD || "");

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
        throw new Error("A valid administrator email is required.");
    }

    const passwordBytes = Buffer.byteLength(password, "utf8");

    if (password.length < 12 || passwordBytes > 72) {
        throw new Error(
            "Password must contain at least 12 characters and at most 72 UTF-8 bytes."
        );
    }

    let connection;
    let lockAcquired = false;

    try {
        connection = await pool.getConnection();

        const [lockRows] = await connection.query(
            "SELECT GET_LOCK('stockai_admin_bootstrap', 10) AS acquired"
        );

        if (Number(lockRows[0].acquired) !== 1) {
            throw new Error("Could not acquire administrator setup lock.");
        }

        lockAcquired = true;

        const [admins] = await connection.execute(
            "SELECT COUNT(*) AS total FROM users WHERE role = 'ADMIN'"
        );

        if (Number(admins[0].total) > 0) {
            throw new Error(
                "An administrator already exists. Bootstrap stopped."
            );
        }

        const [existing] = await connection.execute(
            "SELECT id FROM users WHERE email = ? LIMIT 1",
            [email]
        );

        if (existing.length > 0) {
            throw new Error(
                "This email already has an account. No account was changed."
            );
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const [result] = await connection.execute(
            `INSERT INTO users
                (email, password_hash, role, is_active)
             VALUES (?, ?, 'ADMIN', TRUE)`,
            [email, passwordHash]
        );

        console.log("Administrator account created successfully.");
        console.log(`Account ID: ${result.insertId}`);
        console.log("Role: ADMIN");
        console.log("Active: YES");
        console.log("Password: not displayed");
    } finally {
        if (connection) {
            if (lockAcquired) {
                await connection.query(
                    "SELECT RELEASE_LOCK('stockai_admin_bootstrap')"
                );
            }

            connection.release();
        }

        await pool.end();
    }
}

main().catch((error) => {
    console.error("Administrator setup failed:", error.message);
    process.exitCode = 1;
});
