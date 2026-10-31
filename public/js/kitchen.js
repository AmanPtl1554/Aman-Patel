/**
 * Aman Patel Cafe — Kitchen Display System (KDS) & Staff Engine
 */
(function () {
  'use strict';

  let orders = [];
  let menuItems = [];
  let tables = [];
  let currentFilter = 'active'; // 'active', 'pending', 'preparing', 'ready', 'served'
  let soundEnabled = true;
  let activeWaiterCall = null;
  let ws = null;

  // DOM Elements
  const elTicketBoard = document.getElementById('ticketBoard');
  const elStatActive = document.getElementById('statActive');
  const elCountActive = document.getElementById('countActive');
  const elCountPending = document.getElementById('countPending');
  const elCountPreparing = document.getElementById('countPreparing');
  const elCountReady = document.getElementById('countReady');
  const elWaiterBar = document.getElementById('waiterBar');
  const elWaiterBarText = document.getElementById('waiterBarText');
  const elBtnDismissWaiter = document.getElementById('btnDismissWaiter');

  // Synthetic Web Audio Chime for new tickets
  function playOrderChime() {
    if (!soundEnabled) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc1.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(880, ctx.currentTime);
      osc2.frequency.exponentialRampToValueAtTime(1174.66, ctx.currentTime + 0.25); // D6

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start();
      osc2.start();
      osc1.stop(ctx.currentTime + 0.6);
      osc2.stop(ctx.currentTime + 0.6);
    } catch (e) {
      console.warn('Audio not allowed yet by user gesture', e);
    }
  }

  // Connect WebSocket
  function initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    ws = new WebSocket(`${protocol}//${host}`);

    ws.onopen = () => {
      console.log('⚡ KDS connected to real-time engine');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.event === 'ORDER_CREATED' && data.payload) {
          orders.unshift(data.payload);
          playOrderChime();
          renderBoard();
        } else if (data.event === 'ORDER_STATUS_CHANGED' && data.payload) {
          const idx = orders.findIndex(o => o.id === data.payload.id);
          if (idx !== -1) {
            orders[idx] = data.payload;
          } else {
            orders.unshift(data.payload);
          }
          renderBoard();
        } else if (data.event === 'WAITER_CALLED' && data.payload) {
          activeWaiterCall = data.payload;
          elWaiterBarText.textContent = `${data.payload.tableName} requested: "${data.payload.reason}"`;
          elWaiterBar.classList.add('show');
          playOrderChime();
        } else if (data.event === 'WAITER_CALL_RESOLVED') {
          elWaiterBar.classList.remove('show');
        } else if (data.event === 'MENU_STOCK_CHANGED' && data.payload) {
          const idx = menuItems.findIndex(i => i.id === data.payload.id);
          if (idx !== -1) {
            menuItems[idx] = data.payload;
          }
        }
      } catch (err) {
        console.error('WS Error:', err);
      }
    };

    ws.onclose = () => {
      setTimeout(initWebSocket, 3000);
    };
  }

  // Fetch initial state
  async function loadData() {
    try {
      const [ordRes, menuRes, tabRes, callsRes] = await Promise.all([
        fetch('/api/orders').then(r => r.json()),
        fetch('/api/menu').then(r => r.json()),
        fetch('/api/tables').then(r => r.json()),
        fetch('/api/waiter-calls').then(r => r.json())
      ]);

      if (ordRes.success) orders = ordRes.orders;
      if (menuRes.success) menuItems = menuRes.items;
      if (tabRes.success) tables = tabRes.tables;
      if (callsRes.success && callsRes.calls.length > 0) {
        activeWaiterCall = callsRes.calls[0];
        elWaiterBarText.textContent = `${activeWaiterCall.tableName} requested: "${activeWaiterCall.reason}"`;
        elWaiterBar.classList.add('show');
      }

      renderBoard();
    } catch (e) {
      console.error('Error fetching KDS data', e);
    }
  }

  // Render KDS Ticket Board
  function renderBoard() {
    updateCounts();

    const filtered = orders.filter(o => {
      if (currentFilter === 'active') {
        return ['pending', 'preparing', 'ready'].includes(o.status);
      }
      return o.status === currentFilter;
    });

    if (filtered.length === 0) {
      elTicketBoard.innerHTML = `
        <div class="empty-kds" style="grid-column: 1 / -1;">
          <div class="empty-kds-icon">👨‍🍳</div>
          <h2>All Caught Up!</h2>
          <p>No tickets currently in "${currentFilter}" state. Fresh orders will arrive automatically.</p>
        </div>
      `;
      return;
    }

    let html = '';
    filtered.forEach(order => {
      const elapsedMin = Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000);
      let urgencyClass = 'normal';
      if (elapsedMin >= 10) urgencyClass = 'urgent';
      else if (elapsedMin >= 5) urgencyClass = 'warning';

      let actionButtonHtml = '';
      if (order.status === 'pending') {
        actionButtonHtml = `
          <button class="btn-action btn-start-prep" onclick="window.updateOrderStatus('${order.id}', 'preparing')">
            ▶ Start Preparing
          </button>
        `;
      } else if (order.status === 'preparing') {
        actionButtonHtml = `
          <button class="btn-action btn-mark-ready" onclick="window.updateOrderStatus('${order.id}', 'ready')">
            ✓ Mark Ready
          </button>
        `;
      } else if (order.status === 'ready') {
        actionButtonHtml = `
          <button class="btn-action btn-mark-served" onclick="window.updateOrderStatus('${order.id}', 'served')">
            ✦ Complete / Served
          </button>
        `;
      } else {
        actionButtonHtml = `
          <div style="font-size: 12px; color: var(--kds-text-dim); text-align: center; width: 100%;">
            Completed at ${new Date(order.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        `;
      }

      let itemsHtml = '';
      order.items.forEach(item => {
        const customText = item.customizations && item.customizations.length > 0
          ? item.customizations.map(c => `${c.optionName}`).join(', ')
          : '';

        itemsHtml += `
          <div class="ticket-item-row">
            <div class="ticket-item-qty">${item.quantity}</div>
            <div class="ticket-item-details">
              <div class="ticket-item-name">${item.image || '☕'} ${item.name}</div>
              ${customText ? `<div class="ticket-item-options">${customText}</div>` : ''}
            </div>
          </div>
        `;
      });

      html += `
        <div class="order-ticket" id="ticket-${order.id}">
          <div class="ticket-strip ${urgencyClass}"></div>
          <div class="ticket-header">
            <div>
              <div class="ticket-table-name">${order.tableName}</div>
              <div class="ticket-meta">#${order.orderNumber} · ${order.customerName} · ${order.paymentMethod.toUpperCase()}</div>
            </div>
            <div class="ticket-timer">
              <div class="timer-badge ${urgencyClass}">
                <span>⏱</span> ${elapsedMin}m ago
              </div>
            </div>
          </div>
          <div class="ticket-items">
            ${itemsHtml}
            ${order.notes ? `<div class="ticket-notes"><strong>Note:</strong> ${order.notes}</div>` : ''}
          </div>
          <div class="ticket-footer">
            ${actionButtonHtml}
          </div>
        </div>
      `;
    });

    elTicketBoard.innerHTML = html;
  }

  function updateCounts() {
    const activeOrders = orders.filter(o => ['pending', 'preparing', 'ready'].includes(o.status));
    const pendingOrders = orders.filter(o => o.status === 'pending');
    const preparingOrders = orders.filter(o => o.status === 'preparing');
    const readyOrders = orders.filter(o => o.status === 'ready');

    elStatActive.textContent = activeOrders.length;
    elCountActive.textContent = activeOrders.length;
    elCountPending.textContent = pendingOrders.length;
    elCountPreparing.textContent = preparingOrders.length;
    elCountReady.textContent = readyOrders.length;
  }

  // Update order status action
  window.updateOrderStatus = async function (orderId, newStatus) {
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      }).then(r => r.json());

      if (res.success) {
        const idx = orders.findIndex(o => o.id === orderId);
        if (idx !== -1) {
          orders[idx] = res.order;
        }
        renderBoard();
      }
    } catch (e) {
      console.error('Failed to update status', e);
    }
  };

  // Tab navigation
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.getAttribute('data-filter');
      renderBoard();
    });
  });

  // Sound toggle
  document.getElementById('btnToggleSound').addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    document.getElementById('soundIcon').textContent = soundEnabled ? '🔔' : '🔕';
    document.getElementById('soundText').textContent = soundEnabled ? 'Sound ON' : 'Sound OFF';
    if (soundEnabled) playOrderChime();
  });

  // Waiter Call dismiss
  elBtnDismissWaiter.addEventListener('click', async () => {
    if (activeWaiterCall) {
      try {
        await fetch(`/api/waiter-calls/${activeWaiterCall.id}/resolve`, { method: 'POST' });
        elWaiterBar.classList.remove('show');
        activeWaiterCall = null;
      } catch (e) {
        elWaiterBar.classList.remove('show');
      }
    }
  });

  // QR Stand Manager Modal
  document.getElementById('btnOpenQrManager').addEventListener('click', async () => {
    const container = document.getElementById('qrCardsContainer');
    container.innerHTML = '<div style="color:var(--kds-text-dim);">Generating high-resolution table QR codes...</div>';
    window.openKdsModal('modalQrManager');

    try {
      const qrPromises = tables.map(t => fetch(`/api/tables/${t.id}/qr`).then(r => r.json()));
      const qrResults = await Promise.all(qrPromises);

      let html = '';
      qrResults.forEach(qr => {
        if (qr.success) {
          html += `
            <div class="qr-print-card">
              <h4>${qr.tableName}</h4>
              <p>Scan to view menu & order</p>
              <img src="${qr.qrDataUrl}" alt="${qr.tableName} QR Code">
              <a href="${qr.targetUrl}" target="_blank">Open Direct Link</a>
            </div>
          `;
        }
      });
      container.innerHTML = html;
    } catch (e) {
      container.innerHTML = '<div style="color:red;">Error loading table QR codes</div>';
    }
  });

  // Stock / 86 Manager Modal
  document.getElementById('btnOpenStockManager').addEventListener('click', () => {
    renderStockManager();
    window.openKdsModal('modalStockManager');
  });

  function renderStockManager() {
    const container = document.getElementById('stockListContainer');
    let html = '';
    menuItems.forEach(item => {
      html += `
        <div style="background: var(--kds-card); border: 1px solid var(--kds-card-border); padding: 12px 18px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; gap: 12px; align-items: center;">
            <div style="font-size: 24px;">${item.image}</div>
            <div>
              <div style="font-weight: 600; color: #fff;">${item.name}</div>
              <div style="font-size: 12px; color: var(--kds-text-dim);">₹${item.price} · ${item.categoryId}</div>
            </div>
          </div>
          <div>
            <button style="background: ${item.inStock ? 'var(--kds-green)' : 'var(--kds-red)'}; color: #0c0907; border: none; padding: 8px 16px; border-radius: 9999px; font-weight: 700; font-size: 12px; cursor: pointer;" onclick="window.toggleItemStock('${item.id}')">
              ${item.inStock ? 'Available' : '86’d (Sold Out)'}
            </button>
          </div>
        </div>
      `;
    });
    container.innerHTML = html;
  }

  window.toggleItemStock = async function (itemId) {
    try {
      const res = await fetch(`/api/menu/${itemId}/toggle-stock`, { method: 'POST' }).then(r => r.json());
      if (res.success) {
        const idx = menuItems.findIndex(i => i.id === itemId);
        if (idx !== -1) {
          menuItems[idx] = res.item;
        }
        renderStockManager();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Modal helpers
  window.openKdsModal = function (id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('open');
  };

  window.closeKdsModal = function (id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('open');
  };

  // Periodically refresh timer elapsed badges
  setInterval(() => {
    renderBoard();
  }, 30000);

  // Init
  loadData();
  initWebSocket();
})();
