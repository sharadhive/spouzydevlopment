const models = require('../models');

module.exports = {
  name: '20261118000001-create-all-tables.js',
  async up({ sequelize }) {
    console.log('Migrating: Synchronizing all models with MySQL...');
    // We use sync without force or alter, ensuring tables and foreign keys are created cleanly
    await sequelize.sync();
    console.log('Migration up complete: All tables created successfully.');
  },
  async down({ sequelize }) {
    console.log('Migration down: Dropping all tables...');
    await sequelize.drop();
    console.log('Migration down complete.');
  }
};
