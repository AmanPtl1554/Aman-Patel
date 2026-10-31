const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const apiRoutes = require('./routes');
const { initWebSocket } = require('./websocket');

const app = express();
const server = http.createServer(app);

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

// API routes
app.use('/api', apiRoutes);

// Customer order tracker direct path fallback
app.get('/track/:id', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Kitchen display system direct path
app.get('/kitchen', (req, res) => {
  res.sendFile(path.join(publicDir, 'kitchen.html'));
});

// Initialize WebSocket server
initWebSocket(server);

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`☕ QR Cafe Ordering Server listening on http://localhost:${PORT}`);
    console.log(`🍳 Kitchen Display System available at http://localhost:${PORT}/kitchen`);
  });
}

module.exports = { app, server };
