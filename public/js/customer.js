/**
 * Aman Patel Cafe — Customer QR Ordering App
 */
(function () {
  'use strict';

  // State
  let tables = [];
  let currentTableId = 1;
  let categories = [];
  let menuItems = [];
  let activeCategory = 'all';
  let searchQuery = '';
  let cart = [];
  let activeOrder = null;
  let selectedPaymentMethod = 'counter';
  let ws = null;

  // Customizer state
  let customizingItem = null;
  let customizerSelectedOptions = [];
  let customizerQuantity = 1;

  // DOM Elements
  const elTableLabel = document.getElementById('tableLabel');
  const elCategoryNav = document.getElementById('categoryNav');
  const elMenuContainer = document.getElementById('menuContainer');
  const elSearchInput = document.getElementById('searchInput');
  const elBottomBar = document.getElementById('bottomBar');
  const elCartCountLabel = document.getElementById('cartCountLabel');
  const elCartTotalLabel = document.getElementById('cartTotalLabel');
  const elBtnOpenCart = document.getElementById('btnOpenCart');
  const elBtnActiveTracker = document.getElementById('btnActiveTracker');

  // Parse Table ID from URL params (e.g. ?table=3)
  function initTableFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const tableParam = params.get('table');
    if (tableParam && !isNaN(parseInt(tableParam, 10))) {
      currentTableId = parseInt(tableParam, 10);
      localStorage.setItem('aman_cafe_table', currentTableId);
    } else {
      const saved = localStorage.getItem('aman_cafe_table');
      if (saved) currentTableId = parseInt(saved, 10);
    }
  }

  // Toast notice helper
  function showToast(message, icon = '✨') {
    const toast = document.getElementById('toast');
    const msg = document.getElementById('toastMsg');
    const ico = document.getElementById('toastIcon');
    if (!toast || !msg) return;

    ico.textContent = icon;
    msg.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3200);
  }

  // Connect WebSocket for real-time order tracking
  function initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    ws = new WebSocket(`${protocol}//${host}`);

    ws.onopen = () => {
      console.log('⚡ Connected to cafe real-time gateway');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.event === 'ORDER_STATUS_CHANGED' && data.payload) {
          if (activeOrder && activeOrder.id === data.payload.id) {
            activeOrder = data.payload;
            renderTrackerView(activeOrder);
            showToast(`Order #${activeOrder.orderNumber} is now: ${activeOrder.status.toUpperCase()}`, '🔔');
          }
        }
        if (data.event === 'MENU_STOCK_CHANGED' && data.payload) {
          const idx = menuItems.findIndex(i => i.id === data.payload.id);
          if (idx !== -1) {
            menuItems[idx] = data.payload;
            renderMenu();
          }
        }
      } catch (err) {
        console.error('WS parse error:', err);
      }
    };

    ws.onclose = () => {
      setTimeout(initWebSocket, 3000);
    };
  }

  // Fetch initial data
  async function loadInitialData() {
    try {
      const [tablesRes, menuRes] = await Promise.all([
        fetch('/api/tables').then(r => r.json()),
        fetch('/api/menu').then(r => r.json())
      ]);

      if (tablesRes.success) {
        tables = tablesRes.tables;
        updateTableDisplay();
      }

      if (menuRes.success) {
        categories = menuRes.categories;
        menuItems = menuRes.items;
        renderCategoryNav();
        renderMenu();
      }

      // Check for previously placed order in session
      const savedOrderId = localStorage.getItem('aman_cafe_active_order');
      if (savedOrderId) {
        try {
          const ordRes = await fetch(`/api/orders/${savedOrderId}`).then(r => r.json());
          if (ordRes.success && ordRes.order) {
            activeOrder = ordRes.order;
            if (activeOrder.status !== 'served' && activeOrder.status !== 'cancelled') {
              elBtnActiveTracker.style.display = 'inline-flex';
            }
          }
        } catch (e) {
          localStorage.removeItem('aman_cafe_active_order');
        }
      }
    } catch (err) {
      console.error('Failed to load data', err);
      showToast('Could not connect to cafe server', '⚠️');
    }
  }

  function updateTableDisplay() {
    const table = tables.find(t => t.id === currentTableId);
    if (table) {
      elTableLabel.textContent = table.name;
    } else {
      elTableLabel.textContent = `Table ${currentTableId}`;
    }
  }

  function renderCategoryNav() {
    let html = `<button class="cat-btn ${activeCategory === 'all' ? 'active' : ''}" data-cat="all">✦ All Items</button>`;
    categories.forEach(cat => {
      html += `<button class="cat-btn ${activeCategory === cat.id ? 'active' : ''}" data-cat="${cat.id}">
        ${cat.icon} ${cat.name}
      </button>`;
    });
    elCategoryNav.innerHTML = html;

    elCategoryNav.querySelectorAll('.cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeCategory = btn.getAttribute('data-cat');
        renderCategoryNav();
        renderMenu();
      });
    });
  }

  function renderMenu() {
    const query = searchQuery.trim().toLowerCase();
    const filteredCategories = activeCategory === 'all'
      ? categories
      : categories.filter(c => c.id === activeCategory);

    let html = '';

    filteredCategories.forEach(cat => {
      const itemsInCat = menuItems.filter(item => {
        const matchesCategory = item.categoryId === cat.id;
        const matchesQuery = !query ||
          item.name.toLowerCase().includes(query) ||
          item.description.toLowerCase().includes(query);
        return matchesCategory && matchesQuery;
      });

      if (itemsInCat.length === 0) return;

      html += `
        <div class="category-group-header">
          <h2>${cat.icon} ${cat.name}</h2>
          <span>${itemsInCat.length} options</span>
        </div>
        <div class="items-grid">
      `;

      itemsInCat.forEach(item => {
        const outOfStock = !item.inStock;
        html += `
          <div class="menu-card ${outOfStock ? 'out-of-stock' : ''}">
            <div class="card-top">
              <div class="card-visual">${item.image || '☕'}</div>
              <div class="card-meta">
                ${item.badge ? `<span class="badge-tag">${item.badge}</span>` : ''}
                <h3>${item.name}</h3>
                <p>${item.description}</p>
              </div>
            </div>
            <div class="card-bottom">
              <div class="card-price">₹${item.price}</div>
              <button class="btn-add" data-id="${item.id}" ${outOfStock ? 'disabled' : ''}>
                ${outOfStock ? 'Sold Out' : (item.customizations && item.customizations.length > 0 ? '+ Customise' : '+ Add')}
              </button>
            </div>
          </div>
        `;
      });

      html += `</div>`;
    });

    if (!html) {
      html = `
        <div style="text-align: center; padding: 60px 20px; color: var(--text-muted);">
          <div style="font-size: 40px; margin-bottom: 12px;">☕</div>
          <h3>No items matched your search</h3>
          <p style="font-size: 13.5px;">Try searching for another specialty or category.</p>
        </div>
      `;
    }

    elMenuContainer.innerHTML = html;

    // Attach click listeners to Add / Customise buttons
    elMenuContainer.querySelectorAll('.btn-add').forEach(btn => {
      btn.addEventListener('click', () => {
        const itemId = btn.getAttribute('data-id');
        const item = menuItems.find(m => m.id === itemId);
        if (item) {
          openCustomizer(item);
        }
      });
    });
  }

  // Customizer Modal Logic
  function openCustomizer(item) {
    customizingItem = item;
    customizerQuantity = 1;
    customizerSelectedOptions = [];

    // Pre-select defaults for required option groups
    if (item.customizations && item.customizations.length > 0) {
      item.customizations.forEach(group => {
        if (group.required && group.options.length > 0) {
          customizerSelectedOptions.push({
            groupName: group.name,
            name: group.options[0].name,
            price: group.options[0].price
          });
        }
      });
    }

    renderCustomizerContent();
    window.openModal('modalCustomizer');
  }

  function renderCustomizerContent() {
    const item = customizingItem;
    document.getElementById('custItemName').textContent = item.name;
    document.getElementById('custQtyDisplay').textContent = customizerQuantity;

    const body = document.getElementById('custBody');
    let html = `
      <div style="display: flex; gap: 14px; align-items: center; margin-bottom: 18px; padding-bottom: 16px; border-bottom: 1px solid var(--border);">
        <div style="font-size: 36px;">${item.image}</div>
        <div>
          <div style="font-size: 14px; color: var(--text-muted);">${item.description}</div>
          <div style="font-size: 18px; color: var(--gold); font-family: var(--font-serif); font-weight: 600; margin-top: 4px;">
            Base Price: ₹${item.price}
          </div>
        </div>
      </div>
    `;

    if (item.customizations && item.customizations.length > 0) {
      item.customizations.forEach((group, gIdx) => {
        html += `
          <div class="cust-group">
            <div class="cust-group-title">
              <span>${group.name}</span>
              <span style="font-size: 11px; opacity: 0.8;">${group.required ? '(Required)' : '(Optional)'}</span>
            </div>
            <div class="cust-options-list">
        `;

        group.options.forEach((opt, oIdx) => {
          const isSelected = customizerSelectedOptions.some(
            so => so.groupName === group.name && so.name === opt.name
          );

          html += `
            <div class="cust-opt-label ${isSelected ? 'selected' : ''}" data-group="${group.name}" data-opt="${opt.name}" data-price="${opt.price}" data-required="${group.required}">
              <div class="cust-opt-info">
                <span>${isSelected ? '●' : '○'}</span>
                <span>${opt.name}</span>
              </div>
              <div class="cust-opt-price">${opt.price > 0 ? `+₹${opt.price}` : 'Free'}</div>
            </div>
          `;
        });

        html += `</div></div>`;
      });
    } else {
      html += `
        <div style="text-align: center; padding: 20px; color: var(--text-muted); font-size: 13.5px;">
          Freshly prepared to perfection. Ready to be added to your order.
        </div>
      `;
    }

    body.innerHTML = html;
    updateCustomizerTotal();

    // Option toggles
    body.querySelectorAll('.cust-opt-label').forEach(optEl => {
      optEl.addEventListener('click', () => {
        const groupName = optEl.getAttribute('data-group');
        const optName = optEl.getAttribute('data-opt');
        const price = parseFloat(optEl.getAttribute('data-price')) || 0;
        const isRequired = optEl.getAttribute('data-required') === 'true';

        if (isRequired) {
          // Single selection
          customizerSelectedOptions = customizerSelectedOptions.filter(so => so.groupName !== groupName);
          customizerSelectedOptions.push({ groupName, name: optName, price });
        } else {
          // Toggle
          const existingIdx = customizerSelectedOptions.findIndex(so => so.groupName === groupName && so.name === optName);
          if (existingIdx > -1) {
            customizerSelectedOptions.splice(existingIdx, 1);
          } else {
            customizerSelectedOptions.push({ groupName, name: optName, price });
          }
        }

        renderCustomizerContent();
      });
    });
  }

  function updateCustomizerTotal() {
    let unitPrice = customizingItem.price;
    customizerSelectedOptions.forEach(opt => {
      unitPrice += opt.price;
    });
    const total = unitPrice * customizerQuantity;
    document.getElementById('custLineTotal').textContent = `₹${total}`;
  }

  // Quantity handlers
  document.getElementById('custQtyMinus').addEventListener('click', () => {
    if (customizerQuantity > 1) {
      customizerQuantity--;
      document.getElementById('custQtyDisplay').textContent = customizerQuantity;
      updateCustomizerTotal();
    }
  });

  document.getElementById('custQtyPlus').addEventListener('click', () => {
    customizerQuantity++;
    document.getElementById('custQtyDisplay').textContent = customizerQuantity;
    updateCustomizerTotal();
  });

  // Add to cart confirm
  document.getElementById('btnConfirmAddToCart').addEventListener('click', () => {
    let unitPrice = customizingItem.price;
    customizerSelectedOptions.forEach(opt => {
      unitPrice += opt.price;
    });

    cart.push({
      id: `cart_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      menuItemId: customizingItem.id,
      name: customizingItem.name,
      image: customizingItem.image,
      unitPrice,
      quantity: customizerQuantity,
      selectedOptions: [...customizerSelectedOptions]
    });

    window.closeModal('modalCustomizer');
    updateCartUI();
    showToast(`Added ${customizingItem.name} to order`, '🥐');
  });

  // Cart UI Update
  function updateCartUI() {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

    if (totalItems > 0 || (activeOrder && activeOrder.status !== 'served')) {
      elBottomBar.style.display = 'block';
    } else {
      elBottomBar.style.display = 'none';
    }

    elCartCountLabel.textContent = `${totalItems} ${totalItems === 1 ? 'item' : 'items'}`;
    elCartTotalLabel.textContent = `₹${subtotal}`;
  }

  // Open Cart Modal
  elBtnOpenCart.addEventListener('click', () => {
    renderCartModal();
    window.openModal('modalCart');
  });

  function renderCartModal() {
    const container = document.getElementById('cartItemsList');
    const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const tax = Math.round(subtotal * 0.05);
    const total = subtotal + tax;

    if (cart.length === 0) {
      container.innerHTML = `
        <div class="cart-empty">
          <div class="cart-empty-icon">☕</div>
          <p>Your order is currently empty</p>
        </div>
      `;
      document.getElementById('checkoutFormArea').style.display = 'none';
      document.getElementById('cartBillSummary').style.display = 'none';
      document.getElementById('btnPlaceOrder').disabled = true;
      return;
    }

    document.getElementById('checkoutFormArea').style.display = 'block';
    document.getElementById('cartBillSummary').style.display = 'flex';
    document.getElementById('btnPlaceOrder').disabled = false;

    let html = '';
    cart.forEach(item => {
      const optionsText = item.selectedOptions.map(o => o.name).join(', ');
      html += `
        <div class="cart-item">
          <div style="font-size: 28px;">${item.image}</div>
          <div class="cart-item-info">
            <div class="cart-item-name">${item.name}</div>
            ${optionsText ? `<div class="cart-item-customizations">${optionsText}</div>` : ''}
            <div style="display: flex; gap: 10px; align-items: center; margin-top: 6px;">
              <span style="font-size: 13px; color: var(--text-muted);">Qty: ${item.quantity}</span>
              <button style="background: none; border: none; color: var(--accent-terracotta); font-size: 12px; cursor: pointer;" onclick="window.removeCartItem('${item.id}')">Remove</button>
            </div>
          </div>
          <div class="cart-item-price">₹${item.unitPrice * item.quantity}</div>
        </div>
      `;
    });

    container.innerHTML = html;
    document.getElementById('billSubtotal').textContent = `₹${subtotal}`;
    document.getElementById('billTax').textContent = `₹${tax}`;
    document.getElementById('billTotal').textContent = `₹${total}`;
  }

  window.removeCartItem = function (id) {
    cart = cart.filter(i => i.id !== id);
    renderCartModal();
    updateCartUI();
  };

  // Payment method selection
  document.querySelectorAll('.pay-btn-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pay-btn-opt').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedPaymentMethod = btn.getAttribute('data-method');
    });
  });

  // Submit Order
  document.getElementById('btnPlaceOrder').addEventListener('click', async () => {
    if (cart.length === 0) return;

    const customerName = document.getElementById('custNameInput').value.trim();
    const notes = document.getElementById('orderNotesInput').value.trim();
    const btn = document.getElementById('btnPlaceOrder');

    btn.disabled = true;
    btn.textContent = 'Sending to Kitchen...';

    try {
      const payload = {
        tableId: currentTableId,
        customerName: customerName || undefined,
        notes,
        paymentMethod: selectedPaymentMethod,
        items: cart.map(i => ({
          menuItemId: i.menuItemId,
          quantity: i.quantity,
          selectedOptions: i.selectedOptions
        }))
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(r => r.json());

      if (res.success && res.order) {
        activeOrder = res.order;
        localStorage.setItem('aman_cafe_active_order', activeOrder.id);
        cart = [];
        updateCartUI();
        window.closeModal('modalCart');

        elBtnActiveTracker.style.display = 'inline-flex';
        renderTrackerView(activeOrder);
        window.openModal('modalTracker');
        showToast(`Order #${activeOrder.orderNumber} sent to kitchen!`, '🎉');
      } else {
        showToast(res.error || 'Failed to place order', '❌');
      }
    } catch (err) {
      console.error(err);
      showToast('Network error while placing order', '❌');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Send Order to Kitchen';
    }
  });

  // Order Tracker view
  elBtnActiveTracker.addEventListener('click', () => {
    if (activeOrder) {
      renderTrackerView(activeOrder);
      window.openModal('modalTracker');
    }
  });

  function renderTrackerView(order) {
    document.getElementById('trackerOrderNumber').textContent = `Order #${order.orderNumber} (${order.tableName})`;

    const steps = ['pending', 'preparing', 'ready', 'served'];
    const currentIdx = steps.indexOf(order.status);

    steps.forEach((st, idx) => {
      const el = document.getElementById(`step-${st}`);
      if (!el) return;
      el.classList.remove('active', 'done');
      if (idx < currentIdx) {
        el.classList.add('done');
      } else if (idx === currentIdx) {
        el.classList.add('active');
      }
    });

    const progressPercent = currentIdx === 0 ? 15 : currentIdx === 1 ? 48 : currentIdx === 2 ? 80 : 100;
    document.getElementById('trackerProgressBar').style.width = `${progressPercent}%`;

    const titleEl = document.getElementById('trackerStatusTitle');
    const descEl = document.getElementById('trackerStatusDesc');
    const iconEl = document.getElementById('trackerIcon');

    if (order.status === 'pending') {
      titleEl.textContent = 'Order Received';
      descEl.textContent = 'Your ticket was received at the bar and is queued for preparation.';
      iconEl.textContent = '📋';
    } else if (order.status === 'preparing') {
      titleEl.textContent = 'Crafting In Progress';
      descEl.textContent = 'The barista & chefs are currently preparing your items.';
      iconEl.textContent = '☕';
    } else if (order.status === 'ready') {
      titleEl.textContent = 'Ready for Serving!';
      descEl.textContent = 'Your order is hot & freshly plated. Staff is bringing it over!';
      iconEl.textContent = '✨';
    } else if (order.status === 'served') {
      titleEl.textContent = 'Served & Enjoyed';
      descEl.textContent = 'We hope you enjoy your visit. Thank you for dining with Aman Patel.';
      iconEl.textContent = '🥐';
    }

    // Items list
    const itemsList = document.getElementById('trackerItemsList');
    let h = '';
    order.items.forEach(it => {
      h += `
        <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed var(--border);">
          <span>${it.quantity}x ${it.name}</span>
          <span style="color: var(--gold);">₹${it.lineTotal}</span>
        </div>
      `;
    });
    h += `
      <div style="display: flex; justify-content: space-between; padding-top: 8px; font-weight: 600;">
        <span>Total</span>
        <span style="color: var(--gold);">₹${order.total}</span>
      </div>
    `;
    itemsList.innerHTML = h;
  }

  // Table selector modal
  document.getElementById('btnTableSelect').addEventListener('click', () => {
    renderTableSelectorModal();
    window.openModal('modalTable');
  });

  function renderTableSelectorModal() {
    const grid = document.getElementById('tableListGrid');
    let html = '';
    tables.forEach(t => {
      const isSelected = t.id === currentTableId;
      html += `
        <button style="background: ${isSelected ? 'var(--gold)' : 'var(--bg-elevated)'}; color: ${isSelected ? '#0c0907' : 'var(--text-main)'}; border: 1px solid ${isSelected ? 'var(--gold)' : 'var(--border)'}; padding: 12px; border-radius: var(--radius-sm); font-size: 13px; font-weight: 600; cursor: pointer;" onclick="window.switchTable(${t.id})">
          ${t.name}
        </button>
      `;
    });
    grid.innerHTML = html;
  }

  window.switchTable = function (id) {
    currentTableId = id;
    localStorage.setItem('aman_cafe_table', currentTableId);
    updateTableDisplay();
    window.closeModal('modalTable');
    showToast(`Switched to Table #${currentTableId}`, '🪑');
  };

  // Staff assistance modal & actions
  document.getElementById('btnCallStaff').addEventListener('click', () => {
    window.openModal('modalStaff');
  });

  window.triggerStaffCall = async function (reason) {
    try {
      const res = await fetch('/api/waiter-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableId: currentTableId,
          reason
        })
      }).then(r => r.json());

      if (res.success) {
        window.closeModal('modalStaff');
        showToast('Server notified! A team member is heading to your table.', '🛎️');
      }
    } catch (e) {
      showToast('Could not send notification', '⚠️');
    }
  };

  // Modal helpers
  window.openModal = function (id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('open');
  };

  window.closeModal = function (id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('open');
  };

  // Search input
  elSearchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderMenu();
  });

  // Init
  initTableFromUrl();
  loadInitialData();
  initWebSocket();
})();
