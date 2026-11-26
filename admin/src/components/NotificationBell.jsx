import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import NIcon, { timeAgo } from './NotificationIcons';

const POLL_MS = 25000;
const BASE_TITLE = typeof document !== 'undefined' ? document.title : 'SPOUZY';

/**
 * Bell in the admin header: unread count, the newest events, "Send bill" on payments,
 * and a short pop-up note when something new arrives while the admin is open.
 */
export default function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ unread: 0, latest: [], latest_id: 0 });
  const [toasts, setToasts] = useState([]);
  const lastId = useRef(null);
  const box = useRef(null);

  const load = useCallback(async () => {
    try {
      const r = await api.get('/admin/notifications/summary');
      const d = r.data || { unread: 0, latest: [], latest_id: 0 };
      if (lastId.current !== null && d.latest_id > lastId.current) {
        const fresh = d.latest.filter(n => n.id > lastId.current).slice(0, 3);
        // Let open pages (e.g. Bills) refresh themselves
        try { window.dispatchEvent(new CustomEvent('spouzy:new-notifications', { detail: fresh })); } catch (e) { /* old browsers */ }
        setToasts(t => [...fresh.map(n => ({ ...n, key: n.id })), ...t].slice(0, 3));
        fresh.forEach(n => setTimeout(() => setToasts(t => t.filter(x => x.key !== n.id)), 9000));
      }
      lastId.current = d.latest_id;
      setData(d);
      document.title = d.unread ? `(${d.unread}) ${BASE_TITLE}` : BASE_TITLE;
    } catch (e) { /* signed out or offline: try again on the next tick */ }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, POLL_MS);
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(t); window.removeEventListener('focus', onFocus); document.title = BASE_TITLE; };
  }, [load]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  async function go(n) {
    setOpen(false);
    setToasts(t => t.filter(x => x.id !== n.id));
    if (!n.read) {
      try { await api.post('/admin/notifications/read', { ids: [n.id] }); } catch (e) { /* ignore */ }
      load();
    }
    if (n.link) navigate(n.link);
  }

  async function markAll() {
    try { await api.post('/admin/notifications/read', { all: true }); } catch (e) { /* ignore */ }
    load();
  }

  return (
    <div className="sp-bell" ref={box}>
      <button type="button" className={`sp-bell-btn ${data.unread ? 'has-unread' : ''}`} onClick={() => { setOpen(!open); if (!open) load(); }}
        aria-label={`Notifications${data.unread ? `, ${data.unread} unread` : ''}`} aria-expanded={open} title="Notifications">
        <NIcon name="bell" size={20} />
        {data.unread > 0 && <span className="sp-bell-count">{data.unread > 99 ? '99+' : data.unread}</span>}
      </button>

      {open && (
        <div className="sp-bell-panel" role="dialog" aria-label="Notifications">
          <div className="sp-bell-head">
            <strong>Notifications</strong>
            {data.unread > 0 && <button type="button" className="sp-link-btn" onClick={markAll}>Mark all as read</button>}
          </div>
          <div className="sp-bell-list">
            {data.latest.length === 0 ? (
              <div className="sp-bell-empty"><NIcon name="check" size={22} /> You are all caught up. New payments, orders, bookings and enquiries will appear here.</div>
            ) : data.latest.map(n => (
              <div key={n.id} className={`sp-bell-item cat-${n.category} ${n.read ? '' : 'is-unread'}`}>
                <button type="button" className="sp-bell-item-main" onClick={() => go(n)}>
                  <span className={`sp-bell-icon lvl-${n.level}`}><NIcon name={n.category} size={17} /></span>
                  <span className="sp-bell-text">
                    <strong>{n.title}</strong>
                    {n.message && <span>{n.message}</span>}
                    <small>{timeAgo(n.created_at)}</small>
                  </span>
                </button>
                {n.type === 'payment_received' && n.bill_status === 'ready' && (
                  <button type="button" className="sp-bell-action" onClick={() => go(n)}><NIcon name="send" size={14} /> Send bill</button>
                )}
                {n.type === 'payment_received' && n.bill_status === 'sent' && <span className="sp-bill-sent-chip">Bill sent</span>}
              </div>
            ))}
          </div>
          <button type="button" className="sp-bell-all" onClick={() => { setOpen(false); navigate('/notifications'); }}>See all notifications →</button>
        </div>
      )}

      <div className="sp-toasts" aria-live="polite">
        {toasts.map(n => (
          <div key={n.key} className={`sp-toast cat-${n.category}`}>
            <span className={`sp-bell-icon lvl-${n.level}`}><NIcon name={n.category} size={17} /></span>
            <button type="button" className="sp-toast-text" onClick={() => go(n)}>
              <strong>{n.title}</strong>
              {n.message && <span>{n.message}</span>}
            </button>
            {n.type === 'payment_received' && n.bill_status === 'ready' && <button type="button" className="sp-bell-action" onClick={() => go(n)}>Send bill</button>}
            <button type="button" className="sp-toast-close" aria-label="Dismiss" onClick={() => setToasts(t => t.filter(x => x.key !== n.key))}>×</button>
          </div>
        ))}
      </div>
    </div>
  );
}
