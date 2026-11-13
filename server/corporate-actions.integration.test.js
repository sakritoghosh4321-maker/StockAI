
const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const Module = require("node:module");
const path = require("node:path");

const originalSecret = process.env.JWT_SECRET;
const TEST_SECRET = "stockai-corporate-actions-test-secret-123456";
process.env.JWT_SECRET = TEST_SECRET;

const ADMIN_ID = 1;
const USER_ID = 2;

let mockActionStatus;
let mockActionExists;
let mockDatabaseFailure;
let mockRows;
let mockUsers;
let transactionStats;

function resetMocks() {
    mockActionStatus = "PENDING";
    mockActionExists = true;
    mockDatabaseFailure = false;

    mockRows = [
        {
            id: 1,
            symbol: "HDFCBANK",
            actionType: "BONUS",
            ratioNumerator: 1,
            ratioDenominator: 1,
            verificationStatus: "PENDING"
        }
    ];

    mockUsers = {
        [ADMIN_ID]: { id: ADMIN_ID, role: "ADMIN", is_active: 1 },
        [USER_ID]: { id: USER_ID, role: "USER", is_active: 1 }
    };

    transactionStats = {
        connections: 0,
        begins: 0,
        audits: 0,
        updates: 0,
        commits: 0,
        rollbacks: 0,
        releases: 0
    };
}

resetMocks();

const mockPool = {
    async execute(sql, params = []) {
        if (sql.includes("FROM users")) {
            const user = mockUsers[Number(params[0])];

            return [[
                ...(user ? [user] : [])
            ]];
        }

        if (sql.includes("FROM company_corporate_actions")) {
            return [mockRows];
        }

        throw new Error("Unexpected pool query: " + sql);
    },

    async getConnection() {
        transactionStats.connections++;

        return {
            async beginTransaction() {
                transactionStats.begins++;
            },

            async execute(sql, params = []) {
                if (mockDatabaseFailure) {
                    throw new Error("Simulated database failure");
                }

                if (sql.includes("SELECT id, symbol, verification_status")) {
                    if (!mockActionExists) {
                        return [[]];
                    }

                    return [[{
                        id: Number(params[0]),
                        symbol: "HDFCBANK",
                        verification_status: mockActionStatus
                    }]];
                }

                if (sql.includes("INSERT INTO corporate_action_verification_audit")) {
                    transactionStats.audits++;

                    assert.equal(params[0], "1");
                    assert.equal(params[1], String(ADMIN_ID));
                    assert.equal(params[2], "PENDING");

                    return [{ insertId: 501 }];
                }

                if (sql.includes("UPDATE company_corporate_actions")) {
                    transactionStats.updates++;
                    mockActionStatus = params[0];

                    return [{ affectedRows: 1 }];
                }

                throw new Error("Unexpected connection query: " + sql);
            },

            async commit() {
                transactionStats.commits++;
            },

            async rollback() {
                transactionStats.rollbacks++;
            },

            release() {
                transactionStats.releases++;
            }
        };
    }
};

const dbPath = require.resolve("./db");
const routePath = require.resolve("./corporate-actions");
const authMiddlewarePath = require.resolve("./auth-middleware");
const originalLoad = Module._load;

Module._load = function (request, parent, isMain) {
    if (
        parent &&
        (
            parent.filename === routePath ||
            parent.filename === authMiddlewarePath
        ) &&
        request === "./db"
    ) {
        return mockPool;
    }

    return originalLoad.call(this, request, parent, isMain);
};

delete require.cache[authMiddlewarePath];
delete require.cache[routePath];

const router = require("./corporate-actions");

Module._load = originalLoad;
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

function createToken(userId) {
    return jwt.sign(
        {},
        TEST_SECRET,
        {
            subject: String(userId),
            expiresIn: "10m",
            issuer: "StockAI",
            audience: "StockAI"
        }
    );
}
function findRoute(method, routePath) {
    const layer = router.stack.find(
        item => item.route && item.route.path === routePath &&
            item.route.methods[method.toLowerCase()]
    );

    assert.ok(layer, `Route not found: ${method} ${routePath}`);

    return layer.route.stack.map(item => item.handle);
}

async function callGetRoute(routePath, req) {
    const handlers = findRoute("GET", routePath);
    const res = createResponse();

    await handlers[0](req, res);

    return res;
}

async function callPatchRoute(id, body, token) {
    const handlers = findRoute("PATCH", "/:id/verification");
    const res = createResponse();

    const req = {
    params: { id },
    body: body || {},
    query: {},
    headers: token
        ? { authorization: `Bearer ${token}` }
        : {},
    get(name) {
        return this.headers[name.toLowerCase()];
    }
};

    let index = 0;

    async function next(error) {
        if (error) {
            throw error;
        }

        const handler = handlers[index++];

        if (handler) {
            await handler(req, res, next);
        }
    }

    await next();

    return res;
}

test.beforeEach(() => {
    resetMocks();
});

test("GET route returns corporate action records", async () => {
    const res = await callGetRoute("/", {
        params: {},
        query: {}
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.count, 1);
    assert.equal(res.body.actions[0].symbol, "HDFCBANK");
});

test("GET route filters by company symbol", async () => {
    const res = await callGetRoute("/:symbol", {
        params: { symbol: "hdfcbank" },
        query: {}
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.filters.symbol, "HDFCBANK");
});

test("GET route rejects invalid company symbol", async () => {
    const res = await callGetRoute("/:symbol", {
        params: { symbol: "INVALID SYMBOL!" },
        query: {}
    });

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
});

test("GET route rejects invalid verification status", async () => {
    const res = await callGetRoute("/", {
        params: {},
        query: { status: "UNKNOWN" }
    });

    assert.equal(res.statusCode, 400);
});

test("PATCH route rejects missing authentication", async () => {
    const res = await callPatchRoute(
        "1",
        { status: "VERIFIED", reviewNote: "Official sources checked." },
        null
    );

    assert.equal(res.statusCode, 401);
    assert.equal(transactionStats.connections, 0);
});

test("PATCH route rejects normal USER account", async () => {
    const res = await callPatchRoute(
        "1",
        { status: "VERIFIED", reviewNote: "Official sources checked." },
        createToken(USER_ID)
    );

    assert.equal(res.statusCode, 403);
    assert.equal(transactionStats.connections, 0);
});

test("PATCH route rejects invalid corporate action ID", async () => {
    const res = await callPatchRoute(
        "abc",
        { status: "VERIFIED", reviewNote: "Official sources checked." },
        createToken(ADMIN_ID)
    );

    assert.equal(res.statusCode, 400);
    assert.equal(transactionStats.connections, 0);
});

test("PATCH route rejects corporate action ID above BIGINT range", async () => {
    const res = await callPatchRoute(
        "18446744073709551616",
        { status: "VERIFIED", reviewNote: "Official sources checked." },
        createToken(ADMIN_ID)
    );

    assert.equal(res.statusCode, 400);
    assert.equal(transactionStats.connections, 0);
});

test("PATCH route rejects invalid verification status", async () => {
    const res = await callPatchRoute(
        "1",
        { status: "PENDING", reviewNote: "Official sources checked." },
        createToken(ADMIN_ID)
    );

    assert.equal(res.statusCode, 400);
    assert.equal(transactionStats.connections, 0);
});

test("PATCH route rejects review note shorter than 10 characters", async () => {
    const res = await callPatchRoute(
        "1",
        { status: "VERIFIED", reviewNote: "Too short" },
        createToken(ADMIN_ID)
    );

    assert.equal(res.statusCode, 400);
    assert.equal(transactionStats.connections, 0);
});

test("PATCH route rejects review note longer than 1000 characters", async () => {
    const res = await callPatchRoute(
        "1",
        { status: "VERIFIED", reviewNote: "A".repeat(1001) },
        createToken(ADMIN_ID)
    );

    assert.equal(res.statusCode, 400);
    assert.equal(transactionStats.connections, 0);
});

test("PATCH route returns 404 when corporate action does not exist", async () => {
    mockActionExists = false;

    const res = await callPatchRoute(
        "999",
        { status: "VERIFIED", reviewNote: "Official sources checked." },
        createToken(ADMIN_ID)
    );

    assert.equal(res.statusCode, 404);
    assert.equal(transactionStats.begins, 1);
    assert.equal(transactionStats.rollbacks, 1);
    assert.equal(transactionStats.commits, 0);
    assert.equal(transactionStats.releases, 1);
});

test("PATCH route prevents reviewing an already-reviewed action", async () => {
    mockActionStatus = "VERIFIED";

    const res = await callPatchRoute(
        "1",
        { status: "REJECTED", reviewNote: "Official sources checked." },
        createToken(ADMIN_ID)
    );

    assert.equal(res.statusCode, 409);
    assert.equal(res.body.currentStatus, "VERIFIED");
    assert.equal(transactionStats.rollbacks, 1);
    assert.equal(transactionStats.audits, 0);
    assert.equal(transactionStats.updates, 0);
});

test("ADMIN successfully verifies a pending corporate action", async () => {
    const res = await callPatchRoute(
        "1",
        {
            status: "VERIFIED",
            reviewNote: "Verified against official exchange disclosures."
        },
        createToken(ADMIN_ID)
    );

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.action.previousStatus, "PENDING");
    assert.equal(res.body.action.verificationStatus, "VERIFIED");
    assert.equal(res.body.auditId, "501");

    assert.equal(mockActionStatus, "VERIFIED");
    assert.equal(transactionStats.audits, 1);
    assert.equal(transactionStats.updates, 1);
    assert.equal(transactionStats.commits, 1);
    assert.equal(transactionStats.rollbacks, 0);
    assert.equal(transactionStats.releases, 1);
});

test("Database failure rolls back corporate action review", async () => {
    mockDatabaseFailure = true;

    const res = await callPatchRoute(
        "1",
        {
            status: "VERIFIED",
            reviewNote: "Verified against official exchange disclosures."
        },
        createToken(ADMIN_ID)
    );

    assert.equal(res.statusCode, 500);
    assert.equal(res.body.success, false);
    assert.equal(transactionStats.rollbacks, 1);
    assert.equal(transactionStats.commits, 0);
    assert.equal(transactionStats.releases, 1);
});

test.after(() => {
    if (originalSecret === undefined) {
        delete process.env.JWT_SECRET;
    } else {
        process.env.JWT_SECRET = originalSecret;
    }
});
