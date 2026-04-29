// ─── Field normalizers ────────────────────────────────────────────────────────

export const EMPTY_EXPEDIENTE = {
  chat_id: '', date: new Date().toISOString().slice(0,10),
  orders: [], cycles: [], stats: {}, bank_receipts: []
};

export function emptyOrder(overrides={}) {
  return {
    id: crypto.randomUUID(),
    order_number: '', order_type: 'buy',
    usdt_amount: 0, fiat_amount: 0, unit_price: 0, commission_usdt: 0,
    is_pago_movil: false, is_expense: false, is_direct: false,
    payment_method: '', counterparty: '', created_at: new Date().toISOString(),
    source: 'manual', ...overrides
  };
}

// Normalize order_type from any source to 'buy' | 'sell'
function normalizeType(raw) {
  if (!raw) return 'buy';
  const s = String(raw).toLowerCase().trim();
  // Spanish from bot JSON: 'vender', 'comprar'
  // English from CSV/manual: 'buy', 'sell'
  if (s === 'vender' || s === 'sell')   return 'sell';
  if (s === 'comprar' || s === 'buy')   return 'buy';
  return 'buy';
}

// Normalize a raw order (from any source) into canonical shape
function normalizeOrder(raw) {
  const id = raw.id || raw.order_number || crypto.randomUUID();
  const order_type = normalizeType(raw.order_type);
  return {
    id,
    order_number:   raw.order_number   || '',
    order_type,
    usdt_amount:    parseFloat(raw.usdt_amount  || raw.Cantidad || 0),
    fiat_amount:    parseFloat(raw.fiat_amount  || raw['Precio Total'] || 0),
    unit_price:     parseFloat(raw.unit_price   || raw.Precio || 0),
    commission_usdt:parseFloat(raw.commission_usdt || raw['Tarifa de creador'] || raw['Comisión de tomador'] || 0),
    is_pago_movil:  !!raw.is_pago_movil,
    is_expense:     !!raw.is_expense,
    is_direct:      !!raw.is_direct,
    payment_method: raw.payment_method || raw.bank || '',
    counterparty:   raw.counterparty   || raw.counterpart || raw.Contraparte || '',
    created_at:     raw.created_at || raw.timestamp || raw['Hora de creación'] || new Date().toISOString(),
    source:         raw.source || 'import',
  };
}

// ─── Cycle normalization ──────────────────────────────────────────────────────
// Bot produces cycles with rich data already. We just normalize field names.
// If cycles are missing (manual JSON or CSV import), we compute them.

function normalizeCycle(c, idx) {
  // Bot cycle shape → our UI shape
  // profit field: net_profit_usdt | profit_usdt
  const profit_usdt = parseFloat(c.net_profit_usdt ?? c.profit_usdt ?? 0);
  const profit_ves  = parseFloat(c.net_profit_ves  ?? c.profit_ves  ?? 0);
  const sell_usdt   = parseFloat(c.sell_usdt ?? 0);
  const matched     = parseFloat(c.matched_usdt ?? c.total_bought ?? 0);
  const coverage_pct = sell_usdt > 0 ? (matched / sell_usdt) * 100 : 0;

  // buy_orders: bot stores as uid strings like "4de58a4d_0"
  // we keep them as-is, the UI will use per_order_profit for display
  return {
    cycle_id:        c.cycle_id ?? (idx + 1),
    sell_order:      c.sell_order || c.sell_order_number || '',
    buy_orders:      c.buy_orders || [],
    per_order_profit:c.per_order_profit || [],
    sell_usdt,
    sell_price:      parseFloat(c.sell_price ?? 0),
    total_bought:    matched,
    coverage_pct:    parseFloat(c.match_ratio != null ? c.match_ratio * 100 : coverage_pct),
    profit_usdt,
    profit_ves,
    sell_commission: parseFloat(c.sell_commission ?? 0),
    buy_commission:  parseFloat(c.buy_commission  ?? 0),
    is_partial:      !!c.is_partial,
    completed_at:    c.completed_at || '',
    note:            c.note || null,
  };
}

// ─── Compute cycles from orders (when JSON has none) ─────────────────────────
// Uses xlsx-model math: commission applied to VES total (sell) and USDT total (buy).
// Coverage capped at 100+profit_pct%. Excess buys redistributed to earlier incomplete cycles.
export function computeCycles(orders) {
  const sells = orders.filter(o => o.order_type === 'sell')
    .sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
  const buys  = orders.filter(o => o.order_type === 'buy')
    .sort((a,b) => new Date(a.created_at) - new Date(b.created_at));

  const usedBuyIds  = new Set();
  const overflowBuys = [];

  // ── Phase 1: assign buys by time window, cap by VES budget ──
  const rawCycles = sells.map((sell, i) => {
    const nextSell = sells[i + 1];
    const st = new Date(sell.created_at);
    const nt = nextSell ? new Date(nextSell.created_at) : new Date('2099-01-01');

    const windowBuys = buys.filter(b => {
      if (usedBuyIds.has(b.id)) return false;
      const bt = new Date(b.created_at);
      return bt >= st && bt < nt;
    });

    // VES budget = max VES available from this sell (xlsx model)
    const sellCommRate = sell.is_direct ? 0 : 0.0025;
    const vesBudget = sell.usdt_amount * sell.unit_price * (1 - sellCommRate);

    let vesSpent = 0;
    const cycleBuys = [];

    for (const b of windowBuys) {
      const buyCostVES = b.fiat_amount || (b.usdt_amount * b.unit_price);
      usedBuyIds.add(b.id);
      if (vesSpent + buyCostVES <= vesBudget) {
        cycleBuys.push(b);
        vesSpent += buyCostVES;
      } else {
        overflowBuys.push(b);
      }
    }

    return { sell, cycleBuys, sellCommRate, vesBudget, vesSpent, idx: i };
  });

  // ── Phase 2: redistribute overflow to earlier incomplete cycles ──
  for (const raw of rawCycles) {
    if (overflowBuys.length === 0) break;
    const remainingBudget = raw.vesBudget - raw.vesSpent;
    if (remainingBudget <= 0) continue;

    const stillOverflow = [];
    for (const b of overflowBuys) {
      const buyCostVES = b.fiat_amount || (b.usdt_amount * b.unit_price);
      if (raw.vesSpent + buyCostVES <= raw.vesBudget) {
        raw.cycleBuys.push(b);
        raw.vesSpent += buyCostVES;
      } else {
        stillOverflow.push(b);
      }
    }
    overflowBuys.length = 0;
    overflowBuys.push(...stillOverflow);
  }

  // ── Phase 3: build final cycle objects with xlsx math ──
  return rawCycles.map((raw, i) => {
    const { sell, cycleBuys, sellCommRate } = raw;
    const totalBought = cycleBuys.reduce((s, b) => s + b.usdt_amount, 0);
    const sellComm    = sell.usdt_amount * sellCommRate;

    // Effective VES per USDT sold (after sell commission)
    const effSellVesPerUsdt = sell.unit_price * (1 - sellCommRate);

    // Per-order profit using xlsx model:
    // profit = USDT_received_after_buy_comm − USDT_equivalent_sold
    const per_order_profit = cycleBuys.map(b => {
      const buyCommRate    = 0.0025 + (b.is_pago_movil ? 0.003 : 0);
      const usdtReceived   = b.usdt_amount * (1 - buyCommRate);
      const usdtSoldPortion = (b.usdt_amount * b.unit_price) / effSellVesPerUsdt;
      const profit_usdt    = usdtReceived - usdtSoldPortion;
      const profit_ves     = b.usdt_amount * (sell.unit_price - b.unit_price);
      const profit_pct     = usdtSoldPortion > 0 ? (profit_usdt / usdtSoldPortion) * 100 : 0;
      const buyComm        = b.usdt_amount * buyCommRate;
      return {
        order_uid:      b.order_number || b.id,
        usdt_amount:    b.usdt_amount,
        buy_price:      b.unit_price,
        profit_usdt:    parseFloat(profit_usdt.toFixed(4)),
        profit_ves:     parseFloat(profit_ves.toFixed(2)),
        profit_pct:     parseFloat(profit_pct.toFixed(3)),
        buy_commission: parseFloat(buyComm.toFixed(4)),
      };
    });

    const profit_usdt = per_order_profit.reduce((s, p) => s + p.profit_usdt, 0);
    const profit_ves  = per_order_profit.reduce((s, p) => s + p.profit_ves,  0);
    const buyComm     = per_order_profit.reduce((s, p) => s + p.buy_commission, 0);

    // Coverage capped at 100 + profit_pct%
    const rawCoverage    = sell.usdt_amount > 0 ? (totalBought / sell.usdt_amount) * 100 : 0;
    const cycleProfitPct = sell.usdt_amount > 0 ? (profit_usdt / sell.usdt_amount) * 100 : 0;
    const maxCoverage    = 100 + cycleProfitPct;
    const coverage_pct   = Math.min(rawCoverage, maxCoverage);

    return {
      cycle_id:        i + 1,
      sell_order:      sell.order_number || sell.id,
      buy_orders:      cycleBuys.map(b => b.order_number || b.id),
      per_order_profit,
      sell_usdt:       sell.usdt_amount,
      sell_price:      sell.unit_price,
      total_bought:    totalBought,
      coverage_pct:    parseFloat(coverage_pct.toFixed(2)),
      profit_usdt:     parseFloat(profit_usdt.toFixed(4)),
      profit_ves:      parseFloat(profit_ves.toFixed(2)),
      sell_commission: parseFloat(sellComm.toFixed(4)),
      buy_commission:  parseFloat(buyComm.toFixed(4)),
      is_partial:      coverage_pct < 99.5,
      completed_at:    sell.created_at,
      note:            null,
    };
  });
}

// ─── Compute stats ────────────────────────────────────────────────────────────
export function computeStats(orders, cycles) {
  const active   = orders.filter(o => !o.is_expense);
  const sells    = active.filter(o => o.order_type === 'sell');
  const buys     = active.filter(o => o.order_type === 'buy');
  const expenses = orders.filter(o => o.is_expense);

  const totalSellUSDT = sells.reduce((s,o) => s + o.usdt_amount, 0);
  const totalBuyUSDT  = buys.reduce((s,o)  => s + o.usdt_amount, 0);
  const totalSellVES  = sells.reduce((s,o) => s + o.usdt_amount * o.unit_price, 0);
  const totalBuyVES   = buys.reduce((s,o)  => s + o.usdt_amount * o.unit_price, 0);
  const totalComm     = orders.reduce((s,o) => s + (o.commission_usdt || 0), 0);
  const expenseUSDT   = expenses.reduce((s,o) => s + o.usdt_amount, 0);

  const usedCycles = cycles && cycles.length ? cycles : computeCycles(orders);
  const totalProfitUSDT = usedCycles.reduce((s,c) => s + (c.profit_usdt || 0), 0);
  const totalProfitVES  = usedCycles.reduce((s,c) => s + (c.profit_ves  || 0), 0);

  return {
    order_count: orders.length, sell_count: sells.length,
    buy_count: buys.length, expense_count: expenses.length,
    total_sell_usdt: totalSellUSDT, total_buy_usdt: totalBuyUSDT,
    total_sell_ves:  totalSellVES,  total_buy_ves:  totalBuyVES,
    total_commission: totalComm,    expense_usdt:   expenseUSDT,
    net_profit_usdt: totalProfitUSDT, net_profit_ves: totalProfitVES,
    avg_buy_price:  totalBuyUSDT  > 0 ? totalBuyVES  / totalBuyUSDT  : 0,
    avg_sell_price: totalSellUSDT > 0 ? totalSellVES / totalSellUSDT : 0,
    spread: (totalSellUSDT > 0 && totalBuyUSDT > 0)
      ? (totalSellVES/totalSellUSDT) - (totalBuyVES/totalBuyUSDT) : 0,
  };
}

// ─── Validate & enrich any imported expediente ────────────────────────────────
export function validateExpediente(data) {
  return data && typeof data === 'object' && Array.isArray(data.orders);
}

export function enrichExpediente(data) {
  // Normalize all orders regardless of source
  const orders = (data.orders || []).map(normalizeOrder);

  // Use cycles from JSON if they exist AND have profit data, else compute
  let cycles;
  if (Array.isArray(data.cycles) && data.cycles.length > 0 &&
      data.cycles[0].net_profit_usdt != null) {
    // Rich bot cycles — normalize field names for UI
    cycles = data.cycles.map((c,i) => normalizeCycle(c,i));
  } else if (Array.isArray(data.cycles) && data.cycles.length > 0) {
    // Partial UI cycles — normalize
    cycles = data.cycles.map((c,i) => normalizeCycle(c,i));
  } else {
    // No cycles — compute from orders
    cycles = computeCycles(orders);
  }

  const stats = computeStats(orders, cycles);
  return {
    ...EMPTY_EXPEDIENTE,
    chat_id:       data.chat_id || data.member || '',
    date:          data.date || new Date().toISOString().slice(0,10),
    bank_receipts: data.bank_receipts || [],
    orders, cycles, stats,
  };
}

// ─── CSV Parser (Binance C2C export) ─────────────────────────────────────────
export function parseCSV(text) {
  const lines = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n');
  if (lines.length < 2) throw new Error('CSV vacío o sin datos');

  // Strip BOM from first line
  const headerLine = lines[0].replace(/^\ufeff/, '');
  const headers = headerLine.split(',').map(h => h.trim());

  const COL = {
    order_number: headers.findIndex(h => /pedido|order.?id|número/i.test(h)),
    order_type:   headers.findIndex(h => /tipo.de.orden|order.?type/i.test(h)),
    fiat_amount:  headers.findIndex(h => /precio.total|total/i.test(h)),
    unit_price:   headers.findIndex(h => /^precio$|^price$/i.test(h)),
    usdt_amount:  headers.findIndex(h => /^cantidad$|^amount$|quantity/i.test(h)),
    commission:   headers.findIndex(h => /comisión|commission|tarifa/i.test(h)),
    counterparty: headers.findIndex(h => /contraparte|counterpart/i.test(h)),
    status:       headers.findIndex(h => /estado|status/i.test(h)),
    created_at:   headers.findIndex(h => /hora|time|fecha/i.test(h)),
  };

  const orders = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(',');

    const status = COL.status >= 0 ? cols[COL.status]?.trim() : '';
    // Only keep completed orders when status column is detected
    if (COL.status >= 0 && !/complet/i.test(status)) continue;

    const rawType = COL.order_type >= 0 ? cols[COL.order_type]?.trim() : '';
    const order_type = normalizeType(rawType);

    // Parse date: "26-04-06 17:35:02" → "2026-04-06T17:35:02"
    let created_at = COL.created_at >= 0 ? cols[COL.created_at]?.trim() : '';
    if (/^\d{2}-\d{2}-\d{2}/.test(created_at)) {
      const [datePart, timePart] = created_at.split(' ');
      const [yy, mm, dd] = datePart.split('-');
      created_at = `20${yy}-${mm}-${dd}T${timePart || '00:00:00'}`;
    }

    const usdt_amount = parseFloat(cols[COL.usdt_amount]) || 0;

    // Commission: use whichever commission column has a value
    let commission_usdt = 0;
    for (let j = 0; j < headers.length; j++) {
      if (/comis|tarifa/i.test(headers[j]) && cols[j]?.trim()) {
        const v = parseFloat(cols[j]);
        if (!isNaN(v) && v > 0) { commission_usdt = v; break; }
      }
    }

    // Pago Móvil detection from CSV: if commission rate > 0.40% it's PM
    // Base buy rate = 0.25%, PM rate = 0.55% (+0.30%)
    // No payment_method column exists in Binance CSV export
    const comm_rate = usdt_amount > 0 ? (commission_usdt / usdt_amount) : 0;
    const is_pago_movil = order_type === 'buy' && comm_rate > 0.004; // 0.4% threshold

    orders.push(normalizeOrder({
      order_number:   COL.order_number >= 0 ? cols[COL.order_number]?.trim() : '',
      order_type,
      usdt_amount,
      fiat_amount:    COL.fiat_amount  >= 0 ? parseFloat(cols[COL.fiat_amount])  || 0 : 0,
      unit_price:     COL.unit_price   >= 0 ? parseFloat(cols[COL.unit_price])   || 0 : 0,
      commission_usdt,
      is_pago_movil,
      counterparty:   COL.counterparty >= 0 ? cols[COL.counterparty]?.trim() : '',
      is_expense: false,
      created_at,
      source: 'csv',
    }));
  }

  if (orders.length === 0) throw new Error('No se encontraron órdenes válidas en el CSV');
  const cycles = computeCycles(orders);
  const stats  = computeStats(orders, cycles);
  return { chat_id:'', date: new Date().toISOString().slice(0,10), orders, cycles, stats, bank_receipts:[] };
}

// ─── CSV Exporter ─────────────────────────────────────────────────────────────
export function exportCSV(orders) {
  const headers = [
    'Número de Pedido','Tipo de orden','Activo','Tipo de Fiat',
    'Precio Total','Precio','Cantidad','Tarifa de creador',
    'Contraparte','Estado','Hora de creación'
  ];
  const rows = orders.map(o => [
    o.order_number || '',
    o.order_type === 'sell' ? 'Sell' : 'Buy',
    'USDT', 'VES',
    (o.fiat_amount || 0).toFixed(2),
    (o.unit_price  || 0).toFixed(3),
    (o.usdt_amount || 0).toFixed(2),
    (o.commission_usdt || 0).toFixed(4),
    o.counterparty || '',
    'Completed',
    o.created_at ? o.created_at.replace('T',' ').slice(0,19) : '',
  ]);
  return [headers, ...rows].map(r => r.join(',')).join('\n');
}

// ─── Formatters ───────────────────────────────────────────────────────────────
export function formatVES(n, short=false) {
  if (n == null || isNaN(n)) return '—';
  const v = parseFloat(n);
  if (short && Math.abs(v) >= 1_000_000) return `Bs. ${(v/1_000_000).toFixed(2)}M`;
  if (short && Math.abs(v) >= 1_000)     return `Bs. ${(v/1_000).toFixed(1)}K`;
  return `Bs. ${v.toLocaleString('es-VE',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
}
export function formatUSDTShort(n) {
  if (n == null || isNaN(n)) return '—';
  return parseFloat(n).toFixed(2);
}

// ─── Bank CSV Parser ──────────────────────────────────────────────────────────
// Supports two formats:
//   Banesco: "Cuenta Corriente xxxx2414..." → SEP=, header, quoted fields, "Bs. -1.500,00"
//   Mercantil: "Detalle_de_cuenta_0105..." → plain CSV, amounts like -18388 or -25144.22
// Preserves original sign: negative = money OUT (buy target), positive = money IN (sell target).

// Parse a single quoted-CSV line (handles commas inside quoted fields)
function parseQuotedCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === ',' && !inQuotes) { fields.push(current.trim()); current = ''; continue; }
    current += ch;
  }
  fields.push(current.trim());
  return fields;
}

// Detect bank type from filename or content
function detectBankType(text, filename) {
  const fn = (filename || '').toLowerCase();
  if (fn.includes('cuenta corriente') || fn.includes('xxxx2414') || fn.includes('banesco'))
    return 'banesco';
  if (fn.includes('detalle_de_cuenta') || fn.includes('mercantil'))
    return 'mercantil';
  // Fallback: detect from content
  const first = text.split('\n')[0] || '';
  if (/^SEP=/i.test(first)) return 'banesco';
  if (/Monto\s+Bs/i.test(first)) return 'mercantil';
  return 'unknown';
}

// Parse Banesco amount: "Bs. -1.500,00" → -1500.00
function parseBanescoAmount(raw) {
  // Remove "Bs." prefix and whitespace
  let s = raw.replace(/^Bs\.?\s*/i, '').trim();
  // Detect sign
  const neg = s.startsWith('-');
  const pos = s.startsWith('+');
  if (neg || pos) s = s.slice(1).trim();
  // Remove thousands dots, replace decimal comma with dot
  s = s.replace(/\./g, '').replace(',', '.');
  const val = parseFloat(s);
  if (isNaN(val)) return NaN;
  return neg ? -val : val;
}

// Parse Mercantil amount: plain number like -18388 or -25144.22
function parseMercantilAmount(raw) {
  const s = raw.replace(/[^0-9.,-]/g, '');
  return parseFloat(s);
}

// Detect if description indicates Pago Movil
function isPagoMovilDesc(desc) {
  return /pago\s*m[oó]vil|PAGO\s*MOVIL/i.test(desc || '');
}

export function parseBankCSV(text, filename) {
  const bankType = detectBankType(text, filename);
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  if (lines.length < 2) throw new Error('CSV bancario vacío');

  const transactions = [];

  if (bankType === 'banesco') {
    // Banesco: first line "SEP=,", second line headers, then quoted data
    let headerIdx = 0;
    if (/^SEP=/i.test(lines[0])) headerIdx = 1;
    const headers = parseQuotedCSVLine(lines[headerIdx]);
    const montoIdx = headers.findIndex(h => /monto/i.test(h));
    const fechaIdx = headers.findIndex(h => /fecha/i.test(h));
    const refIdx   = headers.findIndex(h => /referencia/i.test(h));
    const descIdx  = headers.findIndex(h => /descripci[oó]n|descripcion/i.test(h));
    if (montoIdx < 0) throw new Error('No se encontró columna MONTO en CSV Banesco');

    for (let i = headerIdx + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const cols = parseQuotedCSVLine(line);
      const rawAmount = cols[montoIdx] || '';
      const amount = parseBanescoAmount(rawAmount);
      if (isNaN(amount) || amount === 0) continue;
      const desc = descIdx >= 0 ? (cols[descIdx] || '') : '';

      transactions.push({
        id: i,
        amount,                                     // signed: negative=out, positive=in
        amount_abs: Math.abs(amount),
        amount_str: Math.abs(amount).toFixed(2),
        is_negative: amount < 0,
        reference: refIdx >= 0 ? (cols[refIdx] || '') : '',
        description: desc,
        date: fechaIdx >= 0 ? (cols[fechaIdx] || '') : '',
        is_pago_movil: isPagoMovilDesc(desc),
        bank: 'banesco',
        raw_line: line,
      });
    }
  } else {
    // Mercantil (or unknown): Tipo,Fecha,Referencia,Descripción,Monto Bs.
    const headerLine = lines[0].replace(/^\ufeff/, '');
    const headers = headerLine.split(',').map(h => h.trim());
    const montoIdx = headers.findIndex(h => /monto/i.test(h));
    const fechaIdx = headers.findIndex(h => /fecha/i.test(h));
    const refIdx   = headers.findIndex(h => /referencia/i.test(h));
    const descIdx  = headers.findIndex(h => /descripci[oó]n|descripcion/i.test(h));
    if (montoIdx < 0) throw new Error('No se encontró columna de monto en CSV bancario');

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const cols = line.split(',');
      const rawAmount = (cols[montoIdx] || '').trim();
      const amount = parseMercantilAmount(rawAmount);
      if (isNaN(amount) || amount === 0) continue;
      const desc = descIdx >= 0 ? (cols[descIdx] || '').trim() : '';

      transactions.push({
        id: i,
        amount,
        amount_abs: Math.abs(amount),
        amount_str: Math.abs(amount).toFixed(2),
        is_negative: amount < 0,
        reference: refIdx >= 0 ? (cols[refIdx] || '').trim() : '',
        description: desc,
        date: fechaIdx >= 0 ? (cols[fechaIdx] || '').trim() : '',
        is_pago_movil: isPagoMovilDesc(desc),
        bank: 'mercantil',
        raw_line: line,
      });
    }
  }

  if (transactions.length === 0) throw new Error('No se encontraron transacciones válidas');
  return transactions;
}

// ─── Reconciliation: match Binance orders with bank transactions ──────────────
// Rules:
//   1. Negative bank txs (-) → match ONLY with Binance BUY orders
//   2. Positive bank txs (+) → match ONLY with Binance SELL orders
//   3. Fiat amount match: bank 2 decimals must match Binance 3 decimals minus last digit
//      e.g. bank -12340.12 matches Binance buy order 12340.124 (truncate last digit → 12340.12)
//   4. Unmatched negative bank txs = real expenses (atemporal)
export function reconcileOrders(orders, bankTransactions) {
  const matched   = [];
  const unmatchedOrders = [];
  const usedBankIds     = new Set();

  // Separate bank txs by sign for directional matching
  const negBankTxs = bankTransactions.filter(tx => tx.is_negative);
  const posBankTxs = bankTransactions.filter(tx => !tx.is_negative);

  // Build lookup maps keyed by absolute amount string (2 decimals)
  const negByAmount = new Map();
  negBankTxs.forEach(tx => {
    const key = tx.amount_str;
    if (!negByAmount.has(key)) negByAmount.set(key, []);
    negByAmount.get(key).push(tx);
  });
  const posByAmount = new Map();
  posBankTxs.forEach(tx => {
    const key = tx.amount_str;
    if (!posByAmount.has(key)) posByAmount.set(key, []);
    posByAmount.get(key).push(tx);
  });

  for (const order of orders) {
    // Truncate Binance fiat_amount: remove last digit of 3-decimal string
    const fiatStr3  = (order.fiat_amount || 0).toFixed(3); // e.g. "15289.678"
    const truncated = fiatStr3.slice(0, -1);                // e.g. "15289.67"

    // Direction: buy orders match negative bank txs, sell orders match positive
    const lookup = order.order_type === 'buy' ? negByAmount : posByAmount;
    const candidates = lookup.get(truncated) || [];
    const match = candidates.find(c => !usedBankIds.has(c.id));

    if (match) {
      usedBankIds.add(match.id);
      matched.push({
        order,
        bank_tx: match,
        binance_bs: fiatStr3,
        bank_bs: match.amount_str,
        truncated_bs: truncated,
      });
    } else {
      unmatchedOrders.push({ order, binance_bs: fiatStr3, truncated_bs: truncated });
    }
  }

  // Remaining unmatched bank transactions
  const unmatchedBank = bankTransactions.filter(tx => !usedBankIds.has(tx.id));

  // Expenses: unmatched negative bank txs that never matched a buy order
  const expenses = unmatchedBank.filter(tx => tx.is_negative);

  return { matched, unmatchedOrders, unmatchedBank, expenses };
}
