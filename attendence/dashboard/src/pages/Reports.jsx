import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { fetchSessions, fetchAttendance } from '../api/client';

export default function Reports() {
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // First of current month
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0]);

  const backendUrl = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '');

  const downloadReport = async (format) => {
    try {
      const url = `${backendUrl}/api/v1/reports/export?format=${format}&from=${fromDate}&to=${toDate}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const ext = format === 'excel' ? 'xlsx' : 'pdf';
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `attendance_${fromDate}_${toDate}.${ext}`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      console.error('Download error:', err);
      alert('Failed to download report. Make sure the backend is running.');
    }
  };

  useEffect(() => {
    fetchSessions().then(data => {
      setSessions(data);
      if (data.length > 0) {
        setSelectedSessionId(data[0].id.toString());
      }
    });
  }, []);

  useEffect(() => {
    if (!selectedSessionId) return;
    setLoading(true);
    fetchAttendance(selectedSessionId).then(records => {
      const summary = records.reduce(
        (acc, r) => {
          if (r.status === 'PRESENT') acc.Present++;
          else if (r.status === 'ABSENT') acc.Absent++;
          else if (r.status === 'PENDING' || r.status === 'NEEDS_REVIEW') acc.Pending++;
          else if (r.status === 'LEFT_EARLY') acc.LeftEarly++;
          return acc;
        },
        { Present: 0, Absent: 0, Pending: 0, LeftEarly: 0 }
      );
      setStats([
        { name: 'Present', count: summary.Present, fill: 'var(--teal)' },
        { name: 'Absent', count: summary.Absent, fill: 'var(--pulse)' },
        { name: 'Pending', count: summary.Pending, fill: 'var(--amber)' },
        { name: 'Left Early', count: summary.LeftEarly, fill: '#f59e0b' }
      ]);
      setLoading(false);
    });
  }, [selectedSessionId]);

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <h1 className="page-title">Reports & Analytics</h1>
        <p className="page-subtitle">Historical attendance data</p>
      </div>

      <div className="controls-bar">
        <select 
          value={selectedSessionId} 
          onChange={e => setSelectedSessionId(e.target.value)}
          className="date-input"
        >
          <option value="" disabled>Select Session</option>
          {sessions.map(s => (
            <option key={s.id} value={s.id}>
              {s.name} ({new Date(s.date).toLocaleDateString()})
            </option>
          ))}
        </select>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontFamily: 'var(--mono)', fontSize: '11px', textTransform: 'uppercase', color: 'var(--ink-muted)' }}>
            Export Range:
          </label>
          <input
            type="date"
            className="date-input"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
          />
          <span style={{ color: 'var(--ink-muted)' }}>→</span>
          <input
            type="date"
            className="date-input"
            value={toDate}
            onChange={e => setToDate(e.target.value)}
          />
          <button
            className="btn btn-primary"
            onClick={() => downloadReport('pdf')}
            style={{ gap: '6px' }}
          >
            📄 Download PDF
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => downloadReport('excel')}
            style={{ gap: '6px' }}
          >
            📊 Download Excel
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: '2rem', marginTop: '2rem', height: '400px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Loading data...</div>
        ) : stats ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="name" stroke="#888" />
              <YAxis stroke="#888" />
              <Tooltip cursor={{fill: 'rgba(255, 255, 255, 0.1)'}} contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: 'none' }} />
              <Bar dataKey="count" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No data available</div>
        )}
      </div>
    </div>
  );
}
