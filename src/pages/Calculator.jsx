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

  // Commission: single % input that applies to both sides
  const [commPct, setCommPct]           = useState(0.25);
  const [isPm, setIsPm]                 = useState(true);
  const [isDirect, setIsDirect]         = useState(false);

  const calc = useMemo(() => {
    if (sellRate <= 0 || buyRate <= 0 || capital <= 0) return null;

    const commRate = commPct / 100;
    // Sell commission: 0% if venta directa, otherwise the input rate
    const sellCommRate = isDirect ? 0 : commRate;
    // Buy commission: input rate + pago movil extra
    const buyCommRate  = commRate + (isPm ? 0.003 : 0);

    // Real prices after commission
    const realSellPrice = sellRate * (1 - sellCommRate);
    const realBuyPrice  = buyRate * (1 + buyCommRate);

    // BS earned per USDT = difference between what you get selling and what you pay buying
    const bsPerUSDT = realSellPrice - realBuyPrice;

    // Spread
    const ganancia = (sellRate - buyRate) / buyRate;

    // Profit per cycle in USDT
    const profitPerCycle = capital * (realSellPrice - realBuyPrice) / sellRate;
    const profitTotal    = profitPerCycle * cyclesPerDay;

    // Lot amounts
    const sellMonto  = capital * sellRate;
    const buyMonto20 = 20 * buyRate;

    return {
      ganancia, sellMonto, buyMonto20,
      realSellPrice, realBuyPrice, bsPerUSDT,
      sellCommRate, buyCommRate,
      profitPerCycle, profitTotal,
      profitMonth: profitTotal * 30,
    };
  }, [capital, sellRate, buyRate, cyclesPerDay, commPct, isPm, isDirect]);

  const projectionData = useMemo(() => {
    if (!calc) return null;
    const days = Array.from({ length: 31 }, (_, i) => i);
    return {
      labels: days.map(d => `D${d}`),
      datasets: [
        { label: 'Profit Acumulado', data: days.map(d => parseFloat((calc.profitTotal * d).toFixed(4))), borderColor: '#00e5a0', backgroundColor: 'rgba(0,229,160,0.08)', fill: true, tension: 0.4, pointRadius: 2 },
        { label: 'Capital', data: days.map(() => capital), borderColor: '#5f7399', borderDash: [4,4], backgroundColor: 'transparent', tension: 0, pointRadius: 0 }
      ]
    };
  }, [calc, capital]);

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
        <div className="page-sub">TASAS · GANANCIA · COMISIONES · PROYECCION</div>
      </div>

      <div className="chart-card mb-chart">
        <SectionTitle>◈ Calculadora de Tasas, Ganancia y Comisión</SectionTitle>

        {/* Inputs grid */}
        <div className="calc-inputs-grid">
          <CalcInput label="Capital (USDT)" value={capital} onChange={setCapital} step="1" hint="Tu inventario de USDT" />
          <CalcInput label="Ciclos al Día"  value={cyclesPerDay} onChange={setCyclesPerDay} step="1" hint="1 ciclo = venta + recompra" />
          <CalcInput label="Tasa Venta"  value={sellRate} onChange={setSellRate} prefix="Bs" step="0.01" hint="Precio al que vendes" />
          <CalcInput label="Tasa Compra" value={buyRate}  onChange={setBuyRate}  prefix="Bs" step="0.01" hint="Precio al que compras" />
          <CalcInput label="Comisión %" value={commPct} onChange={setCommPct} suffix="%" step="0.01" hint="Se aplica a precio venta y compra" />
        </div>

        {/* Checkboxes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '12px 0 16px' }}>
          <div className="checkbox-row">
            <input type="checkbox" id="calc-pm" checked={isPm} onChange={e => setIsPm(e.target.checked)} />
            <label htmlFor="calc-pm" style={{ fontSize: 12 }}>Pago Móvil (+0.30% comisión en compras)</label>
          </div>
          <div className="checkbox-row">
            <input type="checkbox" id="calc-direct" checked={isDirect} onChange={e => setIsDirect(e.target.checked)} />
            <label htmlFor="calc-direct" style={{ fontSize: 12, color: 'var(--green)' }}>Venta Directa (0% comisión en venta)</label>
          </div>
        </div>

        {/* Results: left = ganancia, right = precios reales */}
        <div className="calc-results-grid">
          {/* Ganancia */}
          <div style={{ background: 'var(--bg-1)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            <div style={{ padding: '8px 14px', background: 'var(--bg-3)', borderBottom: '1px solid var(--border)', fontSize: 10, color: 'var(--text-2)', letterSpacing: '0.1em' }}>GANANCIA</div>
            {calc && <>
              <ResultRow label="Spread %" value={`${(calc.ganancia * 100).toFixed(4)}%`} accent="var(--green)" />
              <ResultRow label="Monto venta del lote" value={`Bs. ${fVES(calc.sellMonto)}`} />
              <ResultRow label="Monto compra 20 USDT" value={`Bs. ${fVES(calc.buyMonto20)}`} />
              <ResultRow label="Ganancia / ciclo" value={`${fU(calc.profitPerCycle)} USDT`} accent="var(--green)" />
              <ResultRow label="Ganancia diaria total" value={`${fU(calc.profitTotal)} USDT`} accent="var(--green)" large />
              <ResultRow label="Proyección mensual" value={`${fU(calc.profitMonth)} USDT`} accent="var(--purple)" large last />
            </>}
          </div>

          {/* Precios Reales */}
          <div style={{ background: 'var(--bg-1)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            <div style={{ padding: '8px 14px', background: 'var(--bg-3)', borderBottom: '1px solid var(--border)', fontSize: 10, color: 'var(--text-2)', letterSpacing: '0.1em' }}>PRECIOS REALES</div>
            {calc && <>
              <ResultRow
                label={`Comisión venta (${(calc.sellCommRate * 100).toFixed(2)}%)`}
                value={isDirect ? '0% — directa' : `−${(calc.sellCommRate * 100).toFixed(2)}%`}
                accent={isDirect ? 'var(--green)' : 'var(--red)'}
              />
              <ResultRow
                label={`Comisión compra (${(calc.buyCommRate * 100).toFixed(2)}%)`}
                value={`+${(calc.buyCommRate * 100).toFixed(2)}%`}
                accent="var(--red)"
              />
              <ResultRow label="Precio real venta" value={`Bs. ${fVES(calc.realSellPrice)}`} accent="var(--green)" large />
              <ResultRow label="Precio real compra" value={`Bs. ${fVES(calc.realBuyPrice)}`} accent="var(--blue)" large />
              <ResultRow label="BS ganados / USDT" value={`Bs. ${fVES(calc.bsPerUSDT)}`} accent={calc.bsPerUSDT >= 0 ? 'var(--green)' : 'var(--red)'} large last />
            </>}
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
    </div>
  );
}
