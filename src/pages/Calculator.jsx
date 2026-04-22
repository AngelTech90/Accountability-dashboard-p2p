import React, { useState, useMemo } from 'react';
import { Line } from 'react-chartjs-2';

function CalcInput({ label, value, onChange, prefix, suffix, step = '0.01', hint }) {
  return (
    <div className="form-group" style={{ marginBottom: 0 }}>
      <label className="form-label">{label}</label>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {prefix && <span style={{ position: 'absolute', left: 10, color: 'var(--text-2)', fontSize: 11, pointerEvents: 'none' }}>{prefix}</span>}
        <input
          className="form-input"
          type="number"
          step={step}
          value={value}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          style={{ paddingLeft: prefix ? 28 : 10, paddingRight: suffix ? 34 : 10 }}
        />
        {suffix && <span style={{ position: 'absolute', right: 10, color: 'var(--text-2)', fontSize: 11, pointerEvents: 'none' }}>{suffix}</span>}
      </div>
      {hint && <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 3 }}>{hint}</div>}
    </div>
  );
}

function ResultRow({ label, value, accent, large, last }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '10px 14px',
      borderBottom: last ? 'none' : '1px solid var(--border)',
    }}>
      <span style={{ fontSize: large ? 12 : 11, color: 'var(--text-2)', letterSpacing: '0.05em' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: large ? 17 : 13, fontWeight: large ? 700 : 400, color: accent || 'var(--text-0)' }}>{value}</span>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{ fontSize: 10, color: 'var(--text-2)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
      {children}
    </div>
  );
}

export default function Calculator() {
  const [capital, setCapital]           = useState(240);
  const [sellRate, setSellRate]         = useState(633.26);
  const [buyRate, setBuyRate]           = useState(629.89);
  const [cyclesPerDay, setCyclesPerDay] = useState(8);
  const [isPm, setIsPm]                 = useState(true);

  // Commission inputs — now part of the unified calculator
  // Driven by the same inputs above + commType toggle
  const [commUSDT, setCommUSDT]   = useState(100);
  const [commType, setCommType]   = useState('buy');
  const [commPM, setCommPM]       = useState(true);

  // Profile calculator
  const [currentOrders, setCurrentOrders]     = useState(150);
  const [currentBTC30, setCurrentBTC30]       = useState(0.5);
  const [currentBTCTotal, setCurrentBTCTotal] = useState(2);
  const [targetOrders, setTargetOrders]       = useState(450);
  const [targetBTC30, setTargetBTC30]         = useState(2);
  const [targetBTCTotal, setTargetBTCTotal]   = useState(2);

  const rateCalc = useMemo(() => {
    if (sellRate <= 0 || buyRate <= 0 || capital <= 0) return null;
    const ganancia      = (sellRate - buyRate) / buyRate;
    const sellMonto     = capital * sellRate;
    const buyMonto20    = 20 * buyRate;
    const comBuy        = 0.0025 + (isPm ? 0.003 : 0);
    const profitPerCycle = capital * ganancia - capital * (comBuy + 0.0025);
    const profitTotal   = profitPerCycle * cyclesPerDay;
    return { ganancia, sellMonto, buyMonto20, profitPerCycle, profitTotal, profitMonth: profitTotal * 30 };
  }, [capital, sellRate, buyRate, cyclesPerDay, isPm]);

  const commCalc = useMemo(() => {
    const rate = commType === 'buy' ? 0.0025 + (commPM ? 0.003 : 0) : 0.0025;
    const comm = commUSDT * rate;
    return { rate, comm, net: commUSDT - comm };
  }, [commUSDT, commType, commPM]);

  const profileCalc = useMemo(() => {
    const ordersGap    = targetOrders - currentOrders;
    const btc30Gap     = targetBTC30 - currentBTC30;
    const btcTotalGap  = targetBTCTotal - currentBTCTotal;
    const daysOrders   = ordersGap > 0 ? ordersGap / 10 : 0;
    const daysBTC30    = btc30Gap > 0 && currentBTC30 > 0 ? btc30Gap / (currentBTC30 / 30) : 0;
    const daysBTCTotal = btcTotalGap > 0 && currentBTCTotal > 0 ? btcTotalGap / (currentBTCTotal / 90) : 0;
    return { ordersGap, btc30Gap, btcTotalGap, daysOrders, daysBTC30, daysBTCTotal, maxDays: Math.max(daysOrders, daysBTC30, daysBTCTotal) };
  }, [currentOrders, currentBTC30, currentBTCTotal, targetOrders, targetBTC30, targetBTCTotal]);

  const projectionData = useMemo(() => {
    if (!rateCalc) return null;
    const days = Array.from({ length: 31 }, (_, i) => i);
    return {
      labels: days.map(d => `D${d}`),
      datasets: [
        { label: 'Profit Acumulado', data: days.map(d => parseFloat((rateCalc.profitTotal * d).toFixed(4))), borderColor: '#00e5a0', backgroundColor: 'rgba(0,229,160,0.08)', fill: true, tension: 0.4, pointRadius: 2 },
        { label: 'Capital', data: days.map(() => capital), borderColor: '#5f7399', borderDash: [4,4], backgroundColor: 'transparent', tension: 0, pointRadius: 0 }
      ]
    };
  }, [rateCalc, capital]);

  const OPTS = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: true, labels: { color: '#a0aec0', font: { family: "'Space Mono'", size: 10 } } }, tooltip: { mode: 'index', intersect: false } },
    scales: { x: { grid: { color: '#1c253d' }, ticks: { color: '#5f7399', font: { family: "'Space Mono'", size: 10 } } }, y: { grid: { color: '#1c253d' }, ticks: { color: '#5f7399', font: { family: "'Space Mono'", size: 10 } } } }
  };

  const fVES = n => n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fU   = n => n.toFixed(4);

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">Calculadora P2P</div>
        <div className="page-sub">TASAS · GANANCIA · COMISIONES · PERFIL</div>
      </div>

      {/* ── UNIFIED CALCULATOR ── */}
      <div className="chart-card mb-chart">
        <SectionTitle>◈ Calculadora de Tasas, Ganancia y Comisión</SectionTitle>

        {/* Inputs grid: 2 cols on desktop/tablet, 1 on mobile */}
        <div className="calc-inputs-grid">
          <CalcInput label="Capital (USDT)" value={capital} onChange={setCapital} step="1" hint="Tu inventario de USDT" />
          <CalcInput label="Ciclos al Día"  value={cyclesPerDay} onChange={setCyclesPerDay} step="1" hint="1 ciclo = venta + recompra" />
          <CalcInput label="Tasa Venta"  value={sellRate} onChange={setSellRate} prefix="Bs" step="0.01" hint="Precio al que vendes" />
          <CalcInput label="Tasa Compra" value={buyRate}  onChange={setBuyRate}  prefix="Bs" step="0.01" hint="Precio al que compras" />
        </div>

        <div className="checkbox-row" style={{ margin: '12px 0 16px' }}>
          <input type="checkbox" id="calc-pm" checked={isPm} onChange={e => setIsPm(e.target.checked)} />
          <label htmlFor="calc-pm" style={{ fontSize: 12 }}>Incluir comisión Pago Móvil en cálculo (+0.30%)</label>
        </div>

        {/* Results split: left = rate results, right = commission calc */}
        <div className="calc-results-grid">
          {/* Rate results */}
          <div style={{ background: 'var(--bg-1)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            <div style={{ padding: '8px 14px', background: 'var(--bg-3)', borderBottom: '1px solid var(--border)', fontSize: 10, color: 'var(--text-2)', letterSpacing: '0.1em' }}>GANANCIA</div>
            {rateCalc && <>
              <ResultRow label="Spread %" value={`${(rateCalc.ganancia * 100).toFixed(4)}%`} accent="var(--green)" />
              <ResultRow label="Monto venta del lote" value={`Bs. ${fVES(rateCalc.sellMonto)}`} />
              <ResultRow label="Monto compra 20 USDT" value={`Bs. ${fVES(rateCalc.buyMonto20)}`} />
              <ResultRow label="Ganancia / ciclo" value={`${fU(rateCalc.profitPerCycle)} USDT`} accent="var(--green)" />
              <ResultRow label="Ganancia diaria total" value={`${fU(rateCalc.profitTotal)} USDT`} accent="var(--green)" large />
              <ResultRow label="Proyección mensual" value={`${fU(rateCalc.profitMonth)} USDT`} accent="var(--purple)" large last />
            </>}
          </div>

          {/* Commission calculator */}
          <div style={{ background: 'var(--bg-1)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            <div style={{ padding: '8px 14px', background: 'var(--bg-3)', borderBottom: '1px solid var(--border)', fontSize: 10, color: 'var(--text-2)', letterSpacing: '0.1em' }}>COMISIÓN POR ORDEN</div>
            <div style={{ padding: '14px' }}>
              <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <CalcInput label="Cantidad USDT" value={commUSDT} onChange={setCommUSDT} step="0.01" />
                </div>
                <div style={{ flex: 1 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Tipo</label>
                    <select className="form-select" value={commType} onChange={e => setCommType(e.target.value)}>
                      <option value="buy">Compra</option>
                      <option value="sell">Venta</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="checkbox-row" style={{ marginBottom: 12 }}>
                <input type="checkbox" id="comm-pm" checked={commPM} onChange={e => setCommPM(e.target.checked)} disabled={commType === 'sell'} />
                <label htmlFor="comm-pm" style={{ fontSize: 11 }}>Pago Móvil (+0.30%)</label>
              </div>
            </div>
            <ResultRow label={`Tasa ${(commCalc.rate * 100).toFixed(3)}%`} value={`−${commCalc.comm.toFixed(4)} USDT`} accent="var(--red)" />
            <ResultRow label="Neto recibido" value={`${commCalc.net.toFixed(4)} USDT`} accent="var(--green)" large last />
          </div>
        </div>

        {/* Projection chart */}
        {projectionData && (
          <div style={{ marginTop: 20 }}>
            <div className="chart-title">Proyección 30 días — profit acumulado vs capital</div>
            <div style={{ height: 180 }}><Line data={projectionData} options={OPTS} /></div>
          </div>
        )}
      </div>

      {/* ── PROFILE CALCULATOR ── */}
      <div className="chart-card">
        <SectionTitle>◎ Calculadora de Perfil P2P — ¿Cuánto me falta?</SectionTitle>

        <div className="calc-profile-grid">
          <div>
            <div style={{ fontSize: 10, color: 'var(--green)', letterSpacing: '0.1em', marginBottom: 10 }}>PERFIL ACTUAL</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <CalcInput label="Total Órdenes"         value={currentOrders}   onChange={setCurrentOrders}   step="1" />
              <CalcInput label="Volumen BTC — 30 días" value={currentBTC30}    onChange={setCurrentBTC30}    step="0.01" suffix="BTC" />
              <CalcInput label="Volumen BTC — total"   value={currentBTCTotal} onChange={setCurrentBTCTotal} step="0.01" suffix="BTC" />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--amber)', letterSpacing: '0.1em', marginBottom: 10 }}>OBJETIVO</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <CalcInput label="Órdenes Objetivo"   value={targetOrders}   onChange={setTargetOrders}   step="1" />
              <CalcInput label="BTC 30d Objetivo"   value={targetBTC30}    onChange={setTargetBTC30}    step="0.01" suffix="BTC" />
              <CalcInput label="BTC Total Objetivo" value={targetBTCTotal} onChange={setTargetBTCTotal} step="0.01" suffix="BTC" />
            </div>
          </div>
        </div>

        <div style={{ background: 'var(--bg-1)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginTop: 18 }}>
          <div className="profile-results-grid">
            {[
              { label: 'Gap Órdenes',  value: `+${profileCalc.ordersGap}`,                  days: `~${profileCalc.daysOrders.toFixed(1)} días` },
              { label: 'Gap BTC 30d',  value: `+${profileCalc.btc30Gap.toFixed(2)} BTC`,    days: `~${profileCalc.daysBTC30.toFixed(1)} días` },
              { label: 'Gap BTC Total',value: `+${profileCalc.btcTotalGap.toFixed(2)} BTC`, days: `~${profileCalc.daysBTCTotal.toFixed(1)} días` },
              { label: 'TIEMPO EST.',  value: `${profileCalc.maxDays.toFixed(1)} días`,      days: '', bold: true },
            ].map((item, i) => (
              <div key={i} className="profile-result-cell">
                <div style={{ fontSize: 10, color: 'var(--text-2)', letterSpacing: '0.1em', marginBottom: 6 }}>{item.label}</div>
                <div style={{ fontSize: item.bold ? 20 : 15, fontWeight: 700, color: item.bold ? 'var(--amber)' : 'var(--text-0)', fontFamily: 'var(--font-mono)' }}>{item.value}</div>
                {item.days && <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4 }}>{item.days}</div>}
              </div>
            ))}
          </div>
          <div style={{ padding: '8px 14px', fontSize: 10, color: 'var(--text-3)' }}>
            * Estimado basado en ritmo actual de operaciones.
          </div>
        </div>
      </div>
    </div>
  );
}
