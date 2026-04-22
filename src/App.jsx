import React, { useState, useCallback, useRef, useEffect } from 'react';
import { enrichExpediente, EMPTY_EXPEDIENTE, validateExpediente, computeCycles, computeStats } from './utils/expediente';
import Dashboard from './pages/Dashboard';
import OrdersTable from './pages/OrdersTable';
import CyclesView from './pages/CyclesView';
import Calculator from './pages/Calculator';
import './App.css';

const NAV = [
  { id: 'dashboard',  label: 'Dashboard',   icon: '◈' },
  { id: 'orders',     label: 'Órdenes',     icon: '≡' },
  { id: 'cycles',     label: 'Ciclos',      icon: '◎' },
  { id: 'calculator', label: 'Calculadora', icon: '⟁' },
];

function IOPopup({ type, onClose, onUpload, onDownload, expediente }) {
  const fileRef = useRef();
  const isUpload = type === 'upload';
  return (
    <div className="io-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="io-popup">
        <div className="io-popup-header">
          <div className="io-popup-icon-wrap">{isUpload ? '↑' : '↓'}</div>
          <div style={{ flex: 1 }}>
            <div className="io-popup-title">{isUpload ? 'Cargar Expediente' : 'Exportar Expediente'}</div>
            <div className="io-popup-sub">{isUpload ? 'Selecciona un archivo .json del bot' : 'Descarga el expediente actual'}</div>
          </div>
          <button className="io-popup-close" onClick={onClose}>✕</button>
        </div>
        {isUpload ? (
          <div className="io-popup-body">
            <div className="io-drop-zone" onClick={() => fileRef.current?.click()}>
              <div className="io-drop-icon">📂</div>
              <div className="io-drop-label">Toca para seleccionar archivo</div>
              <div className="io-drop-sub">expediente_*.json</div>
              <input ref={fileRef} type="file" accept=".json" onChange={e => { onUpload(e); onClose(); }} hidden />
            </div>
          </div>
        ) : (
          <div className="io-popup-body">
            <div className="io-exp-preview">
              <div className="io-preview-row"><span>Chat ID</span><span>{expediente.chat_id || '—'}</span></div>
              <div className="io-preview-row"><span>Fecha</span><span>{expediente.date}</span></div>
              <div className="io-preview-row"><span>Órdenes</span><span>{expediente.orders?.length || 0}</span></div>
              <div className="io-preview-row"><span>Ciclos</span><span>{expediente.cycles?.length || 0}</span></div>
            </div>
            <button className="io-popup-action" onClick={() => { onDownload(); onClose(); }}>↓ Descargar JSON</button>
          </div>
        )}
      </div>
    </div>
  );
}

function MobileDrawer({ view, setView, onClose }) {
  return (
    <div className="drawer-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="drawer">
        <div className="drawer-header">
          <span className="brand-icon" style={{ fontSize: 24 }}>⬡</span>
          <div style={{ flex: 1 }}>
            <div className="brand-title">GOD ANALYZER</div>
            <div className="brand-sub">BETA</div>
          </div>
          <button className="drawer-close" onClick={onClose}>✕</button>
        </div>
        <nav className="drawer-nav">
          {NAV.map(n => (
            <button key={n.id} className={`nav-btn ${view === n.id ? 'active' : ''}`}
              onClick={() => { setView(n.id); onClose(); }}>
              <span className="nav-icon">{n.icon}</span>
              <span>{n.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}

export default function App() {
  const [view, setView]             = useState('dashboard');
  const [expediente, setExpediente] = useState(() => enrichExpediente({ ...EMPTY_EXPEDIENTE }));
  const [toast, setToast]           = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [ioPopup, setIoPopup]       = useState(null);

  const showToast = useCallback((msg, type = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  }, []);

  const updateOrders = useCallback((newOrders) => {
    setExpediente(prev => {
      const cycles = computeCycles(newOrders);
      const stats  = computeStats(newOrders);
      return { ...prev, orders: newOrders, cycles, stats };
    });
  }, []);

  const handleUpload = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!validateExpediente(data)) throw new Error('Formato inválido');
        setExpediente(enrichExpediente(data));
        showToast(`✓ Expediente cargado — ${data.orders?.length || 0} órdenes`, 'ok');
      } catch (err) {
        showToast('✗ Error: ' + err.message, 'err');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [showToast]);

  const handleDownload = useCallback(() => {
    const clean = {
      chat_id: expediente.chat_id,
      date: expediente.date,
      orders: expediente.orders.map(({ id, ...rest }) => rest),
      cycles: expediente.cycles,
      stats: expediente.stats,
      bank_receipts: expediente.bank_receipts || []
    };
    const blob = new Blob([JSON.stringify(clean, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `expediente_${expediente.chat_id || 'export'}_${expediente.date || 'hoy'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('✓ JSON descargado', 'ok');
  }, [expediente, showToast]);

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') { setDrawerOpen(false); setIoPopup(null); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  // Lock body scroll when overlay open
  useEffect(() => {
    document.body.style.overflow = (drawerOpen || ioPopup) ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen, ioPopup]);

  const PAGE = { dashboard: Dashboard, orders: OrdersTable, cycles: CyclesView, calculator: Calculator };
  const CurrentPage  = PAGE[view];
  const currentNav   = NAV.find(n => n.id === view);

  return (
    <div className="app-shell">

      {/* Desktop sidebar */}
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
            <button key={n.id} className={`nav-btn ${view === n.id ? 'active' : ''}`} onClick={() => setView(n.id)}>
              <span className="nav-icon">{n.icon}</span>
              <span>{n.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-io">
          <div className="exp-meta">
            <div className="exp-id">{expediente.chat_id || 'Sin expediente'}</div>
            <div className="exp-date">{expediente.date}</div>
          </div>
          <label className="io-btn upload-btn">
            ↑ Cargar JSON
            <input type="file" accept=".json" onChange={handleUpload} hidden />
          </label>
          <button className="io-btn download-btn" onClick={handleDownload}>↓ Exportar JSON</button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="mobile-topbar">
        <button className="hamburger" onClick={() => setDrawerOpen(true)} aria-label="Abrir menú">
          <span/><span/><span/>
        </button>
        <div className="mobile-brand">
          <span style={{ color: 'var(--green)', fontSize: 20, lineHeight: 1 }}>⬡</span>
          <span className="brand-title" style={{ fontSize: 12, letterSpacing: '0.12em' }}>GOD ANALYZER</span>
        </div>
        <div className="mobile-page-label">
          <span>{currentNav?.icon}</span>
          <span>{currentNav?.label}</span>
        </div>
      </header>

      {/* Main content */}
      <main className="main-content">
        <CurrentPage expediente={expediente} onUpdateOrders={updateOrders} showToast={showToast} />
      </main>

      {/* Mobile drawer */}
      {drawerOpen && <MobileDrawer view={view} setView={setView} onClose={() => setDrawerOpen(false)} />}

      {/* Mobile FAB buttons */}
      <div className="fab-group">
        <button className="fab fab-upload" onClick={() => setIoPopup('upload')}>
          <span className="fab-icon">↑</span>
          <span className="fab-label">Cargar</span>
        </button>
        <button className="fab fab-download" onClick={() => setIoPopup('download')}>
          <span className="fab-icon">↓</span>
          <span className="fab-label">Exportar</span>
        </button>
      </div>

      {/* IO Popup */}
      {ioPopup && (
        <IOPopup type={ioPopup} onClose={() => setIoPopup(null)}
          onUpload={handleUpload} onDownload={handleDownload} expediente={expediente} />
      )}

      {/* Toast */}
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
