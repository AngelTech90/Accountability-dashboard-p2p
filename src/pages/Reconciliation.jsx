import React, { useState, useMemo } from 'react';
import { parseBankCSV, reconcileOrders, formatVES } from '../utils/expediente';

export default function Reconciliation({ expediente }) {
  const { orders } = expediente;
  const [bankFiles, setBankFiles]     = useState([]);   // [{name, txs, bank}]
  const [result, setResult]           = useState(null);
  const [error, setError]             = useState(null);
  const [filterView, setFilterView]   = useState('matched');

  // All orders with fiat_amount > 0
  const validOrders = useMemo(() =>
    orders.filter(o => o.fiat_amount > 0),
  [orders]);

  // Merge all bank txs from all uploaded files
  const allBankTxs = useMemo(() =>
    bankFiles.flatMap(f => f.txs),
  [bankFiles]);

  // Re-run reconciliation when bank files or orders change
  const runReconciliation = (txs) => {
    try {
      const res = reconcileOrders(validOrders, txs);
      setResult(res);
      setError(null);
    } catch (err) {
      setError(err.message);
      setResult(null);
    }
  };

  const handleBankUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const txs = parseBankCSV(ev.target.result, file.name);
        const bankType = txs[0]?.bank || 'unknown';
        const newFiles = [...bankFiles, { name: file.name, txs, bank: bankType }];
        setBankFiles(newFiles);
        // Run reconciliation with ALL bank txs
        const allTxs = newFiles.flatMap(f => f.txs);
        runReconciliation(allTxs);
      } catch (err) {
        setError(err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const removeFile = (idx) => {
    const newFiles = bankFiles.filter((_, i) => i !== idx);
    setBankFiles(newFiles);
    if (newFiles.length === 0) {
      setResult(null);
    } else {
      runReconciliation(newFiles.flatMap(f => f.txs));
    }
  };

  const downloadResultCSV = () => {
    if (!result) return;
    const headers = ['Estado','Orden','Tipo','USDT','Precio','Binance Bs','Banco Bs','Signo','Banco','Referencia','Descripcion','Fecha Banco'];
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
        m.bank_tx.is_negative ? '-' : '+',
        m.bank_tx.bank || '',
        m.bank_tx.reference || '',
        (m.bank_tx.description || '').replace(/,/g, ';'),
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
        '', '', '', '', '', '',
      ]);
    });
    result.unmatchedBank.forEach(b => {
      rows.push([
        b.is_negative ? 'Gasto' : 'Sin match Binance',
        '', '', '', '', '',
        b.amount_str,
        b.is_negative ? '-' : '+',
        b.bank || '',
        b.reference || '',
        (b.description || '').replace(/,/g, ';'),
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

  const expenseTotal = result
    ? result.expenses.reduce((s, tx) => s + tx.amount_abs, 0)
    : 0;

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">Conciliación</div>
        <div className="page-sub">BINANCE vs BANCO · BANESCO + MERCANTIL · MATCH POR MONTO BS</div>
      </div>

      {/* Upload + info */}
      <div className="chart-card mb-chart">
        <div style={{ fontSize: 10, color: 'var(--text-2)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
          ◈ Cargar CSV Bancarios
        </div>

        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label className="recon-drop-zone">
              <span style={{ fontSize: 28 }}>🏦</span>
              <span style={{ fontSize: 13, color: 'var(--text-0)', fontWeight: 600 }}>Subir CSV del Banco</span>
              <span style={{ fontSize: 10, color: 'var(--text-3)' }}>Banesco (Cuenta Corriente) o Mercantil (Detalle de Cuenta)</span>
              <input type="file" accept=".csv" onChange={handleBankUpload} hidden />
            </label>

            {/* Loaded files */}
            {bankFiles.length > 0 && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {bankFiles.map((f, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'var(--bg-1)', borderRadius: 'var(--radius-sm)', fontSize: 11 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', overflow: 'hidden' }}>
                      <span style={{ color: f.bank === 'banesco' ? 'var(--blue)' : 'var(--green)', fontWeight: 700, fontSize: 10, textTransform: 'uppercase' }}>
                        {f.bank}
                      </span>
                      <span style={{ color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }} title={f.name}>
                        {f.name}
                      </span>
                      <span style={{ color: 'var(--text-3)' }}>({f.txs.length} txs)</span>
                    </div>
                    <button onClick={() => removeFile(i)} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 14, padding: '0 4px' }}>✕</button>
                  </div>
                ))}
              </div>
            )}
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
                  <span style={{ color: 'var(--text-0)', fontWeight: 600 }}>{allBankTxs.length || '—'}</span>
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
                    <span style={{ color: 'var(--text-2)' }}>Sin match (banco)</span>
                    <span style={{ color: 'var(--text-2)', fontWeight: 700 }}>{result.unmatchedBank.length}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--red)' }}>Gastos detectados</span>
                    <span style={{ color: 'var(--red)', fontWeight: 700 }}>{result.expenses.length} — {formatVES(expenseTotal, true)}</span>
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
          <b style={{ color: 'var(--text-2)' }}>Método:</b> Trunca el último dígito del monto Bs de Binance (3 dec → 2 dec) y compara exacto con el monto bancario (2 dec). Transacciones negativas (-) → compras Binance. Positivas (+) → ventas Binance. Gastos = transacciones negativas sin match.
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="chart-card">
          {/* Tab bar + download */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
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
              <button
                className={`btn ${filterView === 'expenses' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setFilterView('expenses')}
                style={{ fontSize: 10 }}
              >
                Gastos ({result.expenses.length})
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
                    <th>Banco</th>
                    <th>Referencia</th>
                  </tr>
                </thead>
                <tbody>
                  {result.matched.length === 0 && (
                    <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 32 }}>
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
                      <td className="text-green" style={{ fontSize: 11 }}>{m.bank_tx.is_negative ? '-' : ''}{m.bank_bs}</td>
                      <td style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--text-2)' }}>{m.bank_tx.bank || '—'}</td>
                      <td className="text-muted" style={{ fontSize: 10, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          title={m.bank_tx.description || m.bank_tx.reference}>{m.bank_tx.description || m.bank_tx.reference || '—'}</td>
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
                    <th>Signo</th>
                    <th>Monto Bs</th>
                    <th>Banco</th>
                    <th>Descripción</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {result.unmatchedBank.length === 0 && (
                    <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 32 }}>
                      Todas las transacciones bancarias tienen match.
                    </td></tr>
                  )}
                  {result.unmatchedBank.map((b, i) => (
                    <tr key={i}>
                      <td className="text-muted">{b.id}</td>
                      <td style={{ fontWeight: 700, color: b.is_negative ? 'var(--red)' : 'var(--green)' }}>
                        {b.is_negative ? '−' : '+'}
                      </td>
                      <td style={{ fontWeight: 600, color: b.is_negative ? 'var(--red)' : 'var(--green)' }}>{b.amount_str}</td>
                      <td style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--text-2)' }}>{b.bank || '—'}</td>
                      <td className="text-muted" style={{ fontSize: 10, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          title={b.description || b.reference}>{b.description || b.reference || '—'}</td>
                      <td className="text-muted" style={{ fontSize: 10 }}>{b.date || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Expenses (unmatched negative bank txs) */}
          {filterView === 'expenses' && (
            <div>
              <div style={{ marginBottom: 12, padding: '10px 14px', background: 'var(--bg-1)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--text-2)' }}>Total Gastos Detectados</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, color: 'var(--red)' }}>
                  {formatVES(expenseTotal)}
                </span>
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Monto Bs</th>
                      <th>Banco</th>
                      <th>Descripción</th>
                      <th>Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.expenses.length === 0 && (
                      <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 32 }}>
                        Sin gastos detectados. Todas las transacciones negativas tienen match con compras Binance.
                      </td></tr>
                    )}
                    {result.expenses.map((b, i) => (
                      <tr key={i}>
                        <td className="text-muted">{b.id}</td>
                        <td className="text-red" style={{ fontWeight: 600 }}>-{b.amount_str}</td>
                        <td style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--text-2)' }}>{b.bank || '—'}</td>
                        <td className="text-muted" style={{ fontSize: 10, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            title={b.description || b.reference}>{b.description || b.reference || '—'}</td>
                        <td className="text-muted" style={{ fontSize: 10 }}>{b.date || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div style={{ marginTop: 8, color: 'var(--text-3)', fontSize: 10 }}>
            {filterView === 'matched' && `${result.matched.length} órdenes conciliadas`}
            {filterView === 'unmatched_orders' && `${result.unmatchedOrders.length} órdenes sin match bancario`}
            {filterView === 'unmatched_bank' && `${result.unmatchedBank.length} transacciones bancarias sin match`}
            {filterView === 'expenses' && `${result.expenses.length} gastos detectados — transacciones negativas sin match con compras Binance`}
          </div>
        </div>
      )}

      {/* No data state */}
      {!result && !error && (
        <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: '40px 20px', fontSize: 12 }}>
          Carga primero un expediente de Binance (Órdenes) y luego sube los CSVs bancarios (Banesco y/o Mercantil) para conciliar.
        </div>
      )}
    </div>
  );
}
