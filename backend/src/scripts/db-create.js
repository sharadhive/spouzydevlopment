const mysql = require('mysql2/promise');
const config = require('../config/environment');

async function createDatabase(dbName = config.db.name) {
  console.log(`Connecting to MySQL at ${config.db.host}:${config.db.port} as ${config.db.user}...`);
  try {
    const connection = await mysql.createConnection({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
    });

    console.log(`Creating database \`${dbName}\` if not exists (InnoDB, utf8mb4)...`);
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
    );

    console.log(`Database \`${dbName}\` is ready.`);
    await connection.end();
    return true;
  } catch (err) {
    console.error(`Error creating database \`${dbName}\`:`, err.message);
    throw err;
  }
}

if (require.main === module) {
  createDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { createDatabase };
