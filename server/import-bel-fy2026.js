const pool = require("./db");

const sourceUrl =
  "https://nsearchives.nseindia.com/corporate/ixbrl/INTEGRATED_FILING_INDAS_158847_19052026163923_iXBRL_WEB.html";

async function main() {
  try {
    const [existing] = await pool.execute(
      `SELECT id
       FROM company_fundamentals
       WHERE symbol = ?
         AND period_type = ?
         AND period_end = ?
         AND reporting_basis = ?`,
      ["BEL", "ANNUAL", "2026-03-31", "CONSOLIDATED"]
    );

    if (existing.length > 0) {
      console.log(
        "Import stopped: a BEL consolidated annual record already exists."
      );
      console.log("No existing record was changed.");
      return;
    }

    await pool.execute(
      `INSERT INTO company_fundamentals (
        symbol,
        period_type,
        reporting_basis,
        period_end,
        currency,
        amount_unit,
        revenue,
        net_profit,
        eps,
        total_assets,
        total_debt,
        shareholders_equity,
        operating_cash_flow,
        source_name,
        source_url,
        verification_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "BEL",
        "ANNUAL",
        "CONSOLIDATED",
        "2026-03-31",
        "INR",
        "INR_CRORE",
        27610.11,
        6062.26,
        8.29,
        44537.52,
        null,
        24007.14,
        1541.37,
        "NSE audited FY 2025-26 consolidated filing",
        sourceUrl,
        "VERIFIED"
      ]
    );

    console.log("BEL consolidated FY 2025-26 record inserted.");
    console.log("Monetary amounts: INR crore");
    console.log("EPS: INR per share");
    console.log("Total debt: NULL (not yet defined consistently).");
  } catch (error) {
    console.error("Import failed:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
