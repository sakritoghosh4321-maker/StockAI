const pool = require("./db");

async function main() {
  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [existing] = await connection.execute(
      `SELECT id, symbol, action_type, ratio_numerator,
              ratio_denominator, verification_status
       FROM company_corporate_actions
       WHERE symbol = ?
         AND action_type = ?
       FOR UPDATE`,
      ["HDFCBANK", "BONUS"]
    );

    if (existing.length > 1) {
      throw new Error(
        "Multiple HDFCBANK bonus records found. Manual review required."
      );
    }

    if (existing.length === 1) {
      if (existing[0].verification_status !== "PENDING") {
        throw new Error(
          "Existing action is not PENDING. Refusing to modify a reviewed action."
        );
      }

      await connection.execute(
        `UPDATE company_corporate_actions
         SET ratio_numerator = 1,
             ratio_denominator = 1,
             announcement_date = ?,
             record_date = ?,
             effective_date = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?
           AND verification_status = 'PENDING'`,
        [
          "2025-07-19",
          "2025-08-27",
          "2025-08-26",
          existing[0].id
        ]
      );

      console.log("Existing pending HDFCBANK action corrected.");
    } else {
      await connection.execute(
        `INSERT INTO company_corporate_actions
         (
           symbol, action_type, ratio_numerator, ratio_denominator,
           announcement_date, record_date, effective_date,
           source_name, source_url, verification_status
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          "HDFCBANK",
          "BONUS",
          1,
          1,
          "2025-07-19",
          "2025-08-27",
          "2025-08-26",
          "HDFC Bank official disclosure and NSE corporate action",
          "https://www.hdfc.bank.in/content/dam/hdfcbankpws/in/en/personal-banking/about-us/stakeholders-information/disclosures/other-stock-exchange-disclosure/18/28aug2025-se-disclosure-allotment.pdf\nhttps://www.nseindia.com/get-quote/equity/HDFCBANK/HDFC-Bank-Limited?series=T0",
          "PENDING"
        ]
      );

      console.log("HDFCBANK bonus action inserted.");
    }

    const [rows] = await connection.execute(
      `SELECT id, symbol, action_type, ratio_numerator,
              ratio_denominator,
              DATE_FORMAT(announcement_date, '%Y-%m-%d') AS announcementDate,
              DATE_FORMAT(record_date, '%Y-%m-%d') AS recordDate,
              DATE_FORMAT(effective_date, '%Y-%m-%d') AS effectiveDate,
              verification_status
       FROM company_corporate_actions
       WHERE symbol = 'HDFCBANK'
         AND action_type = 'BONUS'`
    );

    await connection.commit();
    console.table(rows);
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error("Operation failed:", error.message);
    process.exitCode = 1;
  } finally {
    if (connection) connection.release();
    await pool.end();
  }
}

main();
