const express = require('express');
const qrcode = require('qrcode');
const db = require('./db');
const { broadcast } = require('./websocket');

const router = express.Router();

// GET /api/tables
router.get('/tables', (req, res) => {
  res.json({
    success: true,
    tables: db.getTables()
  });
});

// GET /api/tables/:id/qr - generate scannable QR Code as DataURL or SVG
router.get('/tables/:id/qr', async (req, res) => {
  const table = db.getTable(req.params.id);
  if (!table) {
    return res.status(404).json({ success: false, error: 'Table not found' });
  }

  // Determine host from request
  const host = req.get('host') || 'localhost:3000';
  const protocol = req.protocol || 'http';
  const targetUrl = `${protocol}://${host}/?table=${table.id}`;

  try {
    const format = req.query.format || 'dataurl';
    if (format === 'svg') {
      const svg = await qrcode.toString(targetUrl, { type: 'svg', margin: 2, width: 280 });
      res.setHeader('Content-Type', 'image/svg+xml');
      return res.send(svg);
    }

    const dataUrl = await qrcode.toDataURL(targetUrl, {
      margin: 2,
      width: 280,
      color: {
        dark: '#16100c',
        light: '#ffffff'
      }
    });

    res.json({
      success: true,
      tableId: table.id,
      tableName: table.name,
      targetUrl,
      qrDataUrl: dataUrl
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/menu
router.get('/menu', (req, res) => {
  res.json({
    success: true,
    categories: db.getCategories(),
    items: db.getMenu()
  });
});

// POST /api/menu/:id/toggle-stock
router.post('/menu/:id/toggle-stock', (req, res) => {
  const updated = db.toggleMenuItemStock(req.params.id);
  if (!updated) {
    return res.status(404).json({ success: false, error: 'Item not found' });
  }
  broadcast('MENU_STOCK_CHANGED', updated);
  res.json({ success: true, item: updated });
});

// POST /api/orders - place an order
router.post('/orders', (req, res) => {
  try {
    const { tableId, customerName, items, notes, paymentMethod } = req.body;
    if (!tableId) {
      return res.status(400).json({ success: false, error: 'Table ID is required' });
    }
    if (!items || !items.length) {
      return res.status(400).json({ success: false, error: 'Order must contain items' });
    }

    const order = db.createOrder({
      tableId,
      customerName,
      items,
      notes,
      paymentMethod
    });

    // Notify kitchen in real time!
    broadcast('ORDER_CREATED', order);

    res.status(201).json({
      success: true,
      order
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

// GET /api/orders - for kitchen display system
router.get('/orders', (req, res) => {
  const { status, tableId } = req.query;
  let orders = db.getOrders();

  if (status) {
    orders = orders.filter(o => o.status === status);
  }
  if (tableId) {
    orders = orders.filter(o => o.tableId === parseInt(tableId, 10));
  }

  res.json({
    success: true,
    orders
  });
});

// GET /api/orders/:id - track specific order
router.get('/orders/:id', (req, res) => {
  const order = db.getOrder(req.params.id);
  if (!order) {
    return res.status(404).json({ success: false, error: 'Order not found' });
  }
  res.json({ success: true, order });
});

// PATCH /api/orders/:id/status - kitchen status transition
router.patch('/orders/:id/status', (req, res) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, error: 'Status is required' });
    }

    const updated = db.updateOrderStatus(req.params.id, status);
    broadcast('ORDER_STATUS_CHANGED', updated);

    res.json({ success: true, order: updated });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/waiter-call
router.post('/waiter-call', (req, res) => {
  try {
    const { tableId, reason } = req.body;
    if (!tableId) {
      return res.status(400).json({ success: false, error: 'tableId is required' });
    }
    const call = db.callWaiter(tableId, reason);
    broadcast('WAITER_CALLED', call);
    res.json({ success: true, call });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// GET /api/waiter-calls
router.get('/waiter-calls', (req, res) => {
  res.json({ success: true, calls: db.getWaiterCalls() });
});

// POST /api/waiter-calls/:id/resolve
router.post('/waiter-calls/:id/resolve', (req, res) => {
  const call = db.resolveWaiterCall(req.params.id);
  if (!call) {
    return res.status(404).json({ success: false, error: 'Call not found' });
  }
  broadcast('WAITER_CALL_RESOLVED', call);
  res.json({ success: true, call });
});

// GET /api/stats
router.get('/stats', (req, res) => {
  res.json({
    success: true,
    stats: db.getStats()
  });
});

module.exports = router;
