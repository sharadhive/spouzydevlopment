const { Sequelize } = require('sequelize');
const config = require('./environment');

const sequelize = new Sequelize(config.db.name, config.db.user, config.db.password, {
  host: config.db.host,
  port: config.db.port,
  dialect: 'mysql',
  logging: config.isProd || config.isTest ? false : console.log,
  define: {
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci',
    timestamps: true,
    underscored: true,
  },
  pool: {
    max: 15,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
  // Timestamps are stored in UTC and returned as real Date objects.
  // (Returning them as plain strings made servers running in IST read them 5h30m off.)
  timezone: '+00:00',
  dialectOptions: {
    charset: 'utf8mb4'
  }
});

module.exports = { sequelize, Sequelize };
