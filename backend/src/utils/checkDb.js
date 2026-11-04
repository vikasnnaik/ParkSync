const { pool, testMySQLConnection } = require('../config/db');

const checkDatabase = async () => {
  console.log('--- ParkSync Database Health Check ---');
  const connected = await testMySQLConnection();
  if (!connected) {
    console.error('MySQL connection failed. Please check MYSQL_PASSWORD in backend/.env');
    process.exit(1);
  }

  try {
    const [tables] = await pool.execute('SHOW TABLES;');
    console.log('\n[Found Tables in parksync_db]:');
    for (const row of tables) {
      const tableName = Object.values(row)[0];
      try {
        const [countRow] = await pool.execute(`SELECT COUNT(*) as count FROM \`${tableName}\``);
        console.log(`  - ${tableName}: ${countRow[0].count} records`);
      } catch {
        console.log(`  - ${tableName} (View or special table)`);
      }
    }

    const [triggers] = await pool.execute('SHOW TRIGGERS;');
    console.log(`\n[Active Triggers (${triggers.length})]:`);
    for (const trg of triggers) {
      console.log(`  - ${trg.Trigger} (ON ${trg.Table} FOR ${trg.Event})`);
    }

    console.log('\nAll MySQL database objects verified successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Database query error:', err.message);
    process.exit(1);
  }
};

checkDatabase();

