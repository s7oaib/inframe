import { useState, useEffect, useCallback, useRef } from 'react';
import RosterGrid from '../components/RosterGrid';
import OverrideModal from '../components/OverrideModal';
import ExportButton from '../components/ExportButton';
import { fetchSessions, createSession, fetchAttendance, overrideAttendance, exportAttendanceCSV, closeSession, deleteSession } from '../api/client';

export default function Dashboard() {
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [overrideTarget, setOverrideTarget] = useState(null);
  const [closing, setClosing] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  
  const wsRef = useRef(null);

  // Load available sessions
  const loadSessions = useCallback(async () => {
    try {
      const data = await fetchSessions();
      setSessions(data);
      if (activeSession) {
        const updated = data.find(s => s.id === activeSession.id);
        if (updated) setActiveSession(updated);
        else setActiveSession(data.length > 0 ? data[0] : null);
      } else if (data.length > 0) {
        setActiveSession(data[0]);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load sessions.');
    }
  }, [activeSession]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Load attendance for the selected session
  const loadAttendance = useCallback(async () => {
    if (!activeSession) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAttendance(activeSession.id);
      setRecords(data);
    } catch (err) {
      setError(err.message);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [activeSession]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  // WebSocket for real-time updates
  useEffect(() => {
    if (!activeSession) return;
    
    let wsUrl;
    if (import.meta.env.VITE_API_URL) {
      const parsed = new URL(import.meta.env.VITE_API_URL);
      const wsProtocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${wsProtocol}//${parsed.host}/ws`;
    } else {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = import.meta.env.DEV 
        ? `ws://localhost:8000/ws`
        : `${protocol}//${window.location.host}/ws`;
    }

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'attendance_update') {
          const update = msg.data;
          // Only process updates for the currently viewed session
          if (update.session_id !== activeSession.id) return;
          
          setRecords(prev => {
            const idx = prev.findIndex(r => r.usn === update.usn);
            if (idx === -1) {
              // New record (shouldn't happen often if we join persons, but just in case)
              return [...prev, update];
            }
            const updated = [...prev];
            updated[idx] = { ...updated[idx], ...update };
            return updated;
          });
        }
      } catch (e) {
        console.error('Error processing websocket message', e);
      }
    };

    return () => {
      ws.close();
    };
  }, [activeSession]);

  const handleCreateSession = async () => {
    if (!newSessionName) return alert('Enter a session name');
    try {
      const session = await createSession({ name: newSessionName, camera_id: 'CAM-01' });
      await loadSessions();
      setActiveSession(session);
      setNewSessionName('');
    } catch (e) {
      alert(e.message);
    }
  };

  const handleOverride = async (data) => {
    await overrideAttendance(overrideTarget.usn, { ...data, session_id: activeSession.id });
    setOverrideTarget(null);
    loadAttendance();
  };

  const handleExport = async () => {
    if (!activeSession) return;
    try {
      await exportAttendanceCSV(activeSession.id);
    } catch (err) {
      alert('Export failed: ' + err.message);
    }
  };

  const handleCloseSession = async () => {
    if (!activeSession) return;
    if (!confirm(`Close session ${activeSession.name}?`)) return;
    setClosing(true);
    try {
      const result = await closeSession(activeSession.id);
      alert(`Session closed: ${result.records_resolved} records resolved.`);
      loadSessions(); // Reload sessions to update active status
      loadAttendance();
    } catch (err) {
      alert('Close session failed: ' + err.message);
    } finally {
      setClosing(false);
    }
  };

  const handleDeleteSession = async () => {
    if (!activeSession) return;
    if (!confirm(`Are you sure you want to delete session "${activeSession.name}" and all its records? This cannot be undone.`)) return;
    try {
      await deleteSession(activeSession.id);
      alert(`Session deleted successfully.`);
      setActiveSession(null);
      loadSessions();
    } catch (err) {
      alert('Delete session failed: ' + err.message);
    }
  };

  // Compute stats
  const stats = records.reduce(
    (acc, r) => {
      acc.total++;
      if (r.status === 'PRESENT') acc.present++;
      else if (r.status === 'ABSENT') acc.absent++;
      else if (r.status === 'PENDING' || r.status === 'NEEDS_REVIEW') acc.pending++;
      else acc.other++;
      return acc;
    },
    { total: 0, present: 0, absent: 0, pending: 0, other: 0 }
  );

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <h1 className="page-title">Attendance Dashboard</h1>
        <p className="page-subtitle">
          Real-time attendance view.
        </p>
      </div>

      <div className="controls-bar" style={{ flexWrap: 'wrap', gap: '1rem' }}>
        <div className="controls-left" style={{ flex: '1' }}>
          <select 
            value={activeSession?.id || ''} 
            onChange={(e) => {
              const s = sessions.find(s => s.id === parseInt(e.target.value));
              if (s) setActiveSession(s);
            }}
            className="date-input"
          >
            {sessions.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} ({new Date(s.date).toLocaleDateString()}) - {s.is_active ? 'ACTIVE' : 'CLOSED'}
              </option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem' }}>
            <input 
              type="text" 
              placeholder="New Session Name" 
              value={newSessionName} 
              onChange={e => setNewSessionName(e.target.value)}
              className="date-input"
            />
            <button className="btn btn-primary btn-sm" onClick={handleCreateSession}>+ Start</button>
            {activeSession && !activeSession.is_active && (
              <button 
                className="btn btn-danger btn-sm" 
                onClick={handleDeleteSession}
                title="Delete closed session"
              >
                Delete Session
              </button>
            )}
          </div>
        </div>
        <div className="controls-right">
          {activeSession && (
            <>
              <button className="btn btn-ghost btn-sm" onClick={handleExport}>
                ↓ Export CSV
              </button>
              {activeSession.is_active && (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleCloseSession}
                  disabled={closing}
                >
                  {closing ? 'Closing...' : '✓ Close Session'}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {records.length > 0 && (
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-label">Total Students</div>
            <div className="stat-value ink">{stats.total}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Present</div>
            <div className="stat-value teal">{stats.present}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Absent</div>
            <div className="stat-value pulse">{stats.absent}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Pending Review</div>
            <div className="stat-value amber">{stats.pending}</div>
          </div>
        </div>
      )}

      {error && (
        <div className="toast toast-error" style={{ position: 'static', marginBottom: 16 }}>
          ⚠ {error}
        </div>
      )}

      {activeSession ? (
        <RosterGrid records={records} onOverride={setOverrideTarget} />
      ) : (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          No sessions available. Create one to start tracking attendance.
        </div>
      )}

      {overrideTarget && (
        <OverrideModal
          record={overrideTarget}
          onClose={() => setOverrideTarget(null)}
          onSubmit={handleOverride}
        />
      )}
    </div>
  );
}
