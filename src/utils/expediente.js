export const EMPTY_EXPEDIENTE = {
  chat_id: '',
  date: new Date().toISOString().slice(0, 10),
  orders: [],
  cycles: [],
  stats: {},
  bank_receipts: []
};

export function emptyOrder(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    order_number: '',
    order_type: 'buy',
    usdt_amount: 0,
    fiat_amount: 0,
    unit_price: 0,
    commission_usdt: 0,
    is_pago_movil: false,
    is_expense: false,
    payment_method: '',
    counterparty: '',
    created_at: new Date().toISOString(),
    source: 'manual',
    ...overrides
  };
}

export function parseSpanishNumber(str) {
  if (typeof str === 'number') return str;
  if (!str) return 0;
  const s = String(str).trim().replace(/\s/g, '');
  if (s.includes(',') && s.includes('.')) {
    const lastDot = s.lastIndexOf('.');
    const lastComma = s.lastIndexOf(',');
    return lastComma > lastDot
      ? parseFloat(s.replace(/\./g, '').replace(',', '.'))
      : parseFloat(s.replace(/,/g, ''));
  }
  if (s.includes(',')) return parseFloat(s.replace(',', '.'));
  return parseFloat(s) || 0;
}

export function formatVES(n, short = false) {
  if (n === null || n === undefined) return '—';
  const v = parseFloat(n);
  if (isNaN(v)) return '—';
  if (short && Math.abs(v) >= 1_000_000) return `Bs. ${(v / 1_000_000).toFixed(2)}M`;
  if (short && Math.abs(v) >= 1_000) return `Bs. ${(v / 1_000).toFixed(1)}K`;
  return `Bs. ${v.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatUSDT(n) {
  if (n === null || n === undefined) return '—';
  const v = parseFloat(n);
  if (isNaN(v)) return '—';
  return `${v.toFixed(4)} USDT`;
}

export function formatUSDTShort(n) {
  if (n === null || n === undefined) return '—';
  return `${parseFloat(n).toFixed(2)}`;
}

export function computeCommission(order) {
  const base = 0.0025;
  const pmExtra = 0.003;
  if (order.order_type === 'sell') return order.usdt_amount * base;
  return order.usdt_amount * (base + (order.is_pago_movil ? pmExtra : 0));
}

export function computeCycles(orders) {
  const completed = orders.filter(o => !o.is_expense && o.usdt_amount > 0);
  const sells = completed
    .filter(o => o.order_type === 'sell')
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const buys = completed.filter(o => o.order_type === 'buy');

  return sells.map((sell, i) => {
    const nextSell = sells[i + 1];
    const cycleBuys = buys.filter(b => {
      const bt = new Date(b.created_at);
      const st = new Date(sell.created_at);
      const nt = nextSell ? new Date(nextSell.created_at) : new Date('2099-01-01');
      return bt >= st && bt < nt;
    });
    const totalBought = cycleBuys.reduce((s, b) => s + b.usdt_amount, 0);
    const coverage = sell.usdt_amount > 0 ? Math.min(totalBought / sell.usdt_amount, 1) : 0;
    const sellRevenue = sell.usdt_amount * sell.unit_price;
    const buyCost = cycleBuys.reduce((s, b) => s + b.usdt_amount * b.unit_price, 0);
    const sellComm = computeCommission(sell);
    const buyComm = cycleBuys.reduce((s, b) => s + computeCommission(b), 0);
    const profit_usdt = sell.usdt_amount - totalBought - sellComm - buyComm;
    const profit_ves = sellRevenue - buyCost;

    return {
      sell_order_number: sell.order_number,
      sell_usdt: sell.usdt_amount,
      sell_price: sell.unit_price,
      sell_at: sell.created_at,
      buy_orders: cycleBuys.map(b => b.order_number || b.id),
      total_bought: totalBought,
      coverage_pct: coverage * 100,
      profit_usdt,
      profit_ves,
      sell_commission: sellComm,
      buy_commission: buyComm
    };
  });
}

export function computeStats(orders) {
  const active = orders.filter(o => !o.is_expense);
  const sells = active.filter(o => o.order_type === 'sell');
  const buys = active.filter(o => o.order_type === 'buy');
  const expenses = orders.filter(o => o.is_expense);

  const totalSellUSDT = sells.reduce((s, o) => s + o.usdt_amount, 0);
  const totalBuyUSDT = buys.reduce((s, o) => s + o.usdt_amount, 0);
  const totalSellVES = sells.reduce((s, o) => s + o.usdt_amount * o.unit_price, 0);
  const totalBuyVES = buys.reduce((s, o) => s + o.usdt_amount * o.unit_price, 0);
  const totalCommission = orders.reduce((s, o) => s + computeCommission(o), 0);
  const expenseUSDT = expenses.reduce((s, o) => s + o.usdt_amount, 0);

  const cycles = computeCycles(orders);
  const totalProfitUSDT = cycles.reduce((s, c) => s + c.profit_usdt, 0);
  const totalProfitVES = cycles.reduce((s, c) => s + c.profit_ves, 0);

  return {
    order_count: orders.length,
    sell_count: sells.length,
    buy_count: buys.length,
    expense_count: expenses.length,
    total_sell_usdt: totalSellUSDT,
    total_buy_usdt: totalBuyUSDT,
    total_sell_ves: totalSellVES,
    total_buy_ves: totalBuyVES,
    total_commission: totalCommission,
    expense_usdt: expenseUSDT,
    net_profit_usdt: totalProfitUSDT,
    net_profit_ves: totalProfitVES,
    avg_buy_price: totalBuyUSDT > 0 ? totalBuyVES / totalBuyUSDT : 0,
    avg_sell_price: totalSellUSDT > 0 ? totalSellVES / totalSellUSDT : 0,
    spread: (totalSellUSDT > 0 && totalBuyUSDT > 0)
      ? (totalSellVES / totalSellUSDT) - (totalBuyVES / totalBuyUSDT)
      : 0
  };
}

export function validateExpediente(data) {
  if (!data || typeof data !== 'object') return false;
  if (!Array.isArray(data.orders)) return false;
  return true;
}

export function enrichExpediente(data) {
  const orders = (data.orders || []).map(o => ({
    ...emptyOrder(),
    ...o,
    id: o.id || o.order_number || crypto.randomUUID()
  }));
  const cycles = computeCycles(orders);
  const stats = computeStats(orders);
  return { ...EMPTY_EXPEDIENTE, ...data, orders, cycles, stats };
}
