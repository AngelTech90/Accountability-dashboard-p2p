import React, { useState, useMemo } from 'react';
import { parseBankCSV, reconcileOrders } from '../utils/expediente';

export default function Reconciliation({ expediente }) {
  const { orders } = expediente;
  const [bankTxs, setBankTxs] = useState(null);
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState(null);
  const [filterView, setFilterView] = useState('matched'); // matched | unmatched_orders | unmatched_bank

  // Only completed orders with fiat_amount > 0
  const validOrders = useMemo(() =>
    orders.filter(o => !o.is_expense && o.fiat_amount > 0),
  [orders]);

  const handleBankUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const txs = parseBankCSV(ev.target.result);
        setBankTxs(txs);
        setError(null);
        // Auto-run reconciliation
        const res = reconcileOrders(validOrders, txs);
        setResult(res);
      } catch (err) {
        setError(err.message);
        setBankTxs(null);
        setResult(null);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const downloadResultCSV = () => {
    if (!result) return;
    const headers = ['Estado','Orden','Tipo','USDT','Precio','Binance Bs','Banco Bs','Referencia','Fecha Banco'];
    const rows = [];
    result.matched.forEach(m => {
      rows.push([
        'Matched',
        m.order.order_number || '',
        m.order.order_type === 'sell' ? 'Sell' : 'Buy',
        (m.order.usdt_amount || 0).toFixed(2),
        (m.order.unit_price || 0).toFixed(3),
        m.binance_bs,
        m.bank_bs,
        m.bank_tx.reference || '',
        m.bank_tx.date || '',
      ]);
    });
    result.unmatchedOrders.forEach(u => {
      rows.push([
        'Sin match banco',
        u.order.order_number || '',
        u.order.order_type === 'sell' ? 'Sell' : 'Buy',
        (u.order.usdt_amount || 0).toFixed(2),
        (u.order.unit_price || 0).toFixed(3),
        u.binance_bs,
        '', '', '',
      ]);
    });
    result.unmatchedBank.forEach(b => {
      rows.push([
        'Sin match Binance',
        '', '', '', '',
        '',
        b.amount_str,
        b.reference || '',
        b.date || '',
      ]);
    });
    const csvText = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: `reconciliacion_${new Date().toISOString().slice(0,10)}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">Conciliación</div>
        <div className="page-sub">BINANCE vs BANCO · MATCH POR MONTO BS</div>
      </div>

      {/* Upload + info */}
      <div className="chart-card mb-chart">
        <div style={{ fontSize: 10, color: 'var(--text-2)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
          ◈ Cargar CSV Bancario
        </div>

        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label className="recon-drop-zone">
              <span style={{ fontSize: 28 }}>🏦</span>
              <span style={{ fontSize: 13, color: 'var(--text-0)', fontWeight: 600 }}>Subir CSV del Banco</span>
              <span style={{ fontSize: 10, color: 'var(--text-3)' }}>Archivo de movimientos bancarios</span>
              <input type="file" accept=".csv" onChange={handleBankUpload} hidden />
            </label>
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ background: 'var(--bg-1)', borderRadius: 'var(--radius-md)', padding: 14 }}>
              <div style={{ fontSize: 10, color: 'var(--text-2)', letterSpacing: '0.1em', marginBottom: 8 }}>ESTADO</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-2)' }}>Órdenes Binance</span>
                  <span style={{ color: 'var(--text-0)', fontWeight: 600 }}>{validOrders.length}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-2)' }}>Transacciones Banco</span>
                  <span style={{ color: 'var(--text-0)', fontWeight: 600 }}>{bankTxs ? bankTxs.length : '—'}</span>
                </div>
                {result && <>
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 6, display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--green)' }}>Matched</span>
                    <span style={{ color: 'var(--green)', fontWeight: 700 }}>{result.matched.length}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--amber)' }}>Sin match (órdenes)</span>
                    <span style={{ color: 'var(--amber)', fontWeight: 700 }}>{result.unmatchedOrders.length}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--red)' }}>Sin match (banco)</span>
                    <span style={{ color: 'var(--red)', fontWeight: 700 }}>{result.unmatchedBank.length}</span>
                  </div>
                </>}
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--red-bg)', border: '1px solid var(--red-dim)', borderRadius: 'var(--radius-md)', fontSize: 12, color: 'var(--red)' }}>
            {error}
          </div>
        )}

        <div style={{ marginTop: 12, fontSize: 10, color: 'var(--text-3)', lineHeight: 1.6 }}>
          <b style={{ color: 'var(--text-2)' }}>Método:</b> Trunca el último dígito del monto Bs de Binance (3 dec → 2 dec) y compara exacto con el monto bancario (2 dec). Solo órdenes Completed con método de pago.
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="chart-card">
          {/* Tab bar + download */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                className={`btn ${filterView === 'matched' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setFilterView('matched')}
                style={{ fontSize: 10 }}
              >
                Matched ({result.matched.length})
              </button>
              <button
                className={`btn ${filterView === 'unmatched_orders' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setFilterView('unmatched_orders')}
                style={{ fontSize: 10 }}
              >
                Sin Match Órdenes ({result.unmatchedOrders.length})
              </button>
              <button
                className={`btn ${filterView === 'unmatched_bank' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setFilterView('unmatched_bank')}
                style={{ fontSize: 10 }}
              >
                Sin Match Banco ({result.unmatchedBank.length})
              </button>
            </div>
            <button className="btn btn-ghost" onClick={downloadResultCSV} style={{ fontSize: 10 }}>↓ Exportar Resultado</button>
          </div>

          {/* Matched table */}
          {filterView === 'matched' && (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>N° Orden</th>
                    <th>USDT</th>
                    <th>Precio</th>
                    <th>Binance Bs</th>
                    <th>Banco Bs</th>
                    <th>Referencia</th>
                  </tr>
                </thead>
                <tbody>
                  {result.matched.length === 0 && (
                    <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 32 }}>
                      Sin coincidencias encontradas.
                    </td></tr>
                  )}
                  {result.matched.map((m, i) => (
                    <tr key={i}>
                      <td>
                        <span className={`badge ${m.order.order_type === 'buy' ? 'badge-buy' : 'badge-sell'}`}>
                          {m.order.order_type === 'buy' ? 'Buy' : 'Sell'}
                        </span>
                      </td>
                      <td style={{ fontSize: 10, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          title={m.order.order_number}>{m.order.order_number || '—'}</td>
                      <td className="text-blue">{(m.order.usdt_amount || 0).toFixed(2)}</td>
                      <td>{(m.order.unit_price || 0).toLocaleString('es-VE')}</td>
                      <td style={{ fontSize: 11 }}>{m.truncated_bs}</td>
                      <td className="text-green" style={{ fontSize: 11 }}>{m.bank_bs}</td>
                      <td className="text-muted" style={{ fontSize: 10, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          title={m.bank_tx.reference}>{m.bank_tx.reference || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Unmatched orders */}
          {filterView === 'unmatched_orders' && (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>N° Orden</th>
                    <th>USDT</th>
                    <th>Precio</th>
                    <th>Binance Bs (3 dec)</th>
                    <th>Truncado (2 dec)</th>
                  </tr>
                </thead>
                <tbody>
                  {result.unmatchedOrders.length === 0 && (
                    <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 32 }}>
                      Todas las órdenes tienen match bancario.
                    </td></tr>
                  )}
                  {result.unmatchedOrders.map((u, i) => (
                    <tr key={i}>
                      <td>
                        <span className={`badge ${u.order.order_type === 'buy' ? 'badge-buy' : 'badge-sell'}`}>
                          {u.order.order_type === 'buy' ? 'Buy' : 'Sell'}
                        </span>
                      </td>
                      <td style={{ fontSize: 10, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          title={u.order.order_number}>{u.order.order_number || '—'}</td>
                      <td className="text-blue">{(u.order.usdt_amount || 0).toFixed(2)}</td>
                      <td>{(u.order.unit_price || 0).toLocaleString('es-VE')}</td>
                      <td className="text-amber" style={{ fontSize: 11 }}>{u.binance_bs}</td>
                      <td className="text-muted" style={{ fontSize: 11 }}>{u.truncated_bs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Unmatched bank */}
          {filterView === 'unmatched_bank' && (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Monto Bs</th>
                    <th>Referencia</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {result.unmatchedBank.length === 0 && (
                    <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 32 }}>
                      Todas las transacciones bancarias tienen match.
                    </td></tr>
                  )}
                  {result.unmatchedBank.map((b, i) => (
                    <tr key={i}>
                      <td className="text-muted">{b.id}</td>
                      <td className="text-red" style={{ fontWeight: 600 }}>{b.amount_str}</td>
                      <td className="text-muted" style={{ fontSize: 10, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          title={b.reference}>{b.reference || '—'}</td>
                      <td className="text-muted" style={{ fontSize: 10 }}>{b.date || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ marginTop: 8, color: 'var(--text-3)', fontSize: 10 }}>
            {filterView === 'matched' && `${result.matched.length} órdenes conciliadas`}
            {filterView === 'unmatched_orders' && `${result.unmatchedOrders.length} órdenes sin match bancario`}
            {filterView === 'unmatched_bank' && `${result.unmatchedBank.length} transacciones bancarias sin match`}
          </div>
        </div>
      )}

      {/* No data state */}
      {!result && !error && (
        <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: '40px 20px', fontSize: 12 }}>
          Carga primero un expediente de Binance (Órdenes) y luego sube el CSV bancario para conciliar.
        </div>
      )}
    </div>
  );
}
