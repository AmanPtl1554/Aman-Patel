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

// Direct route to QR ordering menu
app.get('/order', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Customer order tracker direct path fallback
app.get('/track/:id', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Kitchen display system direct path
app.get('/kitchen', (req, res) => {
  res.sendFile(path.join(publicDir, 'kitchen.html'));
});

// Brand landing page
app.get('/experience', (req, res) => {
  res.sendFile(path.join(publicDir, 'landing.html'));
});

// Initialize WebSocket server
initWebSocket(server);

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`☕ QR Cafe Ordering Server listening on http://0.0.0.0:${PORT}`);
    console.log(`🍳 Kitchen Display System available at http://0.0.0.0:${PORT}/kitchen`);
    console.log(`📱 QR Ordering available at http://0.0.0.0:${PORT}/`);
  });
}

module.exports = { app, server };
