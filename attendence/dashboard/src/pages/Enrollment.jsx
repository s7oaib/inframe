import { useState, useEffect } from 'react';
import EnrollmentForm from '../components/EnrollmentForm';
import { fetchPersons, createPerson, enrollPhotos, deletePerson, reactivatePerson, updateConsent } from '../api/client';

export default function Enrollment() {
  const [persons, setPersons] = useState([]);
  const [loading, setLoading] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [message, setMessage] = useState(null);

  const loadPersons = async () => {
    setLoading(true);
    try {
      const data = await fetchPersons(false);
      setPersons(data);
    } catch (err) {
      console.error('Failed to load persons:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPersons();
  }, []);

  const handleEnroll = async ({ usn, name, consent_given, files }) => {
    setEnrolling(true);
    setMessage(null);
    try {
      // Step 1: Create the person if they don't exist
      try {
        await createPerson({ usn, name: name || null, consent_given });
      } catch (err) {
        // 409 = already exists, which is fine
        if (!err.message.includes('already exists')) throw err;
      }

      // Step 2: Upload photos for face enrollment
      if (files.length > 0) {
        const result = await enrollPhotos(usn, files);
        setMessage({ type: 'success', text: result.message });
      } else {
        setMessage({ type: 'success', text: `${usn} added to roster (no photos uploaded).` });
      }

      loadPersons();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setEnrolling(false);
    }
  };

  const handleDeactivate = async (usn) => {
    if (!confirm(`Deactivate ${usn}? This will remove their face embedding.`)) return;
    try {
      await deletePerson(usn);
      setMessage({ type: 'success', text: `${usn} deactivated.` });
      loadPersons();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleReactivate = async (usn) => {
    try {
      await reactivatePerson(usn);
      setMessage({ type: 'success', text: `${usn} reactivated. Please enroll their photos.` });
      loadPersons();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleToggleConsent = async (usn, currentConsent) => {
    const nextConsent = !currentConsent;
    if (currentConsent && !confirm(`Revoke biometric consent for ${usn}? This will delete their enrolled face embedding.`)) {
      return;
    }
    try {
      await updateConsent(usn, nextConsent);
      setMessage({ type: 'success', text: `Consent ${nextConsent ? 'granted' : 'revoked'} for ${usn}.` });
      loadPersons();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <h1 className="page-title">Student Enrollment</h1>
        <p className="page-subtitle">
          Add students to the roster and upload photos for face recognition enrollment.
        </p>
      </div>

      {message && (
        <div
          className={`toast ${message.type === 'success' ? 'toast-success' : 'toast-error'}`}
          style={{ position: 'static', marginBottom: 20 }}
        >
          {message.type === 'success' ? '✓' : '⚠'} {message.text}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
        <div>
          <h2 style={{
            fontFamily: 'var(--display)', fontWeight: 600, fontSize: 18,
            marginBottom: 16, color: 'var(--ink)'
          }}>
            Enroll New Student
          </h2>
          <EnrollmentForm onSubmit={handleEnroll} loading={enrolling} />
        </div>

        <div>
          <h2 style={{
            fontFamily: 'var(--display)', fontWeight: 600, fontSize: 18,
            marginBottom: 16, color: 'var(--ink)'
          }}>
            Enrolled Students ({persons.length})
          </h2>

          <div className="roster-card">
            {persons.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">👤</div>
                <div className="empty-state-title">No students enrolled</div>
                <div className="empty-state-body">
                  Use the form on the left to add students to the roster.
                </div>
              </div>
            ) : (
              <table className="roster-table">
                <thead>
                  <tr>
                    <th>USN</th>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Consent</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {persons.map((p) => (
                    <tr key={p.usn}>
                      <td className="usn-cell">{p.usn}</td>
                      <td className="name-cell">{p.name || '—'}</td>
                      <td>
                        <span className={`badge ${p.active ? 'badge-present' : 'badge-absent'}`}>
                          {p.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${p.consent_given ? 'badge-present' : 'badge-absent'}`} style={{
                          backgroundColor: p.consent_given ? 'rgba(20, 184, 166, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                          color: p.consent_given ? 'var(--teal)' : 'var(--pulse)',
                          border: `1px solid ${p.consent_given ? 'rgba(20, 184, 166, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                        }}>
                          {p.consent_given ? 'Biometric Opt-In' : 'Opted Out'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {p.active ? (
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => handleDeactivate(p.usn)}
                              style={{ color: 'var(--pulse)' }}
                            >
                              Deactivate
                            </button>
                          ) : (
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => handleReactivate(p.usn)}
                              style={{ color: 'var(--teal)' }}
                            >
                              Reactivate
                            </button>
                          )}
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleToggleConsent(p.usn, p.consent_given)}
                            style={{ color: p.consent_given ? 'var(--pulse)' : 'var(--teal)' }}
                          >
                            {p.consent_given ? 'Revoke Consent' : 'Grant Consent'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
