/**
 * Inframe — API Client
 * Fetch wrapper for the FastAPI backend.
 */

// If serving via Vite proxy, use /api/v1, otherwise use full URL.
const API_BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api/v1` : '/api/v1';

function getHeaders(customHeaders = {}) {
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json', ...customHeaders };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: getHeaders(options.headers),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || `API error: ${res.status}`);
  }

  // Handle CSV downloads
  if (res.headers.get('content-type')?.includes('text/csv')) {
    return res.blob();
  }

  // Handle 204 No Content
  if (res.status === 204) {
    return null;
  }

  return res.json();
}

// ── Attendance ──

export async function fetchAttendance(sessionId) {
  return request(`/attendance?session_id=${sessionId}`);
}

export async function fetchStudentAttendance(usn, sessionId) {
  return request(`/attendance/${usn}?session_id=${sessionId}`);
}

export async function overrideAttendance(usn, data) {
  return request(`/attendance/${usn}/override`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function exportAttendanceCSV(sessionId) {
  const blob = await request(`/attendance/export/csv?session_id=${sessionId}`);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `attendance_session_${sessionId}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Persons ──

export async function fetchPersons(activeOnly = true) {
  return request(`/persons?active_only=${activeOnly}`);
}

export async function createPerson(data) {
  return request('/persons', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deletePerson(usn) {
  return request(`/persons/${usn}`, { method: 'DELETE' });
}

export async function reactivatePerson(usn) {
  return request(`/persons/${usn}/reactivate`, { method: 'POST' });
}

export async function updateConsent(usn, consentGiven) {
  return request(`/persons/${usn}/consent`, {
    method: 'POST',
    body: JSON.stringify({ consent_given: consentGiven }),
  });
}

export async function enrollPhotos(usn, files) {
  const formData = new FormData();
  files.forEach((file) => formData.append('photos', file));

  const res = await fetch(`${API_BASE}/persons/${usn}/enroll-photos`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': undefined }),
    body: formData,
  });
  
  // Remove the undefined Content-Type so browser sets boundary correctly
  delete res.headers?.['Content-Type'];

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || `Upload failed: ${res.status}`);
  }

  return res.json();
}

// ── Sessions ──

export async function fetchSessions(activeOnly = false) {
  return request(`/sessions?active_only=${activeOnly}`);
}

export async function createSession(data) {
  return request('/sessions', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function closeSession(sessionId) {
  return request(`/sessions/${sessionId}/close`, { method: 'POST' });
}

export async function deleteSession(sessionId) {
  return request(`/sessions/${sessionId}`, { method: 'DELETE' });
}

// ── Audit Logs ──

export async function fetchAuditLogs(limit = 100, offset = 0) {
  return request(`/audit-logs?limit=${limit}&offset=${offset}`);
}

// ── Health ──

export async function checkHealth() {
  return request('/health').catch(() => null);
}
