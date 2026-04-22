import React, { useMemo } from 'react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import { formatVES, formatUSDTShort } from '../utils/expediente';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend, Filler
);

const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
  scales: {
    x: { grid: { color: '#2a3550' }, ticks: { color: '#5f7399', font: { family: "'Space Mono'" } } },
    y: { grid: { color: '#2a3550' }, ticks: { color: '#5f7399', font: { family: "'Space Mono'" } } }
  }
};

const WITH_LEGEND = {
  plugins: {
    legend: { display: true, labels: { color: '#a0aec0', font: { family: "'Space Mono'", size: 10 } } },
    tooltip: { mode: 'index', intersect: false }
  }
};

export default function Dashboard({ expediente }) {
  const { orders, cycles, stats } = expediente;

  const cycleChartData = useMemo(() => ({
    labels: cycles.map((_, i) => `C${i + 1}`),
    datasets: [{
      label: 'Profit USDT',
      data: cycles.map(c => parseFloat(c.profit_usdt?.toFixed(4) || 0)),
      backgroundColor: cycles.map(c => c.profit_usdt >= 0 ? 'rgba(0,229,160,0.7)' : 'rgba(255,76,106,0.7)'),
      borderColor: cycles.map(c => c.profit_usdt >= 0 ? '#00e5a0' : '#ff4c6a'),
      borderWidth: 1, borderRadius: 4,
    }]
  }), [cycles]);

  const priceLineData = useMemo(() => {
    const sorted = [...orders]
      .filter(o => o.unit_price > 0 && o.created_at)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const labels = sorted.map(o => {
      const d = new Date(o.created_at);
      return `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}h`;
    });
    return {
      labels,
      datasets: [
        { label: 'Precio Venta', data: sorted.map(o => o.order_type === 'sell' ? o.unit_price : null), borderColor: '#00e5a0', backgroundColor: 'rgba(0,229,160,0.08)', fill: false, tension: 0.3, pointRadius: 4, pointBackgroundColor: '#00e5a0', spanGaps: true },
        { label: 'Precio Compra', data: sorted.map(o => o.order_type === 'buy' ? o.unit_price : null), borderColor: '#4d9fff', backgroundColor: 'rgba(77,159,255,0.06)', fill: false, tension: 0.3, pointRadius: 3, pointBackgroundColor: '#4d9fff', spanGaps: true }
      ]
    };
  }, [orders]);

  const volumeData = useMemo(() => {
    const byDay = {};
    orders.forEach(o => {
      if (!o.created_at) return;
      const d = new Date(o.created_at).toISOString().slice(0, 10);
      if (!byDay[d]) byDay[d] = { buy: 0, sell: 0 };
      if (o.order_type === 'buy') byDay[d].buy += o.usdt_amount;
      else byDay[d].sell += o.usdt_amount;
    });
    const days = Object.keys(byDay).sort();
    return {
      labels: days,
      datasets: [
        { label: 'Compras USDT', data: days.map(d => byDay[d].buy), backgroundColor: 'rgba(77,159,255,0.6)', borderColor: '#4d9fff', borderWidth: 1, borderRadius: 3 },
        { label: 'Ventas USDT',  data: days.map(d => byDay[d].sell), backgroundColor: 'rgba(0,229,160,0.6)', borderColor: '#00e5a0', borderWidth: 1, borderRadius: 3 }
      ]
    };
  }, [orders]);

  const donutData = useMemo(() => ({
    labels: ['Compras', 'Ventas', 'Gastos'],
    datasets: [{
      data: [stats.buy_count || 0, stats.sell_count || 0, stats.expense_count || 0],
      backgroundColor: ['rgba(77,159,255,0.8)', 'rgba(0,229,160,0.8)', 'rgba(255,76,106,0.8)'],
      borderColor: ['#4d9fff', '#00e5a0', '#ff4c6a'], borderWidth: 1
    }]
  }), [stats]);

  const coverageData = useMemo(() => ({
    labels: cycles.map((_, i) => `C${i + 1}`),
    datasets: [{
      label: 'Cobertura %',
      data: cycles.map(c => parseFloat((c.coverage_pct || 0).toFixed(1))),
      borderColor: '#ffb547', backgroundColor: 'rgba(255,181,71,0.12)',
      fill: true, tension: 0.3, pointRadius: 5, pointBackgroundColor: '#ffb547'
    }]
  }), [cycles]);

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">Dashboard</div>
        <div className="page-sub">RESUMEN · {orders.length} ÓRDENES · {cycles.length} CICLOS</div>
      </div>

      <div className="stat-grid">
        <div className="stat-card stat-green">
          <div className="stat-label">Profit Total</div>
          <div className="stat-value">{formatUSDTShort(stats.net_profit_usdt)} <span style={{fontSize:12}}>USDT</span></div>
          <div className="stat-sub">{formatVES(stats.net_profit_ves, true)}</div>
        </div>
        <div className="stat-card stat-blue">
          <div className="stat-label">Vol. Comprado</div>
          <div className="stat-value">{formatUSDTShort(stats.total_buy_usdt)}</div>
          <div className="stat-sub">{stats.buy_count} órdenes</div>
        </div>
        <div className="stat-card stat-green">
          <div className="stat-label">Vol. Vendido</div>
          <div className="stat-value">{formatUSDTShort(stats.total_sell_usdt)}</div>
          <div className="stat-sub">{stats.sell_count} órdenes</div>
        </div>
        <div className="stat-card stat-amber">
          <div className="stat-label">Spread Promedio</div>
          <div className="stat-value">{(stats.spread || 0).toFixed(2)}</div>
          <div className="stat-sub">Bs/USDT venta−compra</div>
        </div>
        <div className="stat-card stat-purple">
          <div className="stat-label">Comisiones</div>
          <div className="stat-value">{formatUSDTShort(stats.total_commission)}</div>
          <div className="stat-sub">USDT pagados</div>
        </div>
        <div className="stat-card stat-red">
          <div className="stat-label">Gastos</div>
          <div className="stat-value">{formatUSDTShort(stats.expense_usdt)}</div>
          <div className="stat-sub">{stats.expense_count} transacciones</div>
        </div>
      </div>

      {/* Charts: 2-col on desktop, 1-col on mobile via CSS class */}
      <div className="chart-grid-2 mb-chart">
        <div className="chart-card">
          <div className="chart-title">Profit por Ciclo (USDT)</div>
          <div style={{ height: 200 }}><Bar data={cycleChartData} options={CHART_DEFAULTS} /></div>
        </div>
        <div className="chart-card">
          <div className="chart-title">Cobertura de Ciclos (%)</div>
          <div style={{ height: 200 }}>
            <Line data={coverageData} options={{ ...CHART_DEFAULTS, ...WITH_LEGEND, scales: { ...CHART_DEFAULTS.scales, y: { ...CHART_DEFAULTS.scales.y, min: 0, max: 110 } } }} />
          </div>
        </div>
      </div>

      <div className="chart-grid-2-1 mb-chart">
        <div className="chart-card">
          <div className="chart-title">Evolución de Precios Bs/USDT</div>
          <div style={{ height: 220 }}><Line data={priceLineData} options={{ ...CHART_DEFAULTS, ...WITH_LEGEND }} /></div>
        </div>
        <div className="chart-card">
          <div className="chart-title">Distribución Órdenes</div>
          <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Doughnut data={donutData} options={{
              responsive: true, maintainAspectRatio: false, cutout: '65%',
              plugins: {
                legend: { display: true, position: 'bottom', labels: { color: '#a0aec0', font: { family: "'Space Mono'", size: 10 }, padding: 12 } },
                tooltip: { mode: 'index' }
              }
            }} />
          </div>
        </div>
      </div>

      <div className="chart-card">
        <div className="chart-title">Volumen Diario USDT (Compras vs Ventas)</div>
        <div style={{ height: 200 }}><Bar data={volumeData} options={{ ...CHART_DEFAULTS, ...WITH_LEGEND }} /></div>
      </div>
    </div>
  );
}
