import React, { useMemo, useState } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import { formatVES, formatUSDTShort } from '../utils/expediente';

export default function CyclesView({ expediente }) {
  const { orders, cycles } = expediente;
  const [selected, setSelected] = useState(null);

  const profitBarData = useMemo(() => ({
    labels: cycles.map((_, i) => `Ciclo ${i + 1}`),
    datasets: [
      {
        label: 'Profit USDT',
        data: cycles.map(c => parseFloat((c.profit_usdt || 0).toFixed(4))),
        backgroundColor: cycles.map(c => c.profit_usdt >= 0 ? 'rgba(0,229,160,0.65)' : 'rgba(255,76,106,0.65)'),
        borderColor: cycles.map(c => c.profit_usdt >= 0 ? '#00e5a0' : '#ff4c6a'),
        borderWidth: 1, borderRadius: 5
      }
    ]
  }), [cycles]);

  const coverageLineData = useMemo(() => ({
    labels: cycles.map((_, i) => `C${i + 1}`),
    datasets: [{
      label: 'Cobertura %',
      data: cycles.map(c => parseFloat((c.coverage_pct || 0).toFixed(1))),
      borderColor: '#ffb547', backgroundColor: 'rgba(255,181,71,0.1)',
      fill: true, tension: 0.35, pointRadius: 5, pointBackgroundColor: '#ffb547'
    }]
  }), [cycles]);

  const cumulativeProfitData = useMemo(() => {
    let cumulative = 0;
    const data = cycles.map(c => {
      cumulative += c.profit_usdt || 0;
      return parseFloat(cumulative.toFixed(4));
    });
    return {
      labels: cycles.map((_, i) => `C${i + 1}`),
      datasets: [{
        label: 'Profit Acumulado USDT',
        data,
        borderColor: '#b06dff', backgroundColor: 'rgba(176,109,255,0.1)',
        fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#b06dff'
      }]
    };
  }, [cycles]);

  const OPTS = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { mode: 'index', intersect: false }
    },
    scales: {
      x: { grid: { color: '#2a3550' }, ticks: { color: '#5f7399', font: { family: "'Space Mono'" } } },
      y: { grid: { color: '#2a3550' }, ticks: { color: '#5f7399', font: { family: "'Space Mono'" } } }
    }
  };

  const selCycle = selected !== null ? cycles[selected] : null;
  const selBuyOrders = selCycle
    ? orders.filter(o => o.order_type === 'buy' && selCycle.buy_orders.includes(o.order_number || o.id))
    : [];

  const totalProfit = cycles.reduce((s, c) => s + (c.profit_usdt || 0), 0);
  const totalProfitVES = cycles.reduce((s, c) => s + (c.profit_ves || 0), 0);
  const avgCoverage = cycles.length > 0 ? cycles.reduce((s, c) => s + (c.coverage_pct || 0), 0) / cycles.length : 0;

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">Ciclos P2P</div>
        <div className="page-sub">{cycles.length} CICLOS DETECTADOS · MODELO VENTANA TEMPORAL</div>
      </div>

      <div className="stat-grid">
        <div className="stat-card stat-green">
          <div className="stat-label">Profit Total Ciclos</div>
          <div className="stat-value">{formatUSDTShort(totalProfit)} USDT</div>
          <div className="stat-sub">{formatVES(totalProfitVES, true)}</div>
        </div>
        <div className="stat-card stat-blue">
          <div className="stat-label">Ciclos con Profit</div>
          <div className="stat-value">{cycles.filter(c => c.profit_usdt > 0).length}</div>
          <div className="stat-sub">de {cycles.length} ciclos</div>
        </div>
        <div className="stat-card stat-amber">
          <div className="stat-label">Cobertura Promedio</div>
          <div className="stat-value">{avgCoverage.toFixed(1)}%</div>
          <div className="stat-sub">compras vs ventas</div>
        </div>
        <div className="stat-card stat-purple">
          <div className="stat-label">Profit por Ciclo</div>
          <div className="stat-value">{cycles.length > 0 ? formatUSDTShort(totalProfit / cycles.length) : '0.00'}</div>
          <div className="stat-sub">promedio USDT</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="chart-card">
          <div className="chart-title">Profit por Ciclo (USDT)</div>
          <div style={{ height: 200 }}><Bar data={profitBarData} options={OPTS} /></div>
        </div>
        <div className="chart-card">
          <div className="chart-title">Profit Acumulado (USDT)</div>
          <div style={{ height: 200 }}><Line data={cumulativeProfitData} options={OPTS} /></div>
        </div>
      </div>

      <div className="chart-card" style={{ marginBottom: 16 }}>
        <div className="chart-title">Cobertura de Ciclos — compras / volumen vendido (%)</div>
        <div style={{ height: 160 }}><Line data={coverageLineData} options={{ ...OPTS, scales: { ...OPTS.scales, y: { ...OPTS.scales.y, min: 0, max: 110 } } }} /></div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Venta (N° Orden)</th>
              <th>USDT Vendido</th>
              <th>Precio Venta</th>
              <th>USDT Comprado</th>
              <th>Cobertura</th>
              <th>Profit USDT</th>
              <th>Profit VES</th>
              <th>Comisiones</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {cycles.length === 0 && (
              <tr><td colSpan={10} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 32 }}>
                Sin ciclos calculados. Agrega órdenes de venta y compra.
              </td></tr>
            )}
            {cycles.map((c, i) => (
              <React.Fragment key={i}>
                <tr style={{ cursor: 'pointer', background: selected === i ? 'var(--bg-3)' : '' }}
                    onClick={() => setSelected(selected === i ? null : i)}>
                  <td className="text-muted" style={{ fontWeight: 700 }}>C{i + 1}</td>
                  <td style={{ fontSize: 10, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.sell_order_number}>
                    {c.sell_order_number || '—'}
                  </td>
                  <td className="text-green">{formatUSDTShort(c.sell_usdt)}</td>
                  <td>{(c.sell_price || 0).toLocaleString('es-VE')}</td>
                  <td className="text-blue">{formatUSDTShort(c.total_bought)}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 4, background: 'var(--bg-4)', borderRadius: 2 }}>
                        <div style={{ height: '100%', width: `${Math.min(c.coverage_pct || 0, 100)}%`, background: c.coverage_pct >= 95 ? 'var(--green)' : c.coverage_pct >= 50 ? 'var(--amber)' : 'var(--red)', borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: 11, minWidth: 36 }}>{(c.coverage_pct || 0).toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className={c.profit_usdt >= 0 ? 'text-green' : 'text-red'} style={{ fontWeight: 700 }}>
                    {c.profit_usdt >= 0 ? '+' : ''}{formatUSDTShort(c.profit_usdt)}
                  </td>
                  <td className={c.profit_ves >= 0 ? 'text-green' : 'text-red'}>
                    {formatVES(c.profit_ves, true)}
                  </td>
                  <td className="text-muted" style={{ fontSize: 11 }}>
                    {((c.sell_commission || 0) + (c.buy_commission || 0)).toFixed(4)}
                  </td>
                  <td>{selected === i ? '▲' : '▼'}</td>
                </tr>
                {selected === i && (
                  <tr>
                    <td colSpan={10} style={{ padding: 0, background: 'var(--bg-1)' }}>
                      <div style={{ padding: '16px 20px' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 10, letterSpacing: '0.08em' }}>
                          ÓRDENES DE COMPRA EN ESTE CICLO — {c.buy_orders.length} órdenes
                        </div>
                        {selBuyOrders.length === 0
                          ? <div style={{ color: 'var(--text-3)', fontSize: 12 }}>Sin compras en este ciclo (desajuste de IDs)</div>
                          : <table className="data-table" style={{ background: 'var(--bg-1)' }}>
                              <thead><tr>
                                <th>N° Orden</th><th>USDT</th><th>Precio</th><th>Fiat</th><th>PM</th><th>Contraparte</th>
                              </tr></thead>
                              <tbody>{selBuyOrders.map(b => (
                                <tr key={b.id}>
                                  <td style={{ fontSize: 10 }}>{b.order_number || b.id}</td>
                                  <td className="text-blue">{(b.usdt_amount || 0).toFixed(2)}</td>
                                  <td>{(b.unit_price || 0).toLocaleString('es-VE')}</td>
                                  <td>{formatVES(b.fiat_amount, true)}</td>
                                  <td>{b.is_pago_movil ? <span className="badge badge-pm">PM</span> : '—'}</td>
                                  <td className="text-muted">{b.counterparty || '—'}</td>
                                </tr>
                              ))}</tbody>
                            </table>
                        }
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
