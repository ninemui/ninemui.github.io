const { spawn } = require('child_process');
const HOURS_24 = 8 * 60 * 60 * 1000; // 24h in milliseconds

function startServer() {
  const server = spawn('node', ['server.js'], { stdio: 'inherit' });

  // Daily restart timer
  const restartTimer = setTimeout(() => {
    server.kill(); // Gracefully stop the server
  }, HOURS_24);

  server.on('exit', () => {
    clearTimeout(restartTimer);
    console.log('Restarting server...');
    setTimeout(startServer, 1000); // Wait 1s before restart
  });
}

startServer();