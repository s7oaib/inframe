import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';

export default function LandingPage() {
  const revealRefs = useRef([]);

  useEffect(() => {
    if ('IntersectionObserver' in window) {
      const obs = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add('in-view');
              obs.unobserve(e.target);
            }
          });
        },
        { threshold: 0.15 }
      );
      revealRefs.current.forEach((el) => {
        if (el) obs.observe(el);
      });
      return () => obs.disconnect();
    } else {
      revealRefs.current.forEach((el) => {
        if (el) el.classList.add('in-view');
      });
    }
  }, []);

  const addRevealRef = (el) => {
    if (el && !revealRefs.current.includes(el)) {
      revealRefs.current.push(el);
    }
  };

  return (
    <div className="landing-page">
      {/* Nav */}
      <nav className="lp-nav">
        <div className="lp-nav-inner">
          <div className="lp-wordmark">Frame</div>
          <div className="lp-nav-links">
            <a href="#how">How it works</a>
            <a href="#features">Features</a>
            <a href="#trust">Privacy</a>
          </div>
          <div className="lp-nav-cta">
            <ThemeToggle />
            <Link className="lp-btn lp-btn--ghost" to="/student-portal">🎓 Student Portal</Link>
            <Link className="lp-btn lp-btn--primary" to="/login">Instructor Login</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="lp-hero">
        <div className="lp-wrap lp-hero-grid">
          <div>
            <span className="lp-eyebrow">face <b>→</b> usn <b>→</b> status</span>
            <h1 className="lp-headline">
              If the camera hasn't seen you in 30 minutes, you're marked <em>absent.</em>
            </h1>
            <p className="lp-subhead">
              A camera recognizes each student, matches the face to a university seat number, 
              and keeps a heartbeat on whether they're still in the room. Attendance updates the 
              moment that heartbeat goes quiet for too long — not before.
            </p>
            <div className="lp-cta-row">
              <a className="lp-btn lp-btn--ghost" href="#how">See how it works</a>
            </div>
          </div>

          <div className="lp-viewfinder lp-reveal" ref={addRevealRef}>
            <div className="lp-vf-label">live demo · <b>two students, one rule</b></div>

            <div className="lp-pulse-row lp-row-a">
              <div className="lp-pulse-meta">
                <span className="lp-usn">1HK23AI048</span>
                <span className="lp-event">checked in · 09:02</span>
              </div>
              <div className="lp-pulse-track">
                <div className="lp-threshold-line"><span>30 min</span></div>
                <span className="lp-tick"></span><span className="lp-tick"></span><span className="lp-tick"></span>
                <span className="lp-tick"></span><span className="lp-tick"></span><span className="lp-tick"></span><span className="lp-tick"></span>
                <div className="lp-playhead"></div>
              </div>
              <div className="lp-tag lp-is-present">PRESENT</div>
            </div>

            <div className="lp-pulse-row lp-row-b">
              <div className="lp-pulse-meta">
                <span className="lp-usn">1HK23AI112</span>
                <span className="lp-event">checked in · 09:04</span>
              </div>
              <div className="lp-pulse-track">
                <div className="lp-threshold-line"><span>30 min</span></div>
                <span className="lp-tick"></span><span className="lp-tick"></span><span className="lp-tick"></span>
                <div className="lp-playhead"></div>
              </div>
              <div className="lp-tag lp-is-absent">ABSENT</div>
            </div>
          </div>
        </div>
      </header>

      {/* How it works */}
      <section className="lp-how" id="how">
        <div className="lp-wrap">
          <div className="lp-section-head lp-reveal" ref={addRevealRef}>
            <div className="lp-section-eyebrow">the pipeline</div>
            <h2 className="lp-section-title">Four steps, every time a face enters the frame.</h2>
          </div>
          <div className="lp-steps lp-reveal" ref={addRevealRef}>
            {[
              { num: '01', title: 'See a face', body: 'The camera detects a face and generates a match-ready signature on the spot — the raw image never needs to leave the room.' },
              { num: '02', title: 'Map to a USN', body: 'The signature is compared against enrolled students. A match logs an entry against that exact seat number — never a guess.' },
              { num: '03', title: 'Keep a heartbeat', body: 'Every time the same face reappears, the system updates "last seen." A quick trip out of frame doesn\'t count against anyone.' },
              { num: '04', title: 'Resolve the status', body: 'Once that heartbeat goes quiet past 30 minutes, or the session ends, attendance is finalized — and an instructor can still correct it.' },
            ].map((step) => (
              <div className="lp-step" key={step.num}>
                <div className="lp-step-num">{step.num}</div>
                <div className="lp-step-title">{step.title}</div>
                <div className="lp-step-body">{step.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="lp-features" id="features">
        <div className="lp-wrap">
          <div className="lp-section-head lp-reveal" ref={addRevealRef}>
            <div className="lp-section-eyebrow">what it actually does</div>
            <h2 className="lp-section-title">Built for a room with one camera and a roster, not a research lab.</h2>
          </div>
          <div className="lp-feature-grid lp-reveal" ref={addRevealRef}>
            {[
              { title: 'One seat number, one record', body: 'Every detection ties back to exactly one USN. No duplicate rows, no reconciling three cameras\' worth of guesses by hand.' },
              { title: 'Edge-first by design', body: 'Faces are matched on local hardware in the room. Only a USN, a timestamp, and a confidence score ever leave the building.' },
              { title: 'Built-in override', body: 'Every automated status can be corrected by an instructor, with the reason logged. The system writes a draft — a person signs off on it.' },
              { title: 'Multi-room ready', body: 'The same event format scales from one pilot classroom to a full block of lecture halls without changing the underlying rule.' },
            ].map((f, i) => (
              <div className="lp-feature-card" key={i}>
                <div className="lp-feature-title">{f.title}</div>
                <div className="lp-feature-body">{f.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="lp-trust" id="trust">
        <div className="lp-wrap lp-trust-grid">
          <div className="lp-reveal" ref={addRevealRef}>
            <h2 className="lp-trust-title">Built on consent, not assumption.</h2>
          </div>
          <div className="lp-reveal" ref={addRevealRef}>
            <p className="lp-trust-body">Facial recognition of students is sensitive by nature, so the system is designed to ask for less, not more.</p>
            <div className="lp-trust-list">
              {[
                'Enrollment is opt-in, with a manual roll call always available for anyone who\'d rather not be recognized by a camera.',
                'What\'s stored is a mathematical signature and a timestamp — never a photo library waiting to be misused.',
                'Guardian consent applies wherever a student is a minor, and consent can be withdrawn at any time.',
                'Every automated decision stays correctable by a human before it becomes a permanent record.',
              ].map((item, i) => (
                <div className="lp-trust-item" key={i}>
                  <span className="lp-dot"></span>{item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="lp-cta-section" id="cta">
        <div className="lp-wrap">
          <h2 className="lp-cta-title lp-reveal" ref={addRevealRef}>Pilot it in one classroom first.</h2>
          <p className="lp-cta-body lp-reveal" ref={addRevealRef}>
            No campus-wide rollout, no upfront integration work. Start with a single room, a willing instructor, 
            and a few weeks of side-by-side comparison against manual roll call.
          </p>
          <div className="lp-cta-row lp-reveal" ref={addRevealRef} style={{ justifyContent: 'center' }}>
            <Link className="lp-btn lp-btn--primary" to="/login">Instructor Login</Link>
            <a className="lp-btn lp-btn--ghost" href="#how">Read the pipeline again</a>
          </div>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-wrap lp-footer-inner">
          <div className="lp-wordmark" style={{ fontSize: '16px', cursor: 'pointer' }} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            Frame
          </div>
          <div className="lp-footer-links">
            <a href="#how">How it works</a>
            <a href="#features">Features</a>
            <a href="#trust">Privacy</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
