import React, { useState, useMemo } from 'react';
import { emptyOrder, formatVES } from '../utils/expediente';

function computeCommission(order) {
  const base = 0.0025;
  const pmExtra = 0.003;
  if (order.order_type === 'sell') return order.usdt_amount * base;
  return order.usdt_amount * (base + (order.is_pago_movil ? pmExtra : 0));
}

function OrderModal({ order, onSave, onClose }) {
  const [form, setForm] = useState({ ...order });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleaned = {
      ...form,
      usdt_amount: parseFloat(form.usdt_amount) || 0,
      fiat_amount: parseFloat(form.fiat_amount) || 0,
      unit_price: parseFloat(form.unit_price) || 0,
      commission_usdt: parseFloat(form.commission_usdt) || 0
    };
    onSave(cleaned);
  };

  const autoComm = computeCommission(form);

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">{form.id && form.order_number ? 'Editar Orden' : 'Nueva Orden'}</div>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Tipo</label>
              <select className="form-select" value={form.order_type} onChange={e => set('order_type', e.target.value)}>
                <option value="buy">Buy — Compra</option>
                <option value="sell">Sell — Venta</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">N° de Orden</label>
              <input className="form-input" value={form.order_number} onChange={e => set('order_number', e.target.value)} placeholder="22874..." />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Cantidad USDT</label>
              <input className="form-input" type="number" step="0.0001" value={form.usdt_amount} onChange={e => set('usdt_amount', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Precio (Bs/USDT)</label>
              <input className="form-input" type="number" step="0.001" value={form.unit_price} onChange={e => {
                const p = parseFloat(e.target.value) || 0;
                set('unit_price', e.target.value);
                set('fiat_amount', (parseFloat(form.usdt_amount) || 0) * p);
              }} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Monto Fiat (Bs)</label>
              <input className="form-input" type="number" step="0.01" value={form.fiat_amount} onChange={e => set('fiat_amount', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Comisión USDT <span style={{color:'#5f7399'}}>(auto: {autoComm.toFixed(4)})</span></label>
              <input className="form-input" type="number" step="0.0001" value={form.commission_usdt} onChange={e => set('commission_usdt', e.target.value)} placeholder={autoComm.toFixed(4)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Contraparte</label>
              <input className="form-input" value={form.counterparty} onChange={e => set('counterparty', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Método de Pago</label>
              <select className="form-select" value={form.payment_method} onChange={e => set('payment_method', e.target.value)}>
                <option value="">— Seleccionar —</option>
                <option value="Pago Movil">Pago Móvil</option>
                <option value="Mercantil">Mercantil</option>
                <option value="Banesco">Banesco</option>
                <option value="BNC">BNC</option>
                <option value="Bancamiga">Bancamiga</option>
                <option value="BDV">BDV</option>
                <option value="Directa">Directa</option>
              </select>
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label">Hora de Creación</label>
            <input className="form-input" type="datetime-local" value={form.created_at ? form.created_at.slice(0, 16) : ''} onChange={e => set('created_at', e.target.value + ':00')} />
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div className="checkbox-row">
              <input type="checkbox" id="pm" checked={!!form.is_pago_movil} onChange={e => set('is_pago_movil', e.target.checked)} />
              <label htmlFor="pm">Pago Móvil (+0.30% comisión)</label>
            </div>
            <div className="checkbox-row">
              <input type="checkbox" id="exp" checked={!!form.is_expense} onChange={e => set('is_expense', e.target.checked)} />
              <label htmlFor="exp">Es Gasto (excluir de ciclos)</label>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary">Guardar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function OrdersTable({ expediente, onUpdateOrders, showToast }) {
  const { orders } = expediente;
  const [modal, setModal] = useState(null); // null | { mode: 'new'|'edit', order }
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [sortKey, setSortKey] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');

  const filtered = useMemo(() => {
    let list = [...orders];
    if (filterType !== 'all') {
      if (filterType === 'expense') list = list.filter(o => o.is_expense);
      else list = list.filter(o => o.order_type === filterType && !o.is_expense);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(o =>
        (o.order_number || '').includes(q) ||
        (o.counterparty || '').toLowerCase().includes(q) ||
        (o.payment_method || '').toLowerCase().includes(q) ||
        String(o.usdt_amount).includes(q)
      );
    }
    list.sort((a, b) => {
      let av = a[sortKey] ?? '', bv = b[sortKey] ?? '';
      if (sortKey === 'created_at') { av = new Date(av); bv = new Date(bv); }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [orders, search, filterType, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortIcon = ({ k }) => sortKey === k ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';

  const saveOrder = (order) => {
    let newOrders;
    if (modal.mode === 'new') {
      newOrders = [...orders, order];
      showToast('✓ Orden creada', 'ok');
    } else {
      newOrders = orders.map(o => o.id === order.id ? order : o);
      showToast('✓ Orden actualizada', 'ok');
    }
    onUpdateOrders(newOrders);
    setModal(null);
  };

  const deleteOrder = (id) => {
    if (!window.confirm('¿Eliminar esta orden?')) return;
    onUpdateOrders(orders.filter(o => o.id !== id));
    showToast('Orden eliminada', 'ok');
  };

  const duplicateOrder = (order) => {
    const dup = { ...order, id: crypto.randomUUID(), order_number: '', source: 'manual' };
    onUpdateOrders([...orders, dup]);
    showToast('Orden duplicada — edita el número', 'ok');
  };

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">Órdenes</div>
        <div className="page-sub">{orders.length} REGISTROS TOTALES</div>
      </div>

      <div className="table-toolbar">
        <input className="search-input" placeholder="Buscar por nº, contraparte, método..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className="form-select" style={{width:'auto',padding:'8px 10px'}} value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="all">Todas</option>
          <option value="buy">Compras</option>
          <option value="sell">Ventas</option>
          <option value="expense">Gastos</option>
        </select>
        <div style={{ marginLeft: 'auto' }}>
          <button className="btn btn-primary" onClick={() => setModal({ mode: 'new', order: emptyOrder() })}>
            + Nueva Orden
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th onClick={() => toggleSort('order_type')} style={{cursor:'pointer'}}>Tipo<SortIcon k="order_type" /></th>
              <th onClick={() => toggleSort('created_at')} style={{cursor:'pointer'}}>Hora<SortIcon k="created_at" /></th>
              <th>N° Orden</th>
              <th onClick={() => toggleSort('usdt_amount')} style={{cursor:'pointer'}}>USDT<SortIcon k="usdt_amount" /></th>
              <th onClick={() => toggleSort('unit_price')} style={{cursor:'pointer'}}>Precio<SortIcon k="unit_price" /></th>
              <th>Monto Bs</th>
              <th>Comisión</th>
              <th>Contraparte</th>
              <th>Método</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={10} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 40 }}>
                Sin órdenes. Carga un expediente o crea una nueva.
              </td></tr>
            )}
            {filtered.map(o => {
              const ts = o.created_at ? new Date(o.created_at) : null;
              const dateStr = ts ? `${ts.getFullYear()}-${String(ts.getMonth()+1).padStart(2,'0')}-${String(ts.getDate()).padStart(2,'0')} ${String(ts.getHours()).padStart(2,'0')}:${String(ts.getMinutes()).padStart(2,'0')}` : '—';
              return (
                <tr key={o.id}>
                  <td>
                    {o.is_expense
                      ? <span className="badge badge-expense">Gasto</span>
                      : o.order_type === 'buy'
                        ? <span className="badge badge-buy">Buy</span>
                        : <span className="badge badge-sell">Sell</span>}
                    {o.is_pago_movil && <span className="badge badge-pm" style={{marginLeft:4}}>PM</span>}
                  </td>
                  <td className="text-muted" style={{fontSize:10, whiteSpace:'nowrap'}}>{dateStr}</td>
                  <td style={{fontSize:10, maxWidth:140, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}} title={o.order_number}>{o.order_number || '—'}</td>
                  <td className={o.order_type === 'sell' ? 'text-green' : 'text-blue'}>{(o.usdt_amount || 0).toFixed(2)}</td>
                  <td>{(o.unit_price || 0).toLocaleString('es-VE')}</td>
                  <td className="text-muted">{formatVES(o.fiat_amount, true)}</td>
                  <td className="text-muted">{(o.commission_usdt || computeCommission(o)).toFixed(4)}</td>
                  <td style={{maxWidth:100, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}} title={o.counterparty}>{o.counterparty || '—'}</td>
                  <td className="text-muted">{o.payment_method || '—'}</td>
                  <td style={{whiteSpace:'nowrap'}}>
                    <button className="action-btn" title="Duplicar" onClick={() => duplicateOrder(o)}>⧉</button>
                    <button className="action-btn" title="Editar" onClick={() => setModal({ mode: 'edit', order: { ...o } })}>✎</button>
                    <button className="action-btn del" title="Eliminar" onClick={() => deleteOrder(o.id)}>✕</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 8, color: 'var(--text-3)', fontSize: 10 }}>
        Mostrando {filtered.length} de {orders.length} órdenes
      </div>

      {modal && (
        <OrderModal
          order={modal.order}
          onSave={saveOrder}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
