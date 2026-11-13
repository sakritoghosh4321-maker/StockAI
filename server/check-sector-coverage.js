const db = require("./db");

async function checkCoverage() {
    try {
        const [rows] = await db.query(`
            SELECT
                exchange,
                COUNT(*) AS total_listings,
                SUM(
                    CASE
                        WHEN sector IS NOT NULL
                         AND TRIM(sector) <> ''
                        THEN 1 ELSE 0
                    END
                ) AS listings_with_sector,
                SUM(
                    CASE
                        WHEN sector IS NULL
                          OR TRIM(sector) = ''
                        THEN 1 ELSE 0
                    END
                ) AS listings_without_sector
            FROM exchange_directory
            GROUP BY exchange

            UNION ALL

            SELECT
                'TOTAL' AS exchange,
                COUNT(*) AS total_listings,
                SUM(
                    CASE
                        WHEN sector IS NOT NULL
                         AND TRIM(sector) <> ''
                        THEN 1 ELSE 0
                    END
                ) AS listings_with_sector,
                SUM(
                    CASE
                        WHEN sector IS NULL
                          OR TRIM(sector) = ''
                        THEN 1 ELSE 0
                    END
                ) AS listings_without_sector
            FROM exchange_directory
        `);

        console.log("\n--- NSE/BSE SECTOR COVERAGE ---");
        console.table(rows);
    } catch (error) {
        console.error("COVERAGE CHECK FAILED:", error.message);
    } finally {
        await db.end();
    }
}

checkCoverage();
