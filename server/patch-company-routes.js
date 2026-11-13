const fs = require("fs");

const file = "./server.js";
let source = fs.readFileSync(file, "utf8");

const profileStart = source.indexOf('app.get("/api/companies/:symbol"');
const intelligenceComment = source.indexOf(
    "COMPANY INTELLIGENCE API",
    profileStart
);
const intelligenceStart = source.indexOf(
    'app.get("/api/company-intelligence/:symbol"',
    intelligenceComment
);

if (
    profileStart < 0 ||
    intelligenceComment < 0 ||
    intelligenceStart < 0
) {
    console.error("PATCH STOPPED: Could not locate both API routes.");
    process.exit(1);
}

const profileCommentStart = source.lastIndexOf(
    "/*",
    intelligenceComment
);

if (profileCommentStart < profileStart) {
    console.error("PATCH STOPPED: Could not locate the route boundary.");
    process.exit(1);
}

const intelligenceRouteEnd = source.indexOf(
    "\n/* =====================================",
    intelligenceStart
);

if (intelligenceRouteEnd < 0) {
    console.error("PATCH STOPPED: Could not locate the end of intelligence route.");
    process.exit(1);
}

const profileRoute = `app.get("/api/companies/:symbol", async (req, res) => {
    try {
        const symbol = req.params.symbol.toUpperCase();
        const exchange = String(req.query.exchange || "NSE").toUpperCase();

        if (!["NSE", "BSE"].includes(exchange)) {
            return res.status(400).json({
                status: "error",
                message: "Exchange must be NSE or BSE."
            });
        }

        const [companies] = await pool.query(
            \`SELECT
                id, name, symbol, sector, price,
                change_amount AS \` + "\`change\`" + \`,
                change_percent AS changePercent
             FROM companies
             WHERE symbol = ?
             LIMIT 1\`,
            [symbol]
        );

        if (companies.length > 0) {
            return res.json({
                status: "success",
                dataStatus: "DATABASE",
                company: companies[0]
            });
        }

        const [listings] = await pool.query(
            \`SELECT
                id,
                company_name AS name,
                symbol,
                sector,
                exchange,
                exchange_symbol AS exchangeSymbol,
                security_code AS securityCode,
                isin,
                listing_status AS listingStatus
             FROM exchange_directory
             WHERE symbol = ?
               AND exchange = ?
             ORDER BY id ASC
             LIMIT 1\`,
            [symbol, exchange]
        );

        if (listings.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "No company profile or exchange listing was found for this symbol and exchange."
            });
        }

        return res.json({
            status: "success",
            dataStatus: "EXCHANGE DIRECTORY DATA - PRICE AND FINANCIAL PROFILE NOT ENRICHED",
            company: {
                ...listings[0],
                price: null,
                change: null,
                changePercent: null
            }
        });
    } catch (error) {
        console.error("Company Profile API Error:", error.message);
        return res.status(500).json({
            status: "error",
            message: "Unable to fetch company profile."
        });
    }
});`;

const intelligenceRoute = `app.get("/api/company-intelligence/:symbol", async (req, res) => {
    try {
        const symbol = req.params.symbol.toUpperCase();

        const [rows] = await pool.query(
            \`SELECT
                id, symbol, company_overview, business_activities,
                products_services, order_book, contracts, projects,
                partnerships, future_developments, created_at, updated_at
             FROM company_intelligence
             WHERE symbol = ?
             LIMIT 1\`,
            [symbol]
        );

        if (rows.length > 0) {
            return res.json({
                status: "success",
                dataStatus: "DATABASE",
                intelligence: rows[0]
            });
        }

        return res.json({
            status: "success",
            dataStatus: "NOT AVAILABLE - VERIFIED COMPANY INTELLIGENCE HAS NOT BEEN ADDED",
            intelligence: {
                symbol,
                message: "Verified company intelligence is not available yet. Orders, contracts, projects and partnerships have not been independently populated."
            }
        });
    } catch (error) {
        console.error("Company Intelligence API Error:", error.message);
        return res.status(500).json({
            status: "error",
            message: "Unable to fetch company intelligence."
        });
    }
});`;

source =
    source.slice(0, profileStart) +
    profileRoute +
    "\n\n\n" +
    source.slice(profileCommentStart, intelligenceStart) +
    intelligenceRoute +
    source.slice(intelligenceRouteEnd);

try {
    new Function(source);
} catch (error) {
    console.error("PATCH STOPPED: JavaScript syntax check failed.");
    console.error(error.message);
    process.exit(1);
}

fs.writeFileSync(file, source, "utf8");
console.log("Both API routes updated. JavaScript syntax check passed.");
