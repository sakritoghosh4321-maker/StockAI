const pool = require("./db");

async function main() {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [result] = await connection.execute(`
      UPDATE company_fundamentals
      SET verification_status = 'VERIFIED'
      WHERE id = 1459
        AND symbol = 'BEL'
        AND period_type = 'ANNUAL'
        AND reporting_basis = 'CONSOLIDATED'
        AND verification_status = 'PENDING'
        AND source_url = 'https://nsearchives.nseindia.com/corporate/xbrl/INTEGRATED_FILING_INDAS_1443317_19052025064704_WEB.xml'
    `);

    if (result.affectedRows !== 1) {
      throw new Error(
        `Expected exactly one updated record; got ${result.affectedRows}.`
      );
    }

    const [rows] = await connection.execute(`
      SELECT id, symbol, period_end, revenue, net_profit,
             eps, verification_status
      FROM company_fundamentals
      WHERE id = 1459
    `);

    await connection.commit();

    console.log("Verification update successful:");
    console.table(rows);

  } catch (error) {
    await connection.rollback();
    console.error("Update rolled back:", error.message);
    process.exitCode = 1;
  } finally {
    connection.release();
    await pool.end();
  }
}

main();
