import { useState, useEffect } from 'react';
import { fetchAuditLogs } from '../api/client';

function formatTimestamp(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function parseDetails(detailsStr) {
  try {
    const obj = JSON.parse(detailsStr);
    return Object.entries(obj)
      .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
      .join(' · ');
  } catch {
    return detailsStr || '—';
  }
}

const ACTION_COLORS = {
  EVENT_PROCESSED: 'var(--teal)',
  STATUS_OVERRIDE: 'var(--pulse)',
  SESSION_CLOSED: 'var(--amber)',
  PERSON_CREATED: 'var(--teal)',
  PERSON_DEACTIVATED: 'var(--pulse)',
  PHOTOS_ENROLLED: 'var(--teal)',
  UNMATCHED_EVENT: 'var(--ink-muted)',
};

export default function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const loadLogs = async (newOffset = 0) => {
    setLoading(true);
    try {
      const data = await fetchAuditLogs(limit, newOffset);
      setLogs(data);
      setOffset(newOffset);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <h1 className="page-title">Audit Log</h1>
        <p className="page-subtitle">
          Every automated decision and manual correction is logged with who, when, and why.
        </p>
      </div>

      {logs.length === 0 && !loading ? (
        <div className="roster-card">
          <div className="empty-state">
            <div className="empty-state-icon">📄</div>
            <div className="empty-state-title">No audit entries yet</div>
            <div className="empty-state-body">
              Events and corrections will appear here as the system processes attendance.
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="audit-list">
            {logs.map((log) => (
              <div className="audit-item" key={log.id}>
                <span className="audit-time">{formatTimestamp(log.timestamp)}</span>
                <span
                  className="audit-action"
                  style={{ color: ACTION_COLORS[log.action] || 'var(--ink)' }}
                >
                  {log.action}
                </span>
                <span className="audit-details">
                  {log.target_entity && (
                    <span style={{
                      fontFamily: 'var(--mono)', fontSize: 11,
                      color: 'var(--ink-muted)', marginRight: 8,
                    }}>
                      {log.target_entity}/{log.target_id}
                    </span>
                  )}
                  {parseDetails(log.details)}
                </span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 24 }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => loadLogs(Math.max(0, offset - limit))}
              disabled={offset === 0 || loading}
            >
              ← Newer
            </button>
            <span style={{
              fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-muted)',
              display: 'flex', alignItems: 'center',
            }}>
              {offset + 1}–{offset + logs.length}
            </span>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => loadLogs(offset + limit)}
              disabled={logs.length < limit || loading}
            >
              Older →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
