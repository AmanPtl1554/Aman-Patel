const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { app, server } = require('../server/server');
const db = require('../server/db');

const TEST_PORT = 3456;
const BASE_URL = `http://localhost:${TEST_PORT}`;

test('Cafe Backend API suite', async (t) => {
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));

  t.after(() => {
    server.close();
  });

  await t.test('GET /api/tables returns tables list', async () => {
    const res = await fetch(`${BASE_URL}/api/tables`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.tables));
    assert.ok(data.tables.length >= 8);
    assert.strictEqual(data.tables[0].name, 'Table 1 - Patio Sun');
  });

  await t.test('GET /api/tables/:id/qr generates QR code data URL', async () => {
    const res = await fetch(`${BASE_URL}/api/tables/3/qr`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.tableId, 3);
    assert.ok(data.qrDataUrl.startsWith('data:image/png;base64,'));
    assert.ok(data.targetUrl.includes('table=3'));
  });

  await t.test('GET /api/menu returns categories and menu items', async () => {
    const res = await fetch(`${BASE_URL}/api/menu`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.categories));
    assert.ok(Array.isArray(data.items));
    assert.ok(data.items.length >= 7);
    const latte = data.items.find(i => i.id === 'latte-sig');
    assert.ok(latte);
    assert.strictEqual(latte.name, 'Signature Burnt Honey Latte');
  });

  let createdOrderId = null;

  await t.test('POST /api/orders places a valid order', async () => {
    const payload = {
      tableId: 2,
      customerName: 'Kavya',
      items: [
        {
          menuItemId: 'latte-sig',
          quantity: 2,
          selectedOptions: [{ groupName: 'Milk Choice', name: 'Almond Milk', price: 20 }]
        },
        {
          menuItemId: 'croissant-butter',
          quantity: 1,
          selectedOptions: []
        }
      ],
      notes: 'Make it extra warm please',
      paymentMethod: 'upi'
    };

    const res = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.order.id);
    createdOrderId = data.order.id;
    assert.strictEqual(data.order.status, 'pending');
    assert.strictEqual(data.order.tableId, 2);
    assert.strictEqual(data.order.tableName, 'Table 2 - Window Lounge');
    assert.strictEqual(data.order.customerName, 'Kavya');

    // Calculations: (260 + 20) * 2 = 560; croissant = 180; subtotal = 740; tax = 37; total = 777
    assert.strictEqual(data.order.subtotal, 740);
    assert.strictEqual(data.order.tax, 37);
    assert.strictEqual(data.order.total, 777);
  });

  await t.test('GET /api/orders returns active orders for Kitchen Display', async () => {
    const res = await fetch(`${BASE_URL}/api/orders`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    const found = data.orders.find(o => o.id === createdOrderId);
    assert.ok(found);
  });

  await t.test('PATCH /api/orders/:id/status updates status to preparing, ready, and served', async () => {
    // 1. Preparing
    let res = await fetch(`${BASE_URL}/api/orders/${createdOrderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'preparing' })
    });
    assert.strictEqual(res.status, 200);
    let data = await res.json();
    assert.strictEqual(data.order.status, 'preparing');

    // 2. Ready
    res = await fetch(`${BASE_URL}/api/orders/${createdOrderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ready' })
    });
    assert.strictEqual(res.status, 200);
    data = await res.json();
    assert.strictEqual(data.order.status, 'ready');

    // 3. Served
    res = await fetch(`${BASE_URL}/api/orders/${createdOrderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'served' })
    });
    assert.strictEqual(res.status, 200);
    data = await res.json();
    assert.strictEqual(data.order.status, 'served');
  });

  await t.test('POST /api/waiter-call logs a staff assistance call', async () => {
    const res = await fetch(`${BASE_URL}/api/waiter-call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableId: 4, reason: 'Requesting check' })
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.call.tableId, 4);

    const callsRes = await fetch(`${BASE_URL}/api/waiter-calls`);
    const callsData = await callsRes.json();
    const foundCall = callsData.calls.find(c => c.id === data.call.id);
    assert.ok(foundCall);
  });
});
