const WebSocket = require('ws');

let wss = null;
let heartbeatInterval = null;

function initWebSocket(server) {
  wss = new WebSocket.Server({ server });

  wss.on('connection', (ws, req) => {
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        if (data.type === 'PING') {
          ws.send(JSON.stringify({ type: 'PONG' }));
        }
      } catch (e) {
        // ignore malformed messages
      }
    });

    // Send immediate connection acknowledge
    ws.send(JSON.stringify({
      type: 'CONNECTED',
      timestamp: new Date().toISOString()
    }));
  });

  heartbeatInterval = setInterval(() => {
    if (!wss) return;
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  if (heartbeatInterval.unref) {
    heartbeatInterval.unref(); // Allows process to cleanly exit when server closes
  }

  wss.on('close', () => {
    if (heartbeatInterval) clearInterval(heartbeatInterval);
  });

  return wss;
}

function broadcast(event, payload) {
  if (!wss) return;
  const message = JSON.stringify({
    event,
    payload,
    timestamp: new Date().toISOString()
  });

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

module.exports = {
  initWebSocket,
  broadcast
};
