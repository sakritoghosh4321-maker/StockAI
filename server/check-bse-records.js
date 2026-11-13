require('dotenv').config();
const pool = require('./db');

async function main() {
  try {
    const [rows] = await pool.query(
      'SELECT DATABASE() AS database_name, COUNT(*) AS bse_count FROM exchange_directory WHERE exchange = ?',
      ['BSE']
    );

    console.table(rows);

    const [bseRows] = await pool.query(
      'SELECT company_name, symbol, exchange, exchange_symbol, security_code, isin FROM exchange_directory WHERE exchange = ? LIMIT 10',
      ['BSE']
    );

    console.log('Existing BSE records:');
    console.table(bseRows);
  } catch (error) {
    console.error('Database error:', error.code || '', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
