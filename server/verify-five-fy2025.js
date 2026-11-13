const pool = require("./db");

const approvedRecords = [
  {
    id: 1460,
    symbol: "SBIN",
    sourceUrl: "https://nsearchives.nseindia.com/corporate/xbrl/INTEGRATED_FILING_BANKING_1431207_03052025061133_WEB.xml"
  },
  {
    id: 1461,
    symbol: "HDFCBANK",
    sourceUrl: "https://nsearchives.nseindia.com/corporate/xbrl/INTEGRATED_FILING_BANKING_1420333_19042025104215_WEB.xml"
  },
  {
    id: 1462,
    symbol: "AARTIIND",
    sourceUrl: "https://nsearchives.nseindia.com/corporate/xbrl/INTEGRATED_FILING_INDAS_1480543_11072025100752_WEB.xml"
  },
  {
    id: 1463,
    symbol: "RELIANCE",
    sourceUrl: "https://nsearchives.nseindia.com/corporate/xbrl/INTEGRATED_FILING_INDAS_1425445_25042025095716_WEB.xml"
  },
  {
    id: 1464,
    symbol: "TCS",
    sourceUrl: "https://nsearchives.nseindia.com/corporate/xbrl/INTEGRATED_FILING_INDAS_1412101_11042025074137_WEB.xml"
  }
];

async function main() {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    console.log("Checking all five approved records...");

    for (const record of approvedRecords) {
      const [rows] = await connection.execute(
        `SELECT id, symbol, DATE_FORMAT(period_end, '%Y-%m-%d') AS periodEnd, period_type,
                reporting_basis, verification_status, source_url
         FROM company_fundamentals
         WHERE id = ?
         FOR UPDATE`,
        [record.id]
      );

      if (rows.length !== 1) {
        throw new Error(`Record ${record.id} was not found.`);
      }

      const row = rows[0];

      const valid =
        row.symbol === record.symbol &&
        row.periodEnd === "2025-03-31" &&
        row.period_type === "ANNUAL" &&
        row.reporting_basis === "CONSOLIDATED" &&
        row.verification_status === "PENDING" &&
        row.source_url === record.sourceUrl;

      if (!valid) {
        throw new Error(
          `Safety check failed for ${record.symbol} (ID ${record.id}).`
        );
      }

      console.log(`PASS: ${record.symbol} (ID ${record.id})`);
    }

    console.log("\nAll checks passed. Updating only verification_status...");

    for (const record of approvedRecords) {
      const [result] = await connection.execute(
        `UPDATE company_fundamentals
         SET verification_status = 'VERIFIED'
         WHERE id = ?
           AND symbol = ?
           AND period_end = '2025-03-31'
           AND period_type = 'ANNUAL'
           AND reporting_basis = 'CONSOLIDATED'
           AND verification_status = 'PENDING'
           AND source_url = ?`,
        [record.id, record.symbol, record.sourceUrl]
      );

      if (result.affectedRows !== 1) {
        throw new Error(
          `Update failed for ${record.symbol} (ID ${record.id}).`
        );
      }
    }

    const [finalRows] = await connection.execute(
      `SELECT id, symbol,
              DATE_FORMAT(period_end, '%Y-%m-%d') AS periodEnd,
              reporting_basis, verification_status
       FROM company_fundamentals
       WHERE id IN (1460, 1461, 1462, 1463, 1464)
       ORDER BY id`
    );

    if (
      finalRows.length !== 5 ||
      finalRows.some(row => row.verification_status !== "VERIFIED")
    ) {
      throw new Error("Final verification failed. Rolling back.");
    }

    await connection.commit();

    console.log("\nSUCCESS: Transaction committed.");
    console.table(finalRows);
    console.log("Updated records:", finalRows.length);
  } catch (error) {
    await connection.rollback();
    console.error("\nTRANSACTION ROLLED BACK:", error.message);
  } finally {
    connection.release();
    await pool.end();
  }
}

main().catch(console.error);

