import { useState } from 'react';

const REASON_OPTIONS = [
  'Student was present — camera misidentified',
  'Student was present — seated in blind spot',
  'Student arrived late but attended most of session',
  'Student left early with instructor permission',
  'Student was absent — confirmed',
  'Technical issue — camera was offline',
  'Other — see notes',
];

const STATUS_OPTIONS = [
  { value: 'PRESENT', label: 'Present' },
  { value: 'ABSENT', label: 'Absent' },
  { value: 'LATE', label: 'Late' },
  { value: 'LEFT_EARLY', label: 'Left Early' },
];

export default function OverrideModal({ record, onClose, onSubmit }) {
  const [status, setStatus] = useState('PRESENT');
  const [reason, setReason] = useState(REASON_OPTIONS[0]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit({
        date: record.session_date,
        status,
        reason,
      });
      onClose();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">Override Attendance</h3>
        <p className="modal-subtitle">
          Correcting status for <strong>{record.usn}</strong>
          {record.name && <> ({record.name})</>}
          {' '}on {record.session_date}
        </p>

        <form onSubmit={handleSubmit}>
          <div className="modal-field">
            <label className="modal-label">New Status</label>
            <select
              id="override-status"
              className="modal-select"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="modal-field">
            <label className="modal-label">Reason</label>
            <select
              id="override-reason"
              className="modal-select"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            >
              {REASON_OPTIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Apply Override'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
