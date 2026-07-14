import React, { useEffect, useState, useRef } from 'react';
import EnrollModal from '../components/EnrollModal';

export default function LiveFeed() {
  const [boxes, setBoxes] = useState([
    { usn: 'USN-001', box: [100, 250, 250, 100], status: 'KNOWN' },
    { usn: 'Unknown', box: [100, 500, 350, 350], status: 'UNKNOWN' }
  ]);
  const [activities, setActivities] = useState([
    { id: 1, time: new Date(Date.now() - 300000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), text: '✅ 1CS20CS001 checked in', usn: '1CS20CS001' },
    { id: 2, time: new Date(Date.now() - 120000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), text: '⚠️ 1CS20CS042 marked PENDING', usn: '1CS20CS042' },
    { id: 3, time: new Date(Date.now() - 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), text: '✅ 1CS20CS017 checked in', usn: '1CS20CS017' }
  ]);
  const [isPlaying, setIsPlaying] = useState(true);
  const [pausedFrame, setPausedFrame] = useState(null);
  const [showBoxes, setShowBoxes] = useState(true);
  const [mjpegConnected, setMjpegConnected] = useState(false);
  const [cameraActive, setCameraActive] = useState(true);
  const [enrollModal, setEnrollModal] = useState(null);
  const [enrollToast, setEnrollToast] = useState('');
  const cameraId = "CAM-01";
  const imgRef = useRef(null);

  // Capture face region from MJPEG and open enrollment modal
  const handleEnrollClick = (box) => {
    const img = imgRef.current;
    if (!img) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, 640, 480);

      // Crop face region with padding
      const [top, right, bottom, left] = box;
      const pad = 30;
      const cx = Math.max(0, left - pad);
      const cy = Math.max(0, top - pad);
      const cw = Math.min(640 - cx, (right - left) + pad * 2);
      const ch = Math.min(480 - cy, (bottom - top) + pad * 2);

      const faceCanvas = document.createElement('canvas');
      faceCanvas.width = cw;
      faceCanvas.height = ch;
      const fctx = faceCanvas.getContext('2d');
      fctx.drawImage(canvas, cx, cy, cw, ch, 0, 0, cw, ch);

      const base64 = faceCanvas.toDataURL('image/jpeg', 0.9).split(',')[1];
      setEnrollModal(base64);
    } catch (err) {
      console.error('Failed to capture face:', err);
    }
  };

  const isPlayingRef = useRef(isPlaying);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Check camera state on mount
  useEffect(() => {
    const backendUrl = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '');
    fetch(`${backendUrl}/api/v1/camera/state`)
      .then(r => r.json())
      .then(d => setCameraActive(d.active))
      .catch(() => setCameraActive(true)); // Assume running if backend unreachable
  }, []);

  const toggleCamera = async (start) => {
    try {
      const backendUrl = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '');
      const res = await fetch(`${backendUrl}/api/v1/camera/${start ? 'start' : 'stop'}`, { method: 'POST' });
      const data = await res.json();
      setCameraActive(data.active);
    } catch (e) {
      console.error(e);
    }
  };

  // MJPEG stream URL — direct from camera script, no backend relay
  const mjpegUrl = 'http://localhost:8081/mjpeg';

  useEffect(() => {
    // ── Box WebSocket (tiny JSON, ~200 bytes per message) ───────
    const boxWs = new WebSocket('ws://localhost:8082');

    let pendingBoxes = null;
    let rafId = null;

    const renderBoxes = () => {
      if (pendingBoxes !== null) {
        setBoxes(pendingBoxes);
        pendingBoxes = null;
      }
      rafId = null;
    };

    boxWs.onmessage = (event) => {
      if (!isPlayingRef.current) return;
      try {
        const payload = JSON.parse(event.data);
        pendingBoxes = payload.boxes || [];
        if (!rafId) {
          rafId = requestAnimationFrame(renderBoxes);
        }
      } catch (err) {
        console.error('Box WS parse error:', err);
      }
    };

    boxWs.onerror = (error) => console.error('Box WebSocket Error:', error);

    // ── Main WebSocket (activity logs from backend) ────────────
    let mainWsUrl;
    if (import.meta.env.VITE_API_URL) {
      const parsed = new URL(import.meta.env.VITE_API_URL);
      const wsProtocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
      mainWsUrl = `${wsProtocol}//${parsed.host}/ws`;
    } else {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      mainWsUrl = import.meta.env.DEV 
        ? `ws://localhost:8000/ws`
        : `${protocol}//${window.location.host}/ws`;
    }
      
    const mainWs = new WebSocket(mainWsUrl);

    mainWs.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'attendance_update') {
          const update = msg.data;
          const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          const text = update.status === 'PRESENT' 
            ? `✅ ${update.usn} checked in`
            : update.status === 'EXIT' 
              ? `🚪 ${update.usn} left`
              : `⚠️ ${update.usn} marked ${update.status}`;
              
          setActivities(prev => [{ id: Date.now() + Math.random(), time: timestamp, text, usn: update.usn }, ...prev].slice(0, 50));
        }
      } catch (e) {
        console.error('Error processing main websocket', e);
      }
    };

    return () => {
      boxWs.close();
      mainWs.close();
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [cameraId]);

  const handleSnapshot = () => {
    // Capture current MJPEG frame via canvas
    const img = imgRef.current;
    if (!img) return;
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, 640, 480);
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/jpeg');
    a.download = `snapshot_${cameraId}_${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`;
    a.click();
  };

  return (
    <div className="page-wrapper" style={{ maxWidth: '1400px' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Live Camera Feed</h1>
          <p className="page-subtitle">Real-time view from {cameraId}</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {cameraActive ? (
            <button 
              className="btn" 
              style={{ backgroundColor: '#ef4444', color: 'white', borderColor: '#ef4444' }} 
              onClick={() => toggleCamera(false)}
            >
              🛑 Stop Camera
            </button>
          ) : (
            <button 
              className="btn" 
              style={{ backgroundColor: '#10b981', color: 'white', borderColor: '#10b981' }} 
              onClick={() => toggleCamera(true)}
            >
              🟢 Start Camera
            </button>
          )}
          <button 
            className={`btn ${isPlaying ? 'btn-secondary' : 'btn-primary'}`} 
            onClick={() => {
              if (isPlaying) {
                const img = imgRef.current;
                if (img) {
                  const canvas = document.createElement('canvas');
                  canvas.width = img.naturalWidth || 640;
                  canvas.height = img.naturalHeight || 480;
                  const ctx = canvas.getContext('2d');
                  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                  setPausedFrame(canvas.toDataURL('image/jpeg'));
                }
              } else {
                setPausedFrame(null);
              }
              setIsPlaying(!isPlaying);
            }}
          >
            {isPlaying ? '⏸ Pause' : '▶ Play'}
          </button>
          <button 
            className={`btn ${showBoxes ? 'btn-secondary' : 'btn-ghost'}`} 
            onClick={() => setShowBoxes(!showBoxes)}
          >
            {showBoxes ? 'Hide Overlays' : 'Show Overlays'}
          </button>
          <button className="btn btn-secondary" onClick={handleSnapshot}>
            📸 Snapshot
          </button>
        </div>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '24px', alignItems: 'start' }}>
        {/* Video Player — Native MJPEG, zero JS overhead */}
        <div className="card" style={{ display: 'flex', justifyContent: 'center', overflow: 'hidden', position: 'relative', backgroundColor: '#000', minHeight: '400px', borderRadius: '12px' }}>
          <div style={{ position: 'relative', display: 'inline-block', width: '100%', height: '100%' }}>
            {!cameraActive ? (
               <div style={{ width: '100%', height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: '14px' }}>
                 Camera is stopped
               </div>
            ) : pausedFrame ? (
               <img src={pausedFrame} alt="Paused" style={{ width: '100%', height: 'auto', display: 'block', objectFit: 'contain' }} />
            ) : (
              <img 
                ref={imgRef}
                src={mjpegUrl}
                alt="Live MJPEG feed" 
                crossOrigin="anonymous"
                onLoad={() => setMjpegConnected(true)}
                onError={() => setMjpegConnected(false)}
                style={{ 
                  width: '100%', 
                  height: 'auto', 
                  display: 'block', 
                  objectFit: 'contain'
                }} 
              />
            )}
            {/* Bounding Box Overlay */}
            {showBoxes && boxes && boxes.length > 0 && (
              <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                {boxes.map((b, i) => {
                  const frameW = 640;
                  const frameH = 480;
                  const topPct = (b.box[0] / frameH) * 100;
                  const rightPct = (b.box[1] / frameW) * 100;
                  const bottomPct = (b.box[2] / frameH) * 100;
                  const leftPct = (b.box[3] / frameW) * 100;
                  const widthPct = rightPct - leftPct;
                  const heightPct = bottomPct - topPct;

                  const color = b.status === 'SPOOF' ? '#f59e0b' : b.status === 'UNKNOWN' ? '#ef4444' : '#10b981';
                  
                  return (
                    <div key={i} style={{
                      position: 'absolute',
                      top: `${topPct}%`,
                      left: `${leftPct}%`,
                      width: `${widthPct}%`,
                      height: `${heightPct}%`,
                      border: `3px solid ${color}`,
                      pointerEvents: 'auto',
                      cursor: b.status === 'UNKNOWN' ? 'pointer' : 'default',
                      boxShadow: '0 0 10px rgba(0,0,0,0.5)',
                      transition: 'all 0.15s ease-out'
                    }}
                    title={b.status === 'UNKNOWN' ? 'Click to enroll this face' : b.usn}
                    onClick={() => b.status === 'UNKNOWN' && handleEnrollClick(b.box)}
                    >
                      <div style={{
                        position: 'absolute',
                        top: '-25px',
                        left: '-3px',
                        backgroundColor: color,
                        color: '#fff',
                        padding: '2px 8px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        whiteSpace: 'nowrap',
                        borderTopLeftRadius: '4px',
                        borderTopRightRadius: '4px'
                      }}>
                        {b.usn}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {!mjpegConnected && (
              <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: '14px' }}>
                Connecting to camera stream...
              </div>
            )}
          </div>
        </div>

        {/* Activity Log */}
        <div className="card" style={{ height: '600px', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--white)', border: '1px solid var(--line)', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--line)', backgroundColor: 'var(--canvas)', fontWeight: 600, fontFamily: 'var(--display)' }}>
            Live Activity Log
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {activities.length === 0 ? (
              <div style={{ color: 'var(--ink-muted)', fontSize: '13px', textAlign: 'center', marginTop: '20px' }}>
                No recent activity.
              </div>
            ) : (
              activities.map(act => (
                <div key={act.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13px', padding: '8px', backgroundColor: 'var(--canvas-dim)', borderRadius: '6px' }}>
                  <div style={{ fontFamily: 'var(--mono)', color: 'var(--ink-muted)', fontSize: '11px', whiteSpace: 'nowrap', marginTop: '2px' }}>
                    {act.time}
                  </div>
                  <div style={{ color: 'var(--ink)', fontWeight: 500 }}>
                    {act.text}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      {/* Enrollment Modal */}
      {enrollModal && (
        <EnrollModal
          faceImage={enrollModal}
          onClose={() => setEnrollModal(null)}
          onEnrolled={(data) => {
            setEnrollToast(`✅ ${data.usn || 'Student'} enrolled successfully!`);
            setTimeout(() => setEnrollToast(''), 4000);
          }}
        />
      )}

      {/* Enrollment Toast */}
      {enrollToast && (
        <div className="toast-container">
          <div className="toast toast-success">{enrollToast}</div>
        </div>
      )}
    </div>
  );
}
