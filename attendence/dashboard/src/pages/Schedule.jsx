import React, { useEffect, useState } from 'react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const EMPTY_SLOT = { day_of_week: 0, subject: '', teacher: '', start_time: '09:00', end_time: '10:00', classroom: '' };

export default function Schedule() {
  const [slots, setSlots] = useState([]);
  const [editSlot, setEditSlot] = useState(null);
  const [formData, setFormData] = useState(EMPTY_SLOT);
  const [loading, setLoading] = useState(true);
  const [currentClass, setCurrentClass] = useState(null);

  const backendUrl = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '');

  const fetchSchedule = async () => {
    try {
      const [slotsRes, currentRes] = await Promise.all([
        fetch(`${backendUrl}/api/v1/schedule`).then(r => r.json()),
        fetch(`${backendUrl}/api/v1/schedule/current`).then(r => r.json()),
      ]);
      setSlots(slotsRes);
      setCurrentClass(currentRes);
    } catch (err) {
      console.error('Failed to load schedule:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSchedule(); }, []);

  const handleSave = async () => {
    try {
      const url = editSlot?.id
        ? `${backendUrl}/api/v1/schedule/${editSlot.id}`
        : `${backendUrl}/api/v1/schedule`;
      const method = editSlot?.id ? 'PUT' : 'POST';

      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      setEditSlot(null);
      setFormData(EMPTY_SLOT);
      fetchSchedule();
    } catch (err) {
      console.error('Save failed:', err);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this class slot?')) return;
    try {
      await fetch(`${backendUrl}/api/v1/schedule/${id}`, { method: 'DELETE' });
      fetchSchedule();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const openEdit = (slot) => {
    setEditSlot(slot);
    setFormData({
      day_of_week: slot.day_of_week,
      subject: slot.subject,
      teacher: slot.teacher || '',
      start_time: slot.start_time,
      end_time: slot.end_time,
      classroom: slot.classroom || '',
    });
  };

  const openNew = (day = 0) => {
    setEditSlot({});
    setFormData({ ...EMPTY_SLOT, day_of_week: day });
  };

  // Group slots by day
  const slotsByDay = DAYS.map((_, i) => slots.filter(s => s.day_of_week === i));

  if (loading) {
    return (
      <div className="page-wrapper" style={{ textAlign: 'center', padding: '100px 0' }}>
        <div style={{ fontSize: '32px', marginBottom: '12px' }}>📅</div>
        <p style={{ color: 'var(--ink-muted)' }}>Loading schedule...</p>
      </div>
    );
  }

  return (
    <div className="page-wrapper" style={{ maxWidth: '1400px' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">📅 Class Schedule</h1>
          <p className="page-subtitle">
            Manage class timetable — attendance is auto-tagged to the active period
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => openNew()}>
          ➕ Add Class
        </button>
      </div>

      {/* Current class indicator */}
      {currentClass?.subject && (
        <div className="stat-card" style={{ marginBottom: '24px', borderLeft: '4px solid var(--teal)', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ fontSize: '24px' }}>🟢</div>
          <div>
            <div style={{ fontFamily: 'var(--display)', fontWeight: 600, fontSize: '16px' }}>
              Currently: {currentClass.subject}
            </div>
            <div style={{ color: 'var(--ink-muted)', fontSize: '13px', fontFamily: 'var(--mono)' }}>
              {currentClass.start_time} — {currentClass.end_time} • {currentClass.teacher || 'No teacher'} • {currentClass.classroom || 'No room'}
            </div>
          </div>
        </div>
      )}

      {/* Schedule Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
        {DAYS.slice(0, 6).map((day, dayIdx) => (
          <div key={day} className="stat-card" style={{ padding: '0', overflow: 'hidden' }}>
            <div style={{
              padding: '12px 16px',
              background: dayIdx === new Date().getDay() - 1 ? 'var(--teal-dim)' : 'var(--canvas)',
              borderBottom: '1px solid var(--line)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span style={{ fontFamily: 'var(--display)', fontWeight: 600, fontSize: '14px' }}>
                {dayIdx === new Date().getDay() - 1 ? `📍 ${day}` : day}
              </span>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => openNew(dayIdx)}
                style={{ fontSize: '16px', padding: '4px 8px' }}
              >
                +
              </button>
            </div>

            <div style={{ padding: '8px' }}>
              {slotsByDay[dayIdx].length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--ink-muted)', fontSize: '12px' }}>
                  No classes
                </div>
              ) : (
                slotsByDay[dayIdx].map(slot => (
                  <div
                    key={slot.id}
                    style={{
                      padding: '10px 12px',
                      marginBottom: '6px',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--canvas)',
                      border: '1px solid var(--line-light)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onClick={() => openEdit(slot)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, fontSize: '13px' }}>{slot.subject}</span>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={(e) => { e.stopPropagation(); handleDelete(slot.id); }}
                        style={{ fontSize: '11px', padding: '2px 6px', color: 'var(--danger)' }}
                      >
                        ✕
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '4px', fontSize: '11px', fontFamily: 'var(--mono)', color: 'var(--ink-muted)' }}>
                      <span>🕐 {slot.start_time}–{slot.end_time}</span>
                      {slot.teacher && <span>👤 {slot.teacher}</span>}
                    </div>
                    {slot.classroom && (
                      <div style={{ fontSize: '11px', color: 'var(--ink-muted)', marginTop: '2px' }}>
                        📍 {slot.classroom}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Edit/Create Modal */}
      {editSlot !== null && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setEditSlot(null)}>
          <div className="modal">
            <h2 className="modal-title">{editSlot.id ? 'Edit Class' : 'Add New Class'}</h2>
            <p className="modal-subtitle">Configure this time slot</p>

            <div className="modal-field">
              <label className="modal-label">Day</label>
              <select
                className="modal-select"
                value={formData.day_of_week}
                onChange={e => setFormData({ ...formData, day_of_week: parseInt(e.target.value) })}
              >
                {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>

            <div className="modal-field">
              <label className="modal-label">Subject</label>
              <input
                className="modal-input"
                placeholder="e.g. Data Structures"
                value={formData.subject}
                onChange={e => setFormData({ ...formData, subject: e.target.value })}
              />
            </div>

            <div className="modal-field">
              <label className="modal-label">Teacher</label>
              <input
                className="modal-input"
                placeholder="e.g. Prof. Kumar"
                value={formData.teacher}
                onChange={e => setFormData({ ...formData, teacher: e.target.value })}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="modal-field">
                <label className="modal-label">Start Time</label>
                <input
                  className="modal-input"
                  type="time"
                  value={formData.start_time}
                  onChange={e => setFormData({ ...formData, start_time: e.target.value })}
                />
              </div>
              <div className="modal-field">
                <label className="modal-label">End Time</label>
                <input
                  className="modal-input"
                  type="time"
                  value={formData.end_time}
                  onChange={e => setFormData({ ...formData, end_time: e.target.value })}
                />
              </div>
            </div>

            <div className="modal-field">
              <label className="modal-label">Classroom</label>
              <input
                className="modal-input"
                placeholder="e.g. Room 301"
                value={formData.classroom}
                onChange={e => setFormData({ ...formData, classroom: e.target.value })}
              />
            </div>

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setEditSlot(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>
                {editSlot.id ? '💾 Save Changes' : '✅ Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
