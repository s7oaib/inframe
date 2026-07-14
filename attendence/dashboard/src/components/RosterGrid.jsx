import StatusBadge from './StatusBadge';

function formatTime(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function ConfidenceIndicator({ value }) {
  if (value == null) return <span className="time-cell">—</span>;
  const pct = Math.round(value * 100);
  const level = pct >= 85 ? 'high' : pct >= 60 ? 'medium' : 'low';

  return (
    <div className="confidence-bar">
      <div className="confidence-track">
        <div className={`confidence-fill ${level}`} style={{ width: `${pct}%` }} />
      </div>
      <span style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--ink-soft)' }}>
        {pct}%
      </span>
    </div>
  );
}

export default function RosterGrid({ records, onOverride }) {
  if (!records || records.length === 0) {
    return (
      <div className="roster-card">
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <div className="empty-state-title">No records yet</div>
          <div className="empty-state-body">
            Select a date with attendance data, or wait for the camera to start detecting students.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="roster-card">
      <table className="roster-table">
        <thead>
          <tr>
            <th>USN</th>
            <th>Name</th>
            <th>Check In</th>
            <th>Last Seen</th>
            <th>Status</th>
            <th>Source</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.id}>
              <td className="usn-cell">{r.usn}</td>
              <td className="name-cell">{r.name || '—'}</td>
              <td className="time-cell">{formatTime(r.check_in_time)}</td>
              <td className="time-cell">{formatTime(r.last_seen_time)}</td>
              <td>
                <StatusBadge status={r.status} source={r.status_source} />
              </td>
              <td className="time-cell" style={{ textTransform: 'lowercase' }}>
                {r.status_source}
              </td>
              <td>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => onOverride(r)}
                  title="Override attendance status"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
