import React, { useState, useRef } from 'react';

export default function EnrollModal({ faceImage, onClose, onEnrolled }) {
  const [usn, setUsn] = useState('');
  const [name, setName] = useState('');
  const [section, setSection] = useState('');
  const [consentGiven, setConsentGiven] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!usn.trim() || !name.trim()) {
      setError('USN and Name are required');
      return;
    }
    if (!consentGiven) {
      setError('Biometric consent is required to enroll face photos');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const backendUrl = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '');
      const res = await fetch(`${backendUrl}/api/v1/students/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usn: usn.trim().toUpperCase(),
          name: name.trim(),
          section: section.trim(),
          face_image: faceImage, // base64 JPEG from canvas capture
          consent_given: consentGiven,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `Server error: ${res.status}`);
      }

      const data = await res.json();
      onEnrolled?.(data);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to enroll student');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: '520px' }}>
        <h2 className="modal-title">📸 Enroll New Student</h2>
        <p className="modal-subtitle">
          A face was detected. Fill in the details to register this student.
        </p>

        {/* Face preview */}
        {faceImage && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: '20px',
          }}>
            <img
              src={`data:image/jpeg;base64,${faceImage}`}
              alt="Captured face"
              style={{
                width: '120px',
                height: '120px',
                objectFit: 'cover',
                borderRadius: 'var(--radius-lg)',
                border: '3px solid var(--teal)',
                boxShadow: 'var(--shadow-md)',
              }}
            />
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="modal-field">
            <label className="modal-label">USN (University Seat Number)</label>
            <input
              className="modal-input"
              type="text"
              placeholder="e.g. 1HK23AI048"
              value={usn}
              onChange={(e) => setUsn(e.target.value)}
              autoFocus
            />
          </div>

          <div className="modal-field">
            <label className="modal-label">Full Name</label>
            <input
              className="modal-input"
              type="text"
              placeholder="e.g. John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="modal-field">
            <label className="modal-label">Section (optional)</label>
            <input
              className="modal-input"
              type="text"
              placeholder="e.g. A"
              value={section}
              onChange={(e) => setSection(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '16px 0' }}>
            <input
              id="quick-consent"
              type="checkbox"
              checked={consentGiven}
              onChange={(e) => setConsentGiven(e.target.checked)}
              style={{ width: 18, height: 18, cursor: 'pointer' }}
            />
            <label htmlFor="quick-consent" style={{ cursor: 'pointer', fontSize: 13, color: 'var(--ink)', userSelect: 'none' }}>
              I consent to face recognition processing for attendance
            </label>
          </div>

          {error && (
            <div style={{
              color: 'var(--danger)',
              background: 'var(--danger-dim)',
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              fontSize: '13px',
              marginBottom: '12px',
            }}>
              ⚠️ {error}
            </div>
          )}

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ minWidth: '120px' }}
            >
              {loading ? '⏳ Enrolling...' : '✅ Enroll Student'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
