import React, { useMemo } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import { formatVES, formatUSDTShort } from '../utils/expediente';

const OPTS = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
  scales: {
    x: { grid:{color:'#2a3550'}, ticks:{color:'#5f7399',font:{family:"'Space Mono'",size:10}} },
    y: { grid:{color:'#2a3550'}, ticks:{color:'#5f7399',font:{family:"'Space Mono'",size:10}} }
  }
};

function StatMini({ label, value, accent, sub }) {
  return (
    <div style={{ background: 'var(--bg-1)', borderRadius: 'var(--radius-md)', padding: '12px 14px', flex: 1, minWidth: 130 }}>
      <div style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.08em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: accent || 'var(--text-0)' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export default function CycleDetail({ cycle, orders, onBack }) {
  const c = cycle;

  // Resolve buy orders from per_order_profit or from orders array
  const buyOrders = useMemo(() => {
    if (c.per_order_profit && c.per_order_profit.length > 0) {
      return c.per_order_profit.map((p, i) => ({
        id: p.order_uid || i,
        order_number: p.order_uid || '',
        usdt_amount: p.usdt_amount,
        unit_price: p.buy_price,
        fiat_amount: p.usdt_amount * p.buy_price,
        profit_usdt: p.profit_usdt,
        profit_ves: p.profit_ves,
        profit_pct: p.profit_pct,
        buy_commission: p.buy_commission || 0,
      }));
    }
    return orders.filter(o =>
      o.order_type === 'buy' &&
      c.buy_orders.includes(o.order_number || o.id)
    );
  }, [c, orders]);

  // Completion ratio: capped at 100+profit_pct%
  const profitPct = c.sell_usdt > 0 ? (c.profit_usdt / c.sell_usdt) * 100 : 0;
  const maxCompletion = 100 + profitPct;
  const completionRatio = Math.min(c.coverage_pct || 0, maxCompletion);
  const completionDisplay = completionRatio.toFixed(2);

  // Per-order profit bar chart
  const profitBarData = useMemo(() => ({
    labels: buyOrders.map((_, i) => `Orden ${i + 1}`),
    datasets: [{
      label: 'Profit USDT',
      data: buyOrders.map(b => parseFloat((b.profit_usdt || 0).toFixed(4))),
      backgroundColor: buyOrders.map(b => (b.profit_usdt || 0) >= 0 ? 'rgba(0,229,160,0.65)' : 'rgba(255,76,106,0.65)'),
      borderColor: buyOrders.map(b => (b.profit_usdt || 0) >= 0 ? '#00e5a0' : '#ff4c6a'),
      borderWidth: 1, borderRadius: 5
    }]
  }), [buyOrders]);

  // Coverage donut
  const coverageDonut = useMemo(() => {
    const filled = Math.min(completionRatio, 100);
    const remaining = Math.max(100 - filled, 0);
    return {
      labels: ['Cubierto', 'Pendiente'],
      datasets: [{
        data: [filled, remaining],
        backgroundColor: [
          completionRatio >= 99.5 ? '#00e5a0' : completionRatio >= 50 ? '#ffb547' : '#ff4c6a',
          'rgba(42,53,80,0.6)'
        ],
        borderWidth: 0,
        cutout: '72%',
      }]
    };
  }, [completionRatio]);

  const donutOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false },
    },
  };

  // Volume breakdown bar
  const volumeBarData = useMemo(() => ({
    labels: buyOrders.map((_, i) => `O${i + 1}`),
    datasets: [{
      label: 'USDT Comprado',
      data: buyOrders.map(b => b.usdt_amount || 0),
      backgroundColor: 'rgba(88,166,255,0.5)',
      borderColor: '#58a6ff',
      borderWidth: 1, borderRadius: 4
    }]
  }), [buyOrders]);

  const totalBuyComm = buyOrders.reduce((s, b) => s + (b.buy_commission || 0), 0);

  return (
    <div className="page">
      {/* Header with back */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <button
            className="btn btn-ghost"
            onClick={onBack}
            style={{ marginBottom: 8, fontSize: 11 }}
          >
            ← Volver a Ciclos
          </button>
          <div className="page-title">Ciclo {c.cycle_id}</div>
          <div className="page-sub">
            VENTA: {c.sell_order || '—'} · {(c.sell_price || 0).toLocaleString('es-VE')} Bs/USDT
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <StatMini
          label="USDT Vendido"
          value={`${formatUSDTShort(c.sell_usdt)} USDT`}
          accent="var(--green)"
        />
        <StatMini
          label="USDT Comprado"
          value={`${formatUSDTShort(c.total_bought)} USDT`}
          accent="var(--blue)"
          sub={`${buyOrders.length} órdenes de compra`}
        />
        <StatMini
          label="Profit Neto"
          value={`${c.profit_usdt < 0 ? '-' : ''}${formatUSDTShort(Math.abs(c.profit_usdt))} USDT`}
          accent={c.profit_usdt >= 0 ? 'var(--green)' : 'var(--red)'}
          sub={formatVES(c.profit_ves, true)}
        />
        <StatMini
          label="Profit %"
          value={`${profitPct < 0 ? '-' : ''}${Math.abs(profitPct).toFixed(2)}%`}
          accent={profitPct >= 0 ? 'var(--green)' : 'var(--red)'}
        />
      </div>

      {/* Completion + Coverage section */}
      <div className="chart-grid-2 mb-chart">
        {/* Coverage donut */}
        <div className="chart-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="chart-title">Ratio de Completación</div>
          <div style={{ position: 'relative', width: 140, height: 140, margin: '10px 0' }}>
            <Doughnut data={coverageDonut} options={donutOpts} />
            <div style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              textAlign: 'center',
            }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color: 'var(--text-0)' }}>
                {completionDisplay}%
              </div>
              <div style={{ fontSize: 9, color: 'var(--text-3)' }}>
                máx {maxCompletion.toFixed(2)}%
              </div>
            </div>
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-3)', textAlign: 'center' }}>
            {c.is_partial ? 'Ciclo parcial — pendiente de completar' : 'Ciclo completado'}
          </div>
        </div>

        {/* Commission breakdown */}
        <div className="chart-card">
          <div className="chart-title">Comisiones</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-1)', borderRadius: 'var(--radius-sm)' }}>
              <span style={{ fontSize: 11, color: 'var(--text-2)' }}>Comisión Venta</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--red)' }}>
                {(c.sell_commission || 0).toFixed(4)} USDT
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-1)', borderRadius: 'var(--radius-sm)' }}>
              <span style={{ fontSize: 11, color: 'var(--text-2)' }}>Comisión Compras (total)</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--red)' }}>
                {totalBuyComm.toFixed(4)} USDT
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-1)', borderRadius: 'var(--radius-sm)', borderTop: '1px solid var(--border)' }}>
              <span style={{ fontSize: 11, color: 'var(--text-2)', fontWeight: 600 }}>Total Comisiones</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--red)', fontWeight: 700 }}>
                {((c.sell_commission || 0) + totalBuyComm).toFixed(4)} USDT
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-1)', borderRadius: 'var(--radius-sm)' }}>
              <span style={{ fontSize: 11, color: 'var(--text-2)' }}>Precio Venta</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-0)' }}>
                Bs. {(c.sell_price || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-1)', borderRadius: 'var(--radius-sm)' }}>
              <span style={{ fontSize: 11, color: 'var(--text-2)' }}>VES Vendido</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-0)' }}>
                {formatVES(c.sell_usdt * c.sell_price)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Charts: profit per order + volume per order */}
      {buyOrders.length > 0 && (
        <div className="chart-grid-2 mb-chart">
          <div className="chart-card">
            <div className="chart-title">Profit por Orden de Compra (USDT)</div>
            <div style={{ height: 180 }}><Bar data={profitBarData} options={OPTS} /></div>
          </div>
          <div className="chart-card">
            <div className="chart-title">Volumen por Orden de Compra (USDT)</div>
            <div style={{ height: 180 }}><Bar data={volumeBarData} options={OPTS} /></div>
          </div>
        </div>
      )}

      {/* Buy orders table */}
      <div className="table-wrap">
        <div style={{ fontSize: 10, color: 'var(--text-2)', letterSpacing: '0.08em', marginBottom: 10, padding: '0 4px' }}>
          ÓRDENES DE COMPRA — {buyOrders.length}
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Orden / UID</th>
              <th>USDT</th>
              <th>Precio Compra</th>
              <th>Monto VES</th>
              <th>Comisión</th>
              <th>Profit USDT</th>
              <th>Profit VES</th>
              <th>Profit %</th>
            </tr>
          </thead>
          <tbody>
            {buyOrders.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 32 }}>
                Sin detalle de compras disponible
              </td></tr>
            )}
            {buyOrders.map((b, i) => (
              <tr key={i}>
                <td style={{ color: 'var(--text-3)' }}>{i + 1}</td>
                <td style={{ fontSize: 10, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    title={b.order_number || b.id}>{b.order_number || b.id || '—'}</td>
                <td className="text-blue">{(b.usdt_amount || 0).toFixed(2)}</td>
                <td>{(b.unit_price || 0).toLocaleString('es-VE')}</td>
                <td style={{ fontSize: 11 }}>{formatVES(b.fiat_amount || (b.usdt_amount * b.unit_price), true)}</td>
                <td className="text-red" style={{ fontSize: 11 }}>{(b.buy_commission || 0).toFixed(4)}</td>
                <td className={b.profit_usdt >= 0 ? 'text-green' : 'text-red'} style={{ fontWeight: 600 }}>
                  {b.profit_usdt < 0 ? '-' : ''}{Math.abs(b.profit_usdt || 0).toFixed(4)}
                </td>
                <td className={b.profit_ves >= 0 ? 'text-green' : 'text-red'}>
                  {formatVES(b.profit_ves, true)}
                </td>
                <td className="text-amber">{(b.profit_pct || 0).toFixed(2)}%</td>
              </tr>
            ))}
            {/* Totals row */}
            {buyOrders.length > 0 && (
              <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 700 }}>
                <td colSpan={2} style={{ color: 'var(--text-2)', fontSize: 10 }}>TOTAL</td>
                <td className="text-blue">{buyOrders.reduce((s, b) => s + (b.usdt_amount || 0), 0).toFixed(2)}</td>
                <td>—</td>
                <td>{formatVES(buyOrders.reduce((s, b) => s + (b.fiat_amount || b.usdt_amount * b.unit_price || 0), 0), true)}</td>
                <td className="text-red">{totalBuyComm.toFixed(4)}</td>
                <td className={c.profit_usdt >= 0 ? 'text-green' : 'text-red'}>
                  {c.profit_usdt < 0 ? '-' : ''}{Math.abs(c.profit_usdt).toFixed(4)}
                </td>
                <td className={c.profit_ves >= 0 ? 'text-green' : 'text-red'}>
                  {formatVES(c.profit_ves, true)}
                </td>
                <td>—</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
