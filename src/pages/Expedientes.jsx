import React, { useState } from 'react';
import { formatUSDTShort } from '../utils/expediente';

export default function Expedientes({ savedExpedientes, onLoad, onDelete, onRename }) {
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName]   = useState('');

  const startRename = (exp, e) => {
    e.stopPropagation();
    setEditingId(exp.id);
    setEditName(exp.name || '');
  };

  const confirmRename = (id) => {
    onRename(id, editName.trim());
    setEditingId(null);
    setEditName('');
  };

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">Expedientes de Terceros</div>
        <div className="page-sub">{savedExpedientes.length} EXPEDIENTES GUARDADOS EN CACHÉ</div>
      </div>

      {savedExpedientes.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: '60px 20px', fontSize: 12, lineHeight: 2 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📂</div>
          Sin expedientes guardados.<br/>
          Carga un CSV o JSON desde "Cargar" y usa "+ Guardar expediente" para guardarlo aquí.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {savedExpedientes.map((exp) => (
            <div
              key={exp.id}
              onClick={() => onLoad(exp.id)}
              style={{
                background: 'var(--bg-2)',
                borderRadius: 'var(--radius-md)',
                padding: '14px 18px',
                cursor: 'pointer',
                border: '1px solid var(--border)',
                transition: 'border-color 0.15s',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--green-dim)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 22 }}>{exp.name ? '📁' : '❓'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {editingId === exp.id ? (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                      <input
                        className="form-input"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') confirmRename(exp.id); if (e.key === 'Escape') setEditingId(null); }}
                        autoFocus
                        style={{ fontSize: 12, padding: '4px 8px', maxWidth: 200 }}
                        placeholder="Nombre del expediente"
                      />
                      <button className="btn btn-ghost" onClick={() => confirmRename(exp.id)} style={{ fontSize: 10, padding: '4px 8px' }}>✓</button>
                      <button className="btn btn-ghost" onClick={() => setEditingId(null)} style={{ fontSize: 10, padding: '4px 8px' }}>✕</button>
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {exp.name || 'Sin nombrar'}
                    </div>
                  )}
                  <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2, display: 'flex', gap: 12 }}>
                    <span>{exp.data.date}</span>
                    <span>{exp.data.orders?.length || 0} órdenes</span>
                    <span>{exp.data.cycles?.length || 0} ciclos</span>
                    {exp.data.stats?.net_profit_usdt != null && (
                      <span style={{ color: exp.data.stats.net_profit_usdt >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {formatUSDTShort(exp.data.stats.net_profit_usdt)} USDT
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                <button
                  className="btn btn-ghost"
                  onClick={(e) => startRename(exp, e)}
                  style={{ fontSize: 10, padding: '4px 8px' }}
                  title="Renombrar"
                >
                  ✏️
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={(e) => { e.stopPropagation(); if (window.confirm('¿Eliminar este expediente? No se puede deshacer.')) onDelete(exp.id); }}
                  style={{ fontSize: 10, padding: '4px 8px', color: 'var(--red)' }}
                  title="Eliminar"
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
