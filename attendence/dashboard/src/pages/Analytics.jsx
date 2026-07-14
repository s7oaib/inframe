import React, { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend, Filler
);

export default function Analytics() {
  const [daily, setDaily] = useState([]);
  const [summary, setSummary] = useState(null);
  const [topStudents, setTopStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  const backendUrl = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '');

  useEffect(() => {
    Promise.all([
      fetch(`${backendUrl}/api/v1/analytics/daily?days=30`).then(r => r.json()),
      fetch(`${backendUrl}/api/v1/analytics/summary`).then(r => r.json()),
      fetch(`${backendUrl}/api/v1/analytics/top-students?limit=10`).then(r => r.json()),
    ])
      .then(([dailyData, summaryData, topData]) => {
        setDaily(dailyData);
        setSummary(summaryData);
        setTopStudents(topData);
      })
      .catch(err => console.error('Analytics fetch error:', err))
      .finally(() => setLoading(false));
  }, []);

  // Chart: Daily attendance bar chart
  const dailyChartData = {
    labels: daily.map(d => {
      const dt = new Date(d.date);
      return dt.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    }),
    datasets: [
      {
        label: 'Present',
        data: daily.map(d => d.present),
        backgroundColor: 'rgba(45, 212, 191, 0.8)',
        borderRadius: 4,
      },
      {
        label: 'Absent',
        data: daily.map(d => d.absent),
        backgroundColor: 'rgba(255, 92, 57, 0.7)',
        borderRadius: 4,
      },
      {
        label: 'Late',
        data: daily.map(d => d.late),
        backgroundColor: 'rgba(251, 191, 36, 0.7)',
        borderRadius: 4,
      },
    ],
  };

  const dailyChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top', labels: { usePointStyle: true, padding: 20 } },
      tooltip: { mode: 'index', intersect: false },
    },
    scales: {
      x: { stacked: true, grid: { display: false } },
      y: { stacked: true, beginAtZero: true },
    },
  };

  // Chart: Attendance trend line
  const trendData = {
    labels: daily.map(d => {
      const dt = new Date(d.date);
      return dt.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    }),
    datasets: [
      {
        label: 'Attendance %',
        data: daily.map(d => d.total > 0 ? Math.round((d.present / d.total) * 100) : 0),
        borderColor: '#2dd4bf',
        backgroundColor: 'rgba(45, 212, 191, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointHoverRadius: 6,
      },
    ],
  };

  const trendOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.parsed.y}% attendance`,
        },
      },
    },
    scales: {
      y: { beginAtZero: true, max: 100, ticks: { callback: v => `${v}%` } },
      x: { grid: { display: false } },
    },
  };

  // Chart: Status doughnut
  const statusTotals = daily.reduce(
    (acc, d) => ({
      present: acc.present + d.present,
      absent: acc.absent + d.absent,
      late: acc.late + d.late,
      leftEarly: acc.leftEarly + d.left_early,
    }),
    { present: 0, absent: 0, late: 0, leftEarly: 0 }
  );

  const doughnutData = {
    labels: ['Present', 'Absent', 'Late', 'Left Early'],
    datasets: [
      {
        data: [statusTotals.present, statusTotals.absent, statusTotals.late, statusTotals.leftEarly],
        backgroundColor: [
          'rgba(45, 212, 191, 0.85)',
          'rgba(255, 92, 57, 0.85)',
          'rgba(251, 191, 36, 0.85)',
          'rgba(251, 146, 60, 0.85)',
        ],
        borderWidth: 0,
        hoverOffset: 8,
      },
    ],
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
      legend: { position: 'bottom', labels: { usePointStyle: true, padding: 16 } },
    },
  };

  if (loading) {
    return (
      <div className="page-wrapper" style={{ textAlign: 'center', padding: '100px 0' }}>
        <div style={{ fontSize: '32px', marginBottom: '12px' }}>📊</div>
        <p style={{ color: 'var(--ink-muted)' }}>Loading analytics...</p>
      </div>
    );
  }

  return (
    <div className="page-wrapper" style={{ maxWidth: '1400px' }}>
      <div className="page-header">
        <h1 className="page-title">📊 Attendance Analytics</h1>
        <p className="page-subtitle">Insights and trends from the last 30 days</p>
      </div>

      {/* Summary Cards */}
      <div className="stats-row" style={{ marginBottom: '28px' }}>
        <div className="stat-card">
          <div className="stat-label">Total Students</div>
          <div className="stat-value ink">{summary?.total_students || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Present Today</div>
          <div className="stat-value teal">{summary?.present_today || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg Attendance (30d)</div>
          <div className="stat-value" style={{ color: summary?.avg_attendance_pct >= 75 ? 'var(--teal)' : 'var(--pulse)' }}>
            {summary?.avg_attendance_pct || 0}%
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Sessions</div>
          <div className="stat-value amber">{summary?.total_sessions || 0}</div>
        </div>
      </div>

      {/* Charts Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '28px' }}>
        {/* Daily Bar Chart */}
        <div className="stat-card" style={{ padding: '24px' }}>
          <h3 style={{ fontFamily: 'var(--display)', fontWeight: 600, fontSize: '16px', marginBottom: '16px' }}>
            Daily Attendance
          </h3>
          <div style={{ height: '300px' }}>
            {daily.length > 0 ? (
              <Bar data={dailyChartData} options={dailyChartOptions} />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--ink-muted)' }}>
                No data yet — attendance will appear here after sessions run
              </div>
            )}
          </div>
        </div>

        {/* Trend Line */}
        <div className="stat-card" style={{ padding: '24px' }}>
          <h3 style={{ fontFamily: 'var(--display)', fontWeight: 600, fontSize: '16px', marginBottom: '16px' }}>
            Attendance Trend
          </h3>
          <div style={{ height: '300px' }}>
            {daily.length > 0 ? (
              <Line data={trendData} options={trendOptions} />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--ink-muted)' }}>
                No trend data available yet
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '24px' }}>
        {/* Doughnut */}
        <div className="stat-card" style={{ padding: '24px' }}>
          <h3 style={{ fontFamily: 'var(--display)', fontWeight: 600, fontSize: '16px', marginBottom: '16px' }}>
            Status Breakdown
          </h3>
          <div style={{ height: '280px' }}>
            {daily.length > 0 ? (
              <Doughnut data={doughnutData} options={doughnutOptions} />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--ink-muted)' }}>
                No data
              </div>
            )}
          </div>
        </div>

        {/* Student Leaderboard */}
        <div className="stat-card" style={{ padding: '24px', overflow: 'hidden' }}>
          <h3 style={{ fontFamily: 'var(--display)', fontWeight: 600, fontSize: '16px', marginBottom: '16px' }}>
            🏆 Top Students by Attendance
          </h3>
          {topStudents.length > 0 ? (
            <div style={{ overflowY: 'auto', maxHeight: '280px' }}>
              <table className="roster-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>USN</th>
                    <th>Name</th>
                    <th>Sessions</th>
                    <th>Attendance</th>
                  </tr>
                </thead>
                <tbody>
                  {topStudents.map((s, i) => (
                    <tr key={s.usn}>
                      <td style={{ fontWeight: 700, color: i < 3 ? 'var(--teal)' : 'var(--ink-muted)', fontFamily: 'var(--mono)' }}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                      </td>
                      <td className="usn-cell">{s.usn}</td>
                      <td className="name-cell">{s.name}</td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: '12.5px' }}>
                        {s.present_count}/{s.total_sessions}
                      </td>
                      <td>
                        <div className="confidence-bar">
                          <div className="confidence-track" style={{ width: '64px' }}>
                            <div
                              className={`confidence-fill ${s.pct >= 90 ? 'high' : s.pct >= 75 ? 'medium' : 'low'}`}
                              style={{ width: `${s.pct}%` }}
                            />
                          </div>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: '12px', fontWeight: 600 }}>
                            {s.pct}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ color: 'var(--ink-muted)', textAlign: 'center', padding: '40px 0', fontSize: '13px' }}>
              No student data yet. Leaderboard populates after attendance sessions.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
