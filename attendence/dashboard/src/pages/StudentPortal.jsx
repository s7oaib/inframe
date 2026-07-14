import React, { useState } from 'react';

export default function StudentPortal() {
  const [view, setView] = useState('login'); // login | register | dashboard
  const [usn, setUsn] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [student, setStudent] = useState(null);
  const [profile, setProfile] = useState(null);
  const [history, setHistory] = useState([]);

  const backendUrl = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/v1/student/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usn: usn.toUpperCase(), password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Login failed');
      }
      const data = await res.json();
      setStudent(data);
      await loadStudentData(data.usn);
      setView('dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/v1/student/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usn: usn.toUpperCase(), password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Registration failed');
      }
      setView('login');
      setError('');
      alert('Registration successful! You can now login.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadStudentData = async (studentUsn) => {
    try {
      const [profileRes, historyRes] = await Promise.all([
        fetch(`${backendUrl}/api/v1/student/profile/${studentUsn}`).then(r => r.json()),
        fetch(`${backendUrl}/api/v1/student/attendance/${studentUsn}?days=90`).then(r => r.json()),
      ]);
      setProfile(profileRes);
      setHistory(historyRes);
    } catch (err) {
      console.error('Failed to load student data:', err);
    }
  };

  const logout = () => {
    setStudent(null);
    setProfile(null);
    setHistory([]);
    setView('login');
    setUsn('');
    setPassword('');
  };

  // Login / Register form
  if (view === 'login' || view === 'register') {
    return (
      <div className="login-page">
        <div className="login-bg"></div>
        <div className="login-card" style={{ maxWidth: '400px' }}>
          <div className="login-icon-wrap">🎓</div>
          <h1 className="login-title">Student Portal</h1>
          <p className="login-subtitle">
            {view === 'login' ? 'View your attendance records' : 'Create your portal account'}
          </p>

          <form className="login-form" onSubmit={view === 'login' ? handleLogin : handleRegister}>
            <div className="login-field">
              <div className="login-input-wrapper">
                <div className="login-input-icon">🆔</div>
                <input
                  type="text"
                  placeholder="USN (e.g. 1HK23AI048)"
                  value={usn}
                  onChange={e => setUsn(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="login-field">
              <div className="login-input-wrapper">
                <div className="login-input-icon">🔒</div>
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            {error && <div className="login-error">⚠️ {error}</div>}

            <button type="submit" className="login-submit" disabled={loading}>
              {loading ? <span className="login-spinner"></span> : null}
              {view === 'login' ? 'Sign In' : 'Register'}
            </button>
          </form>

          <button
            className="login-back-link"
            onClick={() => { setView(view === 'login' ? 'register' : 'login'); setError(''); }}
            style={{ border: 'none', background: 'none', cursor: 'pointer' }}
          >
            {view === 'login' ? "Don't have an account? Register" : 'Already registered? Login'}
          </button>

          <a href="/" className="login-back-link" style={{ marginTop: '8px' }}>
            ← Back to home
          </a>
        </div>
      </div>
    );
  }

  // Student Dashboard
  return (
    <div style={{ minHeight: '100vh', background: 'var(--canvas)' }}>
      {/* Header */}
      <div style={{
        background: 'var(--white)',
        borderBottom: '1px solid var(--line)',
        padding: '16px 28px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: '18px' }}>
            🎓 Student Portal
          </span>
          <span className="navbar-badge">
            {student?.usn}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ color: 'var(--ink-soft)', fontSize: '14px' }}>
            Welcome, {student?.name}
          </span>
          <button className="btn btn-ghost" onClick={logout}>Logout</button>
        </div>
      </div>

      <div className="page-wrapper" style={{ maxWidth: '1000px' }}>
        {/* Profile Cards */}
        {profile && (
          <>
            <div className="stats-row" style={{ marginBottom: '28px' }}>
              <div className="stat-card">
                <div className="stat-label">Your USN</div>
                <div style={{ fontFamily: 'var(--mono)', fontWeight: 600, fontSize: '18px' }}>{profile.usn}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Sessions Attended</div>
                <div className="stat-value teal">{profile.present_count}</div>
                <div style={{ fontSize: '12px', color: 'var(--ink-muted)' }}>of {profile.total_sessions} total</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Attendance %</div>
                <div className="stat-value" style={{
                  color: profile.attendance_pct >= 75 ? 'var(--teal)' : profile.attendance_pct >= 60 ? 'var(--amber)' : 'var(--pulse)',
                }}>
                  {profile.attendance_pct}%
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Standing</div>
                <div style={{
                  fontFamily: 'var(--display)',
                  fontWeight: 600,
                  fontSize: '16px',
                  color: profile.status === 'Good Standing' ? 'var(--teal)' :
                         profile.status === 'At Risk' ? 'var(--amber)' : 'var(--pulse)',
                }}>
                  {profile.status === 'Good Standing' ? '✅' : profile.status === 'At Risk' ? '⚠️' : '🚨'} {profile.status}
                </div>
              </div>
            </div>

            {/* Attendance Progress Bar */}
            <div className="stat-card" style={{ marginBottom: '28px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: '12px', textTransform: 'uppercase', color: 'var(--ink-muted)' }}>
                  Attendance Progress
                </span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: '12px', fontWeight: 600 }}>
                  {profile.attendance_pct}% / 75% required
                </span>
              </div>
              <div style={{
                height: '12px',
                background: 'var(--canvas-dim)',
                borderRadius: '6px',
                overflow: 'hidden',
                position: 'relative',
              }}>
                {/* 75% threshold marker */}
                <div style={{
                  position: 'absolute',
                  left: '75%',
                  top: 0,
                  bottom: 0,
                  width: '2px',
                  background: 'var(--ink-muted)',
                  zIndex: 2,
                }} />
                <div style={{
                  height: '100%',
                  width: `${Math.min(profile.attendance_pct, 100)}%`,
                  background: profile.attendance_pct >= 75
                    ? 'linear-gradient(90deg, var(--teal), var(--teal-dark))'
                    : profile.attendance_pct >= 60
                      ? 'linear-gradient(90deg, var(--amber), var(--amber-dark))'
                      : 'linear-gradient(90deg, var(--pulse), var(--pulse-dark))',
                  borderRadius: '6px',
                  transition: 'width 0.5s ease',
                }} />
              </div>
            </div>
          </>
        )}

        {/* Attendance History */}
        <div className="roster-card">
          <div style={{ padding: '16px', borderBottom: '1px solid var(--line)', background: 'var(--canvas)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--display)', fontWeight: 600, fontSize: '15px' }}>
              📋 Attendance History (Last 90 Days)
            </span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-muted)' }}>
              {history.length} records
            </span>
          </div>
          <table className="roster-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Class</th>
                <th>Check In</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '40px', color: 'var(--ink-muted)' }}>
                    No attendance records found
                  </td>
                </tr>
              ) : (
                history.map((h, i) => (
                  <tr key={i}>
                    <td className="time-cell">{h.date}</td>
                    <td className="name-cell">{h.session_name || '—'}</td>
                    <td className="time-cell">{h.check_in_time || '—'}</td>
                    <td>
                      <span className={`badge badge-${h.status.toLowerCase().replace('_', '-')}`}>
                        {h.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
