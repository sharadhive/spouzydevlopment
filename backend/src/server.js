const app = require('./app');
const config = require('./config/environment');
const { sequelize } = require('./models');
const { cleanExpiredHolds } = require('./jobs/holdCleanup.job');
const cron = require('node-cron');

async function startServer() {
  try {
    // 1. Authenticate database connection
    console.log(`[Database] Connecting to ${config.db.host}:${config.db.port}/${config.db.name}...`);
    await sequelize.authenticate();
    console.log('[Database] Connected successfully.');

    // 2. Start HTTP server
    const server = app.listen(config.port, () => {
      console.log(`
=============================================================
  SPOUZY Management System Backend Running
  Port: ${config.port}
  Environment: ${config.env}
  Public Website: http://localhost:${config.port}/
  Admin Panel:    http://localhost:${config.port}/admin
  API Health:     http://localhost:${config.port}/api/health
=============================================================
      `);
    });

    // A second copy of the server cannot share the port: explain how to stop the old one
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`
[Server] Port ${config.port} is already in use. An older SPOUZY server is probably still running
         (the website would keep using its old code). Stop it, then start again:
           Windows PowerShell:  Get-NetTCPConnection -LocalPort ${config.port} -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
           macOS / Linux:       kill $(lsof -t -i:${config.port})
         Or close the other terminal that is running "npm run dev" / "npm start".
`);
      } else {
        console.error('[Server] Could not start:', err.message);
      }
      process.exit(1);
    });

    // 3. Schedule cron job: Expired slot holds cleanup every 2 minutes
    cron.schedule('*/2 * * * *', async () => {
      await cleanExpiredHolds();
    });

    // Every morning (IST): yearly consultation reminders for verified ex-servicemen
    cron.schedule('5 9 * * *', async () => {
      await require('./jobs/esmReminder.job').raiseEsmReminders();
    }, { timezone: 'Asia/Kolkata' });

    // 4. Graceful shutdown
    const shutdown = async (signal) => {
      console.log(`\n[Server] Received ${signal}. Shutting down gracefully...`);
      server.close(async () => {
        try {
          await sequelize.close();
          console.log('[Database] Connection closed.');
          process.exit(0);
        } catch (err) {
          console.error('[Server] Error during shutdown:', err);
          process.exit(1);
        }
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (err) {
    console.error('[Server Startup Fatal Error]:', err.message);
    process.exit(1);
  }
}

// Start whenever this file is loaded. cPanel's Passenger / LiteSpeed loaders `require()` the
// startup file, so a `require.main === module` check would stop the app from ever listening.
// Set SPOUZY_NO_AUTOSTART=1 to import the app without starting it.
if (process.env.SPOUZY_NO_AUTOSTART !== '1') {
  startServer();
}

module.exports = { app, startServer };
