import { useState, useRef } from 'react';

export default function EnrollmentForm({ onSubmit, loading }) {
  const [usn, setUsn] = useState('');
  const [name, setName] = useState('');
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [dragover, setDragover] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);
  const fileInputRef = useRef(null);

  const handleFiles = (newFiles) => {
    if (!consentGiven) return;
    const validFiles = Array.from(newFiles).filter((f) =>
      f.type.startsWith('image/')
    );
    setFiles((prev) => [...prev, ...validFiles]);

    // Generate previews
    validFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviews((prev) => [...prev, e.target.result]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragover(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!usn.trim()) return;

    try {
      await onSubmit({ usn: usn.trim(), name: name.trim(), consent_given: consentGiven, files: consentGiven ? files : [] });
      // Reset form
      setUsn('');
      setName('');
      setConsentGiven(false);
      setFiles([]);
      setPreviews([]);
    } catch (err) {
      alert(err.message);
    }
  };

  const removePhoto = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="enrollment-card">
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label" htmlFor="enroll-usn">University Seat Number</label>
          <input
            id="enroll-usn"
            className="form-input"
            type="text"
            placeholder="e.g. 1HK23AI048"
            value={usn}
            onChange={(e) => setUsn(e.target.value.toUpperCase())}
            maxLength={15}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="enroll-name">Student Name (optional)</label>
          <input
            id="enroll-name"
            className="form-input"
            type="text"
            placeholder="e.g. Priya Sharma"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Enrollment Photos (3–5 recommended)</label>
          <div
            className={`upload-zone ${dragover ? 'dragover' : ''}`}
            onClick={() => consentGiven && fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); consentGiven && setDragover(true); }}
            onDragLeave={() => setDragover(false)}
            onDrop={handleDrop}
            style={{
              opacity: consentGiven ? 1 : 0.5,
              cursor: consentGiven ? 'pointer' : 'not-allowed',
              backgroundColor: consentGiven ? 'transparent' : 'rgba(0, 0, 0, 0.03)',
            }}
          >
            <div className="upload-icon">📷</div>
            <div className="upload-text">
              {consentGiven ? 'Drop photos here, or click to browse' : 'Biometric consent required to upload photos'}
            </div>
            <div className="upload-hint">
              {consentGiven ? 'JPG, PNG, or WebP · Multiple angles and lighting conditions work best' : 'Enable the checkbox below to unlock photo uploads'}
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => handleFiles(e.target.files)}
          />

          {previews.length > 0 && (
            <div className="photo-preview-row">
              {previews.map((src, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <img src={src} alt={`Photo ${i + 1}`} className="photo-preview" />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    style={{
                      position: 'absolute', top: -6, right: -6,
                      width: 20, height: 20, borderRadius: '50%',
                      background: 'var(--pulse)', color: 'white',
                      fontSize: 11, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', border: '2px solid white',
                      cursor: 'pointer', lineHeight: 1,
                    }}
                    title="Remove photo"
                  >×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '20px 0' }}>
          <input
            id="enroll-consent"
            type="checkbox"
            checked={consentGiven}
            onChange={(e) => {
              setConsentGiven(e.target.checked);
              if (!e.target.checked) {
                setFiles([]);
                setPreviews([]);
              }
            }}
            style={{ width: 18, height: 18, cursor: 'pointer' }}
          />
          <label htmlFor="enroll-consent" style={{ cursor: 'pointer', fontSize: 14, color: 'var(--ink)', userSelect: 'none' }}>
            Consent Given for Biometric Processing (Opt-In)
          </label>
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading || !usn.trim()}
          style={{ width: '100%', justifyContent: 'center' }}
        >
          {loading ? 'Enrolling...' : `Enroll ${usn || 'Student'}`}
        </button>
      </form>
    </div>
  );
}
