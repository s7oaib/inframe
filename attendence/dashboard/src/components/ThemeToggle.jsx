import React, { useState, useEffect } from 'react';

export default function ThemeToggle() {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  return (
    <button
      onClick={() => setDark(!dark)}
      className="btn btn-ghost btn-icon"
      title={dark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      style={{
        fontSize: '18px',
        padding: '8px 10px',
        borderRadius: 'var(--radius-md)',
        transition: 'transform 0.3s ease, background 0.2s ease',
      }}
    >
      <span style={{
        display: 'inline-block',
        transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: dark ? 'rotate(360deg)' : 'rotate(0deg)',
      }}>
        {dark ? '☀️' : '🌙'}
      </span>
    </button>
  );
}
