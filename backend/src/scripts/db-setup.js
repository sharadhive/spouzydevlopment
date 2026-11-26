const { createDatabase } = require('./db-create');
const { runMigrations } = require('./db-migrate');
const { runSeeders } = require('./db-seed');

async function dbSetup() {
  console.log('====================================================');
  console.log('SPOUZY Database Setup (Safe idempotent initialization)');
  console.log('====================================================');
  
  console.log('\n[1/3] Ensuring MySQL database exists...');
  await createDatabase();

  console.log('\n[2/3] Executing pending schema migrations...');
  await runMigrations();

  console.log('\n[3/3] Seeding initial production website content...');
  await runSeeders();

  console.log('\nDatabase setup completed successfully.');
}

if (require.main === module) {
  dbSetup()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('db:setup encountered an error:', err);
      process.exit(1);
    });
}

module.exports = { dbSetup };
