const { spawn } = require('child_process');

function getMsUntil9AMPST() {
  const now = new Date();
  const next9AM = new Date();

  // Set target time to 17:00 UTC (for PDT) or 16:00 UTC (for PST)
  const isDaylightSaving = /* Add DST check if needed (see below) */ false;
  next9AM.setHours(isDaylightSaving ? 17 : 16, 0, 0, 0);

  // If it's already past 9 AM PST today, schedule for tomorrow
  if (next9AM <= now) {
    next9AM.setDate(next9AM.getDate() + 1);
  }

  return next9AM - now; // Milliseconds until 9 AM PST
}

function startServer() {
  const server = spawn('node', ['server.js'], { stdio: 'inherit' });

  const restartTimer = setTimeout(() => {
    server.kill();
  }, getMsUntil9AMPST());

  server.on('exit', () => {
    clearTimeout(restartTimer);
    console.log('Restarting at 9 AM PST...');
    setTimeout(startServer, 1000);
  });
}

startServer();