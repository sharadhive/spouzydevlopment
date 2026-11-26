const fs = require('fs');
const path = require('path');
const { sequelize } = require('../config/database');

async function runMigrations() {
  console.log('Connecting to database for migrations...');
  await sequelize.authenticate();

  // Ensure tracking table exists
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS \`schema_migrations\` (
      \`id\` INT AUTO_INCREMENT PRIMARY KEY,
      \`name\` VARCHAR(255) NOT NULL UNIQUE,
      \`executed_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Query already executed migrations
  const [rows] = await sequelize.query(`SELECT \`name\` FROM \`schema_migrations\`;`);
  const executedSet = new Set(rows.map(r => r.name));

  const migrationsDir = path.resolve(__dirname, '../migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.js'))
    .sort();

  let count = 0;
  for (const file of files) {
    if (executedSet.has(file)) {
      continue;
    }

    console.log(`Applying migration: ${file}...`);
    const migration = require(path.join(migrationsDir, file));
    
    // Execute migration
    await migration.up({ sequelize });

    // Record execution
    await sequelize.query(
      `INSERT INTO \`schema_migrations\` (\`name\`, \`executed_at\`) VALUES (?, NOW());`,
      { replacements: [file] }
    );
    console.log(`Applied migration: ${file}`);
    count++;
  }

  if (count === 0) {
    console.log('Database is up to date. No pending migrations.');
  } else {
    console.log(`Successfully executed ${count} migration(s).`);
  }
  return count;
}

if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}

module.exports = { runMigrations };
