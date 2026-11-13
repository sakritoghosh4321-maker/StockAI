const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

const originalSecret = process.env.JWT_SECRET;
const TEST_SECRET = "stockai-auth-integration-test-secret-32chars";

process.env.JWT_SECRET = TEST_SECRET;

const mockUsers = [
    { id: 1, email: "admin@test.com", role: "ADMIN", is_active: 1 },
    { id: 2, email: "user@test.com", role: "USER", is_active: 1 },
    { id: 3, email: "inactive@test.com", role: "USER", is_active: 0 }
];

const mockPool = {
    async execute(sql, params = []) {
        if (sql.includes("FROM users")) {
            const user = mockUsers.find(
                item => String(item.id) === String(params[0])
            );

            return [user ? [user] : [], []];
        }

        throw new Error("Unexpected SQL query: " + sql);
    }
};

const dbPath = require.resolve("./db");

require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: mockPool
};

const { authenticateToken, requireAdmin } =
    require("./auth-middleware");

function createResponse() {
    return {
        statusCode: 200,
        body: null,

        status(code) {
            this.statusCode = code;
            return this;
        },

        json(data) {
            this.body = data;
            return this;
        }
    };
}

function createRequest(token) {
    return {
        get(name) {
            return name.toLowerCase() === "authorization" && token
                ? `Bearer ${token}`
                : "";
        }
    };
}

function createToken(userId, options = {}) {
    return jwt.sign(
        { sub: String(userId) },
        TEST_SECRET,
        {
            expiresIn: "15m",
            issuer: "StockAI",
            audience: "StockAI",
            ...options
        }
    );
}

test("Missing authorization header is rejected", async () => {
    const req = createRequest(null);
    const res = createResponse();
    let nextCalled = false;

    await authenticateToken(req, res, () => {
        nextCalled = true;
    });

    assert.equal(res.statusCode, 401);
    assert.equal(nextCalled, false);
});

test("Invalid JWT is rejected", async () => {
    const req = createRequest("invalid.token.value");
    const res = createResponse();

    await authenticateToken(req, res, () => {
        assert.fail("next must not be called");
    });

    assert.equal(res.statusCode, 401);
});

test("Expired JWT is rejected", async () => {
    const token = createToken(1, { expiresIn: -1 });
    const req = createRequest(token);
    const res = createResponse();

    await authenticateToken(req, res, () => {
        assert.fail("next must not be called");
    });

    assert.equal(res.statusCode, 401);
});

test("Valid ADMIN JWT authenticates successfully", async () => {
    const token = createToken(1);
    const req = createRequest(token);
    const res = createResponse();
    let nextCalled = false;

    await authenticateToken(req, res, () => {
        nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.deepEqual(req.user, {
        id: "1",
        email: "admin@test.com",
        role: "ADMIN"
    });
});

test("Valid USER JWT authenticates successfully", async () => {
    const token = createToken(2);
    const req = createRequest(token);
    const res = createResponse();
    let nextCalled = false;

    await authenticateToken(req, res, () => {
        nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(req.user.role, "USER");
});

test("Unknown user is rejected", async () => {
    const token = createToken(999);
    const req = createRequest(token);
    const res = createResponse();

    await authenticateToken(req, res, () => {
        assert.fail("next must not be called");
    });

    assert.equal(res.statusCode, 401);
});

test("Inactive user is rejected", async () => {
    const token = createToken(3);
    const req = createRequest(token);
    const res = createResponse();

    await authenticateToken(req, res, () => {
        assert.fail("next must not be called");
    });

    assert.equal(res.statusCode, 401);
});

test("ADMIN is allowed through administrator middleware", () => {
    const req = { user: { role: "ADMIN" } };
    const res = createResponse();
    let nextCalled = false;

    requireAdmin(req, res, () => {
        nextCalled = true;
    });

    assert.equal(nextCalled, true);
});

test("USER is blocked by administrator middleware", () => {
    const req = { user: { role: "USER" } };
    const res = createResponse();

    requireAdmin(req, res, () => {
        assert.fail("next must not be called");
    });

    assert.equal(res.statusCode, 403);
});

test("Missing user is blocked by administrator middleware", () => {
    const req = {};
    const res = createResponse();

    requireAdmin(req, res, () => {
        assert.fail("next must not be called");
    });

    assert.equal(res.statusCode, 403);
});

test.after(() => {
    if (originalSecret === undefined) {
        delete process.env.JWT_SECRET;
    } else {
        process.env.JWT_SECRET = originalSecret;
    }
});
