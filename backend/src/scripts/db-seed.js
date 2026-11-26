const fs = require('fs');
const path = require('path');
const { sequelize } = require('../config/database');

async function runSeeders() {
  console.log('Connecting to database for seeding...');
  await sequelize.authenticate();

  // Ensure tracking table exists
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS \`schema_seeders\` (
      \`id\` INT AUTO_INCREMENT PRIMARY KEY,
      \`name\` VARCHAR(255) NOT NULL UNIQUE,
      \`executed_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  const [rows] = await sequelize.query(`SELECT \`name\` FROM \`schema_seeders\`;`);
  const executedSet = new Set(rows.map(r => r.name));

  const seedersDir = path.resolve(__dirname, '../seeders');
  const files = fs.readdirSync(seedersDir)
    .filter(f => f.endsWith('.js'))
    .sort();

  let count = 0;
  for (const file of files) {
    if (executedSet.has(file)) {
      console.log(`Seeder ${file} has already been recorded; running safe idempotent verify...`);
    }

    console.log(`Executing seeder: ${file}...`);
    const seeder = require(path.join(seedersDir, file));
    await seeder.up({ sequelize });

    if (!executedSet.has(file)) {
      await sequelize.query(
        `INSERT INTO \`schema_seeders\` (\`name\`, \`executed_at\`) VALUES (?, NOW());`,
        { replacements: [file] }
      );
    }
    count++;
  }

  console.log(`Finished executing ${count} seeder(s).`);
  return count;
}

if (require.main === module) {
  runSeeders()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Seeding failed:', err);
      process.exit(1);
    });
}

module.exports = { runSeeders, runSeeds: runSeeders };
