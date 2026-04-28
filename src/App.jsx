import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  enrichExpediente, EMPTY_EXPEDIENTE, validateExpediente,
  computeCycles, computeStats, parseCSV, exportCSV
} from './utils/expediente';
import Dashboard    from './pages/Dashboard';
import OrdersTable  from './pages/OrdersTable';
import CyclesView   from './pages/CyclesView';
import Calculator     from './pages/Calculator';
import Reconciliation from './pages/Reconciliation';
import './App.css';

// ─── localStorage cache ─────────────────────────────────────────────────────
const CACHE_KEY = 'god_analyzer_expediente';

function loadCached() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data && Array.isArray(data.orders) && data.orders.length > 0) return data;
  } catch { /* corrupt cache, ignore */ }
  return null;
}

function saveCache(exp) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      chat_id: exp.chat_id, date: exp.date,
      orders: exp.orders, cycles: exp.cycles,
      stats: exp.stats, bank_receipts: exp.bank_receipts || [],
    }));
  } catch { /* quota exceeded, silently fail */ }
}

const NAV = [
  { id: 'dashboard',      label: 'Dashboard',      icon: '◈' },
  { id: 'orders',         label: 'Órdenes',        icon: '≡' },
  { id: 'cycles',         label: 'Ciclos',         icon: '◎' },
  { id: 'calculator',     label: 'Calculadora',    icon: '⟁' },
  { id: 'reconciliation', label: 'Conciliación',   icon: '⇌' },
];

export default function App() {
  const [view, setView]             = useState('dashboard');
  const [expediente, setExpediente] = useState(() => {
    const cached = loadCached();
    if (cached) return enrichExpediente(cached);
    return enrichExpediente({...EMPTY_EXPEDIENTE});
  });
  const [toast, setToast]           = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [ioPopup, setIoPopup]       = useState(null); // 'upload' | 'download' | null

  // Track whether the full expediente has been exported (JSON or CSV via export popup).
  // Resets to false every time the expediente data changes (new import or order edit).
  const hasExportedRef = useRef(false);

  const showToast = useCallback((msg, type='ok') => {
    setToast({msg, type});
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ── Persist to localStorage on every expediente change ──────────────────
  useEffect(() => {
    saveCache(expediente);
    // Data changed → user hasn't exported THIS version yet
    hasExportedRef.current = false;
  }, [expediente]);

  // ── Show cached-data toast on first load ────────────────────────────────
  useEffect(() => {
    if (expediente.orders.length > 0 && loadCached()) {
      showToast(`Sesión restaurada — ${expediente.orders.length} órdenes en caché`, 'ok');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── beforeunload guard: block leaving if data exists and not exported ───
  useEffect(() => {
    const handler = (e) => {
      // No data loaded → let them leave freely
      if (expediente.orders.length === 0) return;
      // Already exported the full expediente → safe to leave
      if (hasExportedRef.current) return;
      // Block: browser shows native "are you sure?" dialog
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [expediente.orders.length]);

  const updateOrders = useCallback((newOrders) => {
    setExpediente(prev => {
      const cycles = computeCycles(newOrders);
      const stats  = computeStats(newOrders, cycles);
      return {...prev, orders: newOrders, cycles, stats};
    });
  }, []);

  // ── Import handler: JSON or CSV ──────────────────────────────────────────
  const handleUpload = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      try {
        if (file.name.endsWith('.csv')) {
          const data = parseCSV(text);
          setExpediente(enrichExpediente({...data, chat_id: file.name.replace('.csv','')}));
          showToast(`✓ CSV importado — ${data.orders.length} órdenes`, 'ok');
        } else {
          const data = JSON.parse(text);
          if (!validateExpediente(data)) throw new Error('Formato JSON inválido');
          setExpediente(enrichExpediente(data));
          showToast(`✓ Expediente cargado — ${data.orders.length} órdenes`, 'ok');
        }
      } catch (err) {
        showToast('✗ Error: ' + err.message, 'err');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
    setIoPopup(null);
  }, [showToast]);

  // ── Download JSON (full expediente export) ──────────────────────────────
  const handleDownloadJSON = useCallback(() => {
    const clean = {
      chat_id: expediente.chat_id, date: expediente.date,
      orders:  expediente.orders.map(({id, ...rest}) => rest),
      cycles:  expediente.cycles, stats: expediente.stats,
      bank_receipts: expediente.bank_receipts || []
    };
    const blob = new Blob([JSON.stringify(clean, null, 2)], {type:'application/json'});
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), {href:url, download:`expediente_${expediente.chat_id||'export'}_${expediente.date}.json`});
    a.click(); URL.revokeObjectURL(url);
    hasExportedRef.current = true;
    showToast('✓ JSON descargado — puedes cerrar la página', 'ok');
    setIoPopup(null);
  }, [expediente, showToast]);

  // ── Download CSV (full expediente export) ───────────────────────────────
  const handleDownloadCSV = useCallback(() => {
    const csvText = exportCSV(expediente.orders);
    const blob = new Blob([csvText], {type:'text/csv;charset=utf-8;'});
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), {href:url, download:`ordenes_${expediente.chat_id||'export'}_${expediente.date}.csv`});
    a.click(); URL.revokeObjectURL(url);
    hasExportedRef.current = true;
    showToast('✓ CSV descargado — puedes cerrar la página', 'ok');
    setIoPopup(null);
  }, [expediente, showToast]);

  const navigate = (id) => { setView(id); setDrawerOpen(false); };
  const PAGE = {dashboard: Dashboard, orders: OrdersTable, cycles: CyclesView, calculator: Calculator, reconciliation: Reconciliation};
  const CurrentPage = PAGE[view];
  const currentNav  = NAV.find(n => n.id === view);

  return (
    <div className="app-shell">
      {/* ── Mobile topbar ── */}
      <header className="mobile-topbar">
        <button className="hamburger" onClick={() => setDrawerOpen(true)} aria-label="Menú">
          <span/><span/><span/>
        </button>
        <div className="mobile-brand">
          <span style={{color:'var(--green)',fontSize:18}}>⬡</span>
          <span style={{fontFamily:'var(--font-display)',fontSize:13,fontWeight:800,letterSpacing:'0.12em'}}>GOD ANALYZER</span>
        </div>
        {currentNav && (
          <div className="mobile-page-label">
            <span>{currentNav.icon}</span>
            <span>{currentNav.label}</span>
          </div>
        )}
      </header>

      {/* ── Desktop sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-icon">⬡</span>
          <div>
            <div className="brand-title">GOD ANALYZER</div>
            <div className="brand-sub">BETA</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          {NAV.map(n => (
            <button key={n.id} className={`nav-btn ${view===n.id?'active':''}`} onClick={() => setView(n.id)}>
              <span className="nav-icon">{n.icon}</span><span>{n.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-io">
          <div className="exp-meta">
            <div className="exp-id">{expediente.chat_id||'Sin expediente'}</div>
            <div className="exp-date">{expediente.date}</div>
          </div>
          <button className="io-btn upload-btn"   onClick={() => setIoPopup('upload')}>↑ Cargar</button>
          <button className="io-btn download-btn" onClick={() => setIoPopup('download')}>↓ Exportar</button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="main-content">
        <CurrentPage expediente={expediente} onUpdateOrders={updateOrders} showToast={showToast} />
      </main>

      {/* ── Mobile drawer ── */}
      {drawerOpen && (
        <div className="drawer-overlay" onClick={() => setDrawerOpen(false)}>
          <div className="drawer" onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <span style={{color:'var(--green)',fontSize:22}}>⬡</span>
              <div>
                <div style={{fontFamily:'var(--font-display)',fontSize:13,fontWeight:800,letterSpacing:'0.12em'}}>GOD ANALYZER</div>
                <div style={{fontSize:9,letterSpacing:'0.3em',color:'var(--green)'}}>BETA</div>
              </div>
              <button className="drawer-close" onClick={() => setDrawerOpen(false)}>✕</button>
            </div>
            <nav className="drawer-nav">
              {NAV.map(n => (
                <button key={n.id} className={`nav-btn ${view===n.id?'active':''}`} onClick={() => navigate(n.id)}>
                  <span className="nav-icon">{n.icon}</span><span>{n.label}</span>
                </button>
              ))}
            </nav>
            <div style={{padding:'10px 10px 16px',borderTop:'1px solid var(--border)'}}>
              <div className="exp-meta">
                <div className="exp-id">{expediente.chat_id||'Sin expediente'}</div>
                <div className="exp-date">{expediente.date} · {expediente.orders.length} órdenes</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── FABs (mobile only) ── */}
      <div className="fab-group">
        <button className="fab fab-upload"   onClick={() => setIoPopup('upload')}   title="Cargar">
          <span className="fab-icon">↑</span><span className="fab-label">Cargar</span>
        </button>
        <button className="fab fab-download" onClick={() => setIoPopup('download')} title="Exportar">
          <span className="fab-icon">↓</span><span className="fab-label">Exportar</span>
        </button>
      </div>

      {/* ── IO Popup ── */}
      {ioPopup && (
        <div className="io-overlay" onClick={e => e.target===e.currentTarget && setIoPopup(null)}>
          <div className="io-popup">
            <div className="io-popup-header">
              <div className="io-popup-icon-wrap">{ioPopup==='upload' ? '↑' : '↓'}</div>
              <div>
                <div className="io-popup-title">{ioPopup==='upload' ? 'Cargar Expediente' : 'Exportar Expediente'}</div>
                <div className="io-popup-sub">{ioPopup==='upload' ? 'JSON o CSV — Binance C2C' : 'JSON · CSV'}</div>
              </div>
              <button className="io-popup-close" onClick={() => setIoPopup(null)}>✕</button>
            </div>
            <div className="io-popup-body">
              {ioPopup === 'upload' ? (
                <>
                  <label className="io-drop-zone">
                    <span className="io-drop-icon">📂</span>
                    <span className="io-drop-label">Toca para seleccionar archivo</span>
                    <span className="io-drop-sub">SOPORTA .JSON Y .CSV (BINANCE C2C)</span>
                    <input type="file" accept=".json,.csv" onChange={handleUpload} hidden />
                  </label>
                  <div style={{marginTop:12, fontSize:10, color:'var(--text-3)', lineHeight:1.6}}>
                    • <b style={{color:'var(--text-2)'}}>JSON:</b> expediente del bot (formato completo)<br/>
                    • <b style={{color:'var(--text-2)'}}>CSV:</b> historial de órdenes C2C de Binance
                  </div>
                </>
              ) : (
                <>
                  <div className="io-exp-preview">
                    <div className="io-preview-row"><span>Expediente</span><span>{expediente.chat_id||'—'}</span></div>
                    <div className="io-preview-row"><span>Fecha</span><span>{expediente.date}</span></div>
                    <div className="io-preview-row"><span>Órdenes</span><span>{expediente.orders.length}</span></div>
                    <div className="io-preview-row"><span>Ciclos</span><span>{expediente.cycles.length}</span></div>
                  </div>
                  <div style={{display:'flex', gap:10}}>
                    <button className="io-popup-action" style={{flex:1}} onClick={handleDownloadJSON}>
                      ↓ Descargar JSON
                    </button>
                    <button className="io-popup-action" style={{flex:1, borderColor:'var(--blue-dim)', color:'var(--blue)', background:'var(--blue-bg)'}} onClick={handleDownloadCSV}>
                      ↓ Descargar CSV
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
