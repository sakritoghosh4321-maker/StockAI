const fs = require("fs");
const path = require("path");

const serverPath = path.join(__dirname, "server.js");
const source = fs.readFileSync(serverPath, "utf8");

const pattern =
    /        const conditions = \["cl\.listing_status = 'ACTIVE'"\];[\s\S]*?        const \[listings\] = await pool\.query\(sql, params\);/;

const replacement = [
    '        const conditions = ["d.listing_status = \'ACTIVE\'"];',
    '        const params = [];',
    '',
    '        if (exchange) {',
    '            conditions.push("d.exchange = ?");',
    '            params.push(exchange);',
    '        }',
    '',
    '        if (search) {',
    '            conditions.push(',
    '                "(d.company_name LIKE ? OR d.symbol LIKE ? OR d.exchange_symbol LIKE ? OR d.security_code LIKE ? OR d.isin LIKE ?)"',
    '            );',
    '            const searchValue = `%${search}%`;',
    '            params.push(searchValue, searchValue, searchValue, searchValue, searchValue);',
    '        }',
    '',
    '        const sql = `',
    '            SELECT',
    '                d.id AS companyId,',
    '                d.company_name AS name,',
    '                d.symbol,',
    '                d.sector,',
    '                d.exchange,',
    '                d.exchange_symbol AS exchangeSymbol,',
    '                d.security_code AS securityCode,',
    '                d.isin,',
    '                d.instrument_type AS instrumentType,',
    '                d.listing_status AS listingStatus',
    '            FROM exchange_directory d',
    '            WHERE ${conditions.join(" AND ")}',
    '            ORDER BY d.company_name ASC, d.exchange ASC',
    '            LIMIT 500',
    '        `;',
    '',
    '        const [listings] = await pool.query(sql, params);'
].join("\n");

if (!pattern.test(source)) {
    console.error("ERROR: Expected Listings query not found. No changes made.");
    process.exit(1);
}

const routeCount = (source.match(/app\.get\("\/api\/company-listings"/g) || []).length;

if (routeCount !== 1) {
    console.error(`ERROR: Expected one Listings route; found ${routeCount}. No changes made.`);
    process.exit(1);
}

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = path.join(__dirname, "backups", `listings-directory-update-${timestamp}`);

fs.mkdirSync(backupDir, { recursive: true });
fs.copyFileSync(serverPath, path.join(backupDir, "server-before-listings-directory.js"));

fs.writeFileSync(serverPath, source.replace(pattern, replacement), "utf8");

console.log("SUCCESS: Listings API now queries exchange_directory.");
console.log("Backup saved in:", backupDir);
