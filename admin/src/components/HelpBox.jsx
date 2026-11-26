import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { GUIDES } from '../constants/guides';

/**
 * "How this works" box shown at the top of an admin page or tab.
 * Open the first time; once someone closes it, it stays closed for them (remembered in this browser).
 */
export default function HelpBox({ topic }) {
  const g = GUIDES[topic];
  const storeKey = `spouzy_help_${topic}`;
  const [open, setOpen] = useState(() => {
    try { return window.localStorage.getItem(storeKey) !== 'closed'; } catch (e) { return true; }
  });
  if (!g) return null;

  function toggle() {
    const next = !open;
    setOpen(next);
    try { window.localStorage.setItem(storeKey, next ? 'open' : 'closed'); } catch (e) { /* storage blocked */ }
  }

  return (
    <div className={`sp-help ${open ? 'is-open' : ''}`}>
      <button type="button" className="sp-help-toggle" onClick={toggle} aria-expanded={open}>
        <i className="fa fa-question-circle" aria-hidden="true"></i>
        <span>How this works: <strong>{g.title}</strong></span>
        <i className={`fa fa-chevron-${open ? 'up' : 'down'}`} aria-hidden="true" style={{ marginLeft: 'auto' }}></i>
      </button>
      {open && (
        <div className="sp-help-body">
          <p className="sp-help-what">{g.what}</p>
          {g.steps && g.steps.length > 0 && (
            <ol className="sp-help-steps">{g.steps.map(s => <li key={s}>{s}</li>)}</ol>
          )}
          {g.tips && g.tips.length > 0 && (
            <ul className="sp-help-tips">{g.tips.map(t => <li key={t}><i className="fa fa-lightbulb-o" aria-hidden="true"></i> {t}</li>)}</ul>
          )}
          <div className="sp-help-foot">
            {g.where && <span>On the website: <strong>{g.where}</strong></span>}
            <Link to={`/guide#${topic.replace(/\./g, '-')}`}>Open the full Admin Guide →</Link>
          </div>
        </div>
      )}
    </div>
  );
}
