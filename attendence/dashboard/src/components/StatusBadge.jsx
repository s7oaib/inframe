const STATUS_MAP = {
  PRESENT: { className: 'badge-present', label: 'Present' },
  ABSENT: { className: 'badge-absent', label: 'Absent' },
  LEFT_EARLY: { className: 'badge-left-early', label: 'Left Early' },
  PENDING: { className: 'badge-pending', label: 'Pending' },
  LATE: { className: 'badge-late', label: 'Late' },
  NEEDS_REVIEW: { className: 'badge-needs-review', label: 'Needs Review' },
};

export default function StatusBadge({ status, source }) {
  const config = STATUS_MAP[status] || { className: 'badge-pending', label: status };

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
      <span className={`badge ${config.className}`}>
        {config.label}
      </span>
      {source === 'OVERRIDE' && (
        <span className="badge-override">overridden</span>
      )}
    </span>
  );
}
