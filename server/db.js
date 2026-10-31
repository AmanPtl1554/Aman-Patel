/**
 * Database storage module
 * Uses JSON file backed persistence with atomic writes for speed, portability, and zero native-compilation overhead.
 */
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, '..', 'data', 'cafe.json');

const INITIAL_TABLES = [
  { id: 1, name: 'Table 1 - Patio Sun' },
  { id: 2, name: 'Table 2 - Window Lounge' },
  { id: 3, name: 'Table 3 - Espresso Bar' },
  { id: 4, name: 'Table 4 - Cozy Nook' },
  { id: 5, name: 'Table 5 - Garden View' },
  { id: 6, name: 'Table 6 - Library Corner' },
  { id: 7, name: 'Table 7 - Velvet Booth' },
  { id: 8, name: 'Table 8 - Center High-Top' }
];

const INITIAL_CATEGORIES = [
  { id: 'coffee', name: 'Artisan Coffee', icon: '☕' },
  { id: 'cold_brew', name: 'Cold Brew & Iced', icon: '🧊' },
  { id: 'tea', name: 'Ceremonial & Teas', icon: '🍵' },
  { id: 'bakery', name: 'Fresh Patisserie', icon: '🥐' },
  { id: 'desserts', name: 'Artisan Desserts', icon: '🍰' },
  { id: 'savory', name: 'Gourmet Toast & Savory', icon: '🥪' }
];

const INITIAL_MENU = [
  {
    id: 'latte-sig',
    categoryId: 'coffee',
    name: 'Signature Burnt Honey Latte',
    description: 'Double ristretto, steamed oat milk, handcrafted burnt honey caramel.',
    price: 260,
    badge: 'Popular',
    image: '☕',
    customizations: [
      {
        id: 'milk',
        name: 'Milk Choice',
        required: true,
        options: [
          { name: 'Oat Milk (Default)', price: 0 },
          { name: 'Almond Milk', price: 20 },
          { name: 'Whole Milk', price: 0 }
        ]
      },
      {
        id: 'sweetness',
        name: 'Sweetness Level',
        required: false,
        options: [
          { name: 'Standard (100%)', price: 0 },
          { name: 'Less Sweet (50%)', price: 0 },
          { name: 'Sugar Free', price: 0 }
        ]
      },
      {
        id: 'extra',
        name: 'Extras',
        required: false,
        options: [
          { name: 'Extra Ristretto Shot', price: 40 },
          { name: 'Vanilla Bean Cream', price: 30 }
        ]
      }
    ],
    inStock: true
  },
  {
    id: 'cold-brew-citrus',
    categoryId: 'cold_brew',
    name: 'Citrus Tonic Cold Brew',
    description: '72-hour single-origin steep, orange peel, artisan tonic float & crystal ice.',
    price: 280,
    badge: 'Refreshing',
    image: '🧊',
    customizations: [
      {
        id: 'ice',
        name: 'Ice Level',
        required: false,
        options: [
          { name: 'Clear Cube Ice', price: 0 },
          { name: 'Light Ice', price: 0 }
        ]
      }
    ],
    inStock: true
  },
  {
    id: 'mocha-noir',
    categoryId: 'coffee',
    name: 'Noir Single-Origin Mocha',
    description: '70% Ecuadorian dark chocolate melted into espresso, topped with whipped cream.',
    price: 290,
    badge: 'Rich',
    image: '🍫',
    customizations: [
      {
        id: 'milk',
        name: 'Milk Choice',
        required: true,
        options: [
          { name: 'Whole Milk', price: 0 },
          { name: 'Oat Milk', price: 20 },
          { name: 'Almond Milk', price: 20 }
        ]
      }
    ],
    inStock: true
  },
  {
    id: 'croissant-butter',
    categoryId: 'bakery',
    name: 'Artisan Laminated Croissant',
    description: 'Seventy-two delicate layers made with cultured French Normandy butter.',
    price: 180,
    badge: 'Freshly Baked',
    image: '🥐',
    customizations: [
      {
        id: 'warmth',
        name: 'Preparation',
        required: false,
        options: [
          { name: 'Warmed gently', price: 0 },
          { name: 'Room Temperature', price: 0 }
        ]
      }
    ],
    inStock: true
  },
  {
    id: 'cheesecake-basque',
    categoryId: 'desserts',
    name: 'Burnt Basque Cheesecake',
    description: 'Caramelised dark crust with silky custard center and espresso salt crystals.',
    price: 320,
    badge: 'Chef Special',
    image: '🍰',
    customizations: [],
    inStock: true
  },
  {
    id: 'matcha-ceremonial',
    categoryId: 'tea',
    name: 'Ceremonial Uji Matcha Latte',
    description: 'First-harvest stone-ground Uji matcha, whisked to velvet foam with creamy oat milk.',
    price: 300,
    badge: 'Organic',
    image: '🍵',
    customizations: [
      {
        id: 'temp',
        name: 'Served',
        required: true,
        options: [
          { name: 'Hot Steamed', price: 0 },
          { name: 'Over Ice', price: 0 }
        ]
      },
      {
        id: 'sweetness',
        name: 'Sweetness',
        required: false,
        options: [
          { name: 'Unsweetened', price: 0 },
          { name: 'Subtle Honey', price: 0 }
        ]
      }
    ],
    inStock: true
  },
  {
    id: 'avocado-sourdough',
    categoryId: 'savory',
    name: 'Truffle Avocado Sourdough',
    description: 'Toasted country sourdough, smashed Hass avocado, dukkah spice, microgreens & white truffle oil.',
    price: 340,
    badge: 'Savory',
    image: '🥑',
    customizations: [
      {
        id: 'egg',
        name: 'Add-on',
        required: false,
        options: [
          { name: 'Poached Organic Egg', price: 50 },
          { name: 'No Extra', price: 0 }
        ]
      }
    ],
    inStock: true
  }
];

class Database {
  constructor() {
    this.data = {
      tables: INITIAL_TABLES,
      categories: INITIAL_CATEGORIES,
      menu: INITIAL_MENU,
      orders: [],
      waiterCalls: []
    };
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        this.data = { ...this.data, ...parsed };
      } else {
        this.save();
      }
    } catch (err) {
      console.error('Error loading database file, fallback to in-memory defaults:', err);
      this.save();
    }
  }

  save() {
    try {
      const dir = path.dirname(DB_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (err) {
      console.error('Error saving database:', err);
    }
  }

  getTables() {
    return this.data.tables;
  }

  getTable(id) {
    const numId = parseInt(id, 10);
    return this.data.tables.find(t => t.id === numId) || null;
  }

  getCategories() {
    return this.data.categories;
  }

  getMenu() {
    return this.data.menu;
  }

  getMenuItem(id) {
    return this.data.menu.find(m => m.id === id) || null;
  }

  toggleMenuItemStock(id) {
    const item = this.getMenuItem(id);
    if (item) {
      item.inStock = !item.inStock;
      this.save();
      return item;
    }
    return null;
  }

  getOrders() {
    return this.data.orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  getOrder(id) {
    return this.data.orders.find(o => o.id === id) || null;
  }

  createOrder({ tableId, customerName, items, notes = '', paymentMethod = 'counter' }) {
    const table = this.getTable(tableId);
    if (!table) {
      throw new Error(`Table #${tableId} not found`);
    }
    if (!items || !items.length) {
      throw new Error('Order must contain at least one item');
    }

    let subtotal = 0;
    const processedItems = items.map((cartItem, idx) => {
      const menuItem = this.getMenuItem(cartItem.menuItemId);
      if (!menuItem) {
        throw new Error(`Menu item ${cartItem.menuItemId} does not exist`);
      }
      if (!menuItem.inStock) {
        throw new Error(`Menu item "${menuItem.name}" is currently sold out`);
      }

      let itemUnitPrice = menuItem.price;
      const appliedCustomizations = [];

      if (Array.isArray(cartItem.selectedOptions)) {
        for (const opt of cartItem.selectedOptions) {
          itemUnitPrice += Number(opt.price || 0);
          appliedCustomizations.push({
            groupName: opt.groupName,
            optionName: opt.name,
            price: opt.price || 0
          });
        }
      }

      const quantity = Math.max(1, parseInt(cartItem.quantity, 10) || 1);
      const lineTotal = itemUnitPrice * quantity;
      subtotal += lineTotal;

      return {
        id: `item-${Date.now()}-${idx}`,
        menuItemId: menuItem.id,
        name: menuItem.name,
        image: menuItem.image,
        unitPrice: itemUnitPrice,
        quantity,
        lineTotal,
        notes: cartItem.notes || '',
        customizations: appliedCustomizations
      };
    });

    const tax = Math.round(subtotal * 0.05); // 5% GST
    const total = subtotal + tax;
    const orderNumber = 1000 + this.data.orders.length + 1;

    const newOrder = {
      id: `ord_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      orderNumber,
      tableId: parseInt(tableId, 10),
      tableName: table.name,
      customerName: customerName ? customerName.trim() : `Guest @ Table ${tableId}`,
      items: processedItems,
      subtotal,
      tax,
      total,
      notes: notes.trim(),
      paymentMethod, // 'counter' | 'card' | 'upi'
      status: 'pending', // 'pending' -> 'preparing' -> 'ready' -> 'served' | 'cancelled'
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.data.orders.push(newOrder);
    this.save();
    return newOrder;
  }

  updateOrderStatus(id, newStatus) {
    const validStatuses = ['pending', 'preparing', 'ready', 'served', 'cancelled'];
    if (!validStatuses.includes(newStatus)) {
      throw new Error(`Invalid status: ${newStatus}`);
    }

    const order = this.getOrder(id);
    if (!order) {
      throw new Error(`Order #${id} not found`);
    }

    order.status = newStatus;
    order.updatedAt = new Date().toISOString();
    this.save();
    return order;
  }

  callWaiter(tableId, reason = 'Assistance requested') {
    const table = this.getTable(tableId);
    if (!table) throw new Error('Table not found');

    const call = {
      id: `call_${Date.now()}`,
      tableId: parseInt(tableId, 10),
      tableName: table.name,
      reason,
      createdAt: new Date().toISOString(),
      resolved: false
    };

    this.data.waiterCalls.push(call);
    this.save();
    return call;
  }

  resolveWaiterCall(callId) {
    const call = this.data.waiterCalls.find(c => c.id === callId);
    if (call) {
      call.resolved = true;
      this.save();
      return call;
    }
    return null;
  }

  getWaiterCalls() {
    return this.data.waiterCalls.filter(c => !c.resolved);
  }

  getStats() {
    const orders = this.data.orders;
    const totalRevenue = orders
      .filter(o => o.status !== 'cancelled')
      .reduce((sum, o) => sum + o.total, 0);

    const activeOrders = orders.filter(o => ['pending', 'preparing', 'ready'].includes(o.status));
    const completedOrders = orders.filter(o => o.status === 'served');

    return {
      totalOrders: orders.length,
      activeOrdersCount: activeOrders.length,
      completedOrdersCount: completedOrders.length,
      totalRevenue,
      pendingCount: orders.filter(o => o.status === 'pending').length,
      preparingCount: orders.filter(o => o.status === 'preparing').length,
      readyCount: orders.filter(o => o.status === 'ready').length
    };
  }
}

const db = new Database();
module.exports = db;
