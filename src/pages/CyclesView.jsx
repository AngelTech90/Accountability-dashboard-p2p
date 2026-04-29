import React, { useMemo, useState } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import { formatVES, formatUSDTShort, exportCSV } from '../utils/expediente';
import CycleDetail from './CycleDetail';

const OPTS = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
  scales: {
    x: { grid:{color:'#2a3550'}, ticks:{color:'#5f7399',font:{family:"'Space Mono'"}} },
    y: { grid:{color:'#2a3550'}, ticks:{color:'#5f7399',font:{family:"'Space Mono'"}} }
  }
};

export default function CyclesView({ expediente }) {
  const { orders, cycles } = expediente;
  const [detailIdx, setDetailIdx] = useState(null);  // index of cycle to show detail page

  const profitBarData = useMemo(() => ({
    labels: cycles.map((_,i) => `C${i+1}`),
    datasets: [{
      label: 'Profit USDT',
      data: cycles.map(c => parseFloat((c.profit_usdt||0).toFixed(4))),
      backgroundColor: cycles.map(c => c.profit_usdt>=0?'rgba(0,229,160,0.65)':'rgba(255,76,106,0.65)'),
      borderColor:     cycles.map(c => c.profit_usdt>=0?'#00e5a0':'#ff4c6a'),
      borderWidth:1, borderRadius:5
    }]
  }), [cycles]);

  const cumulativeData = useMemo(() => {
    let cum = 0;
    return {
      labels: cycles.map((_,i) => `C${i+1}`),
      datasets: [{
        label: 'Profit Acumulado USDT',
        data: cycles.map(c => { cum += c.profit_usdt||0; return parseFloat(cum.toFixed(4)); }),
        borderColor:'#b06dff', backgroundColor:'rgba(176,109,255,0.1)',
        fill:true, tension:0.4, pointRadius:4, pointBackgroundColor:'#b06dff'
      }]
    };
  }, [cycles]);

  const coverageData = useMemo(() => ({
    labels: cycles.map((_,i) => `C${i+1}`),
    datasets: [{
      label: 'Cobertura %',
      data: cycles.map(c => parseFloat((c.coverage_pct||0).toFixed(1))),
      borderColor:'#ffb547', backgroundColor:'rgba(255,181,71,0.1)',
      fill:true, tension:0.35, pointRadius:5, pointBackgroundColor:'#ffb547'
    }]
  }), [cycles]);

  const totalProfit    = cycles.reduce((s,c) => s+(c.profit_usdt||0), 0);
  const totalProfitVES = cycles.reduce((s,c) => s+(c.profit_ves||0), 0);
  const avgCoverage    = cycles.length > 0
    ? cycles.reduce((s,c) => s+(c.coverage_pct||0), 0) / cycles.length : 0;

  const downloadCyclesCSV = () => {
    // Build CSV from cycles data with per-cycle info
    const headers = ['Ciclo','Venta Orden','USDT Vendido','Precio Venta','USDT Comprado','Cobertura %','Profit USDT','Profit VES','Parcial'];
    const rows = cycles.map(c => [
      c.cycle_id,
      c.sell_order || '',
      (c.sell_usdt||0).toFixed(2),
      (c.sell_price||0).toFixed(3),
      (c.total_bought||0).toFixed(2),
      (c.coverage_pct||0).toFixed(1),
      (c.profit_usdt||0).toFixed(4),
      (c.profit_ves||0).toFixed(2),
      c.is_partial ? 'Si' : 'No',
    ]);
    const csvText = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: `ciclos_${new Date().toISOString().slice(0,10)}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadCycleOrders = () => {
    // Export all buy orders from all cycles as a flat CSV
    const allCycleOrders = [];
    cycles.forEach(c => {
      if (c.per_order_profit && c.per_order_profit.length > 0) {
        c.per_order_profit.forEach(p => {
          allCycleOrders.push({
            order_number: p.order_uid || '', order_type: 'buy',
            usdt_amount: p.usdt_amount, unit_price: p.buy_price,
            fiat_amount: p.usdt_amount * p.buy_price,
            commission_usdt: p.buy_commission || 0,
            counterparty: '', payment_method: '',
            created_at: '', source: 'cycle',
          });
        });
      }
    });
    const csvText = exportCSV(allCycleOrders);
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: `ordenes_ciclos_${new Date().toISOString().slice(0,10)}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  };

  // If a cycle detail is open, render the detail page
  if (detailIdx !== null && cycles[detailIdx]) {
    return <CycleDetail cycle={cycles[detailIdx]} orders={orders} onBack={() => setDetailIdx(null)} />;
  }

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="page-title">Ciclos P2P</div>
          <div className="page-sub">{cycles.length} CICLOS · MODELO VENTANA TEMPORAL</div>
        </div>
        {cycles.length > 0 && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={downloadCyclesCSV} title="Descargar resumen de ciclos">↓ Ciclos CSV</button>
            <button className="btn btn-ghost" onClick={downloadCycleOrders} title="Descargar órdenes de compra de ciclos">↓ Órdenes CSV</button>
          </div>
        )}
      </div>

      <div className="stat-grid">
        <div className="stat-card stat-green">
          <div className="stat-label">Profit Total Ciclos</div>
          <div className="stat-value">{formatUSDTShort(totalProfit)} USDT</div>
          <div className="stat-sub">{formatVES(totalProfitVES, true)}</div>
        </div>
        <div className="stat-card stat-blue">
          <div className="stat-label">Ciclos con Profit</div>
          <div className="stat-value">{cycles.filter(c=>c.profit_usdt>0).length}</div>
          <div className="stat-sub">de {cycles.length} ciclos</div>
        </div>
        <div className="stat-card stat-amber">
          <div className="stat-label">Cobertura Promedio</div>
          <div className="stat-value">{avgCoverage.toFixed(1)}%</div>
          <div className="stat-sub">compras vs ventas</div>
        </div>
        <div className="stat-card stat-purple">
          <div className="stat-label">Profit / Ciclo</div>
          <div className="stat-value">{cycles.length>0?formatUSDTShort(totalProfit/cycles.length):'0.00'}</div>
          <div className="stat-sub">promedio USDT</div>
        </div>
      </div>

      {/* ── Charts — use chart-grid-2 class (stacks on mobile) ── */}
      <div className="chart-grid-2 mb-chart">
        <div className="chart-card">
          <div className="chart-title">Profit por Ciclo (USDT)</div>
          <div style={{height:200}}><Bar data={profitBarData} options={OPTS} /></div>
        </div>
        <div className="chart-card">
          <div className="chart-title">Profit Acumulado (USDT)</div>
          <div style={{height:200}}><Line data={cumulativeData} options={OPTS} /></div>
        </div>
      </div>

      <div className="chart-card mb-chart">
        <div className="chart-title">Cobertura de Ciclos — compras / volumen vendido (%)</div>
        <div style={{height:160}}>
          <Line data={coverageData} options={{...OPTS, scales:{...OPTS.scales, y:{...OPTS.scales.y, min:0, max:110}}}} />
        </div>
      </div>

      {/* ── Cycle table — click to open detail page ── */}
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Venta</th>
              <th>USDT Vendido</th>
              <th>Precio</th>
              <th>Comprado</th>
              <th>Cobertura</th>
              <th>Profit USDT</th>
              <th>Profit VES</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {cycles.length === 0 && (
              <tr><td colSpan={9} style={{textAlign:'center',color:'var(--text-3)',padding:32}}>
                Sin ciclos. Carga un expediente o agrega órdenes de venta.
              </td></tr>
            )}
            {cycles.map((c,i) => (
              <tr key={i} style={{cursor:'pointer'}} onClick={() => setDetailIdx(i)}>
                <td style={{fontWeight:700,color:'var(--text-2)'}}>C{c.cycle_id||i+1}</td>
                <td style={{fontSize:10,maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}
                    title={c.sell_order}>{c.sell_order||'—'}</td>
                <td className="text-green">{formatUSDTShort(c.sell_usdt)}</td>
                <td>{(c.sell_price||0).toLocaleString('es-VE')}</td>
                <td className="text-blue">{formatUSDTShort(c.total_bought)}</td>
                <td>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <div style={{flex:1,height:4,background:'var(--bg-4)',borderRadius:2}}>
                      <div style={{height:'100%',width:`${Math.min(c.coverage_pct||0,100)}%`,
                        background: c.coverage_pct>=95?'var(--green)':c.coverage_pct>=50?'var(--amber)':'var(--red)',
                        borderRadius:2}} />
                    </div>
                    <span style={{fontSize:11,minWidth:34}}>{(c.coverage_pct||0).toFixed(0)}%</span>
                  </div>
                </td>
                <td className={c.profit_usdt>=0?'text-green':'text-red'} style={{fontWeight:700}}>
                  {c.profit_usdt<0?'-':''}{formatUSDTShort(Math.abs(c.profit_usdt))}
                </td>
                <td className={c.profit_ves>=0?'text-green':'text-red'}>{formatVES(c.profit_ves,true)}</td>
                <td style={{color:'var(--text-3)',fontSize:13}}>→</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
