import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { errorText } from '../components/content/common';
import { formatDateTimeIST } from '../constants/statuses';
import NIcon, { CATEGORY_LABELS, timeAgo } from '../components/NotificationIcons';
import HelpBox from '../components/HelpBox';

/** Every event for this staff member, newest first, with filters */
export default function NotificationsPage() {
  const navigate = useNavigate();
  const [category, setCategory] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [rows, setRows] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (before) => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ limit: 30, ...(category && { category }), ...(unreadOnly && { unread: '1' }), ...(before && { before }) });
      const r = await api.get(`/admin/notifications?${q}`);
      const list = (r.data && r.data.notifications) || [];
      setRows(prev => (before ? [...prev, ...list] : list));
      setHasMore(!!(r.data && r.data.has_more));
      setError('');
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, [category, unreadOnly]);

  useEffect(() => { load(); }, [load]);

  async function open(n) {
    if (!n.read) {
      try { await api.post('/admin/notifications/read', { ids: [n.id] }); } catch (e) { /* ignore */ }
    }
    if (n.link) navigate(n.link);
    else setRows(r => r.map(x => (x.id === n.id ? { ...x, read: true } : x)));
  }

  async function markAll() {
    try {
      await api.post('/admin/notifications/read', { all: true });
      setRows(r => r.map(x => ({ ...x, read: true })));
    } catch (err) {
      setError(errorText(err));
    }
  }

  // Group by day for easier reading
  const groups = [];
  rows.forEach(n => {
    const day = new Date(n.created_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long' });
    const g = groups[groups.length - 1];
    if (g && g.day === day) g.items.push(n); else groups.push({ day, items: [n] });
  });

  return (
    <div className="sp-card">
      <div className="sp-card-header">
        <h2 className="sp-card-title"><span style={{ marginRight: '8px', verticalAlign: '-3px', display: 'inline-flex' }}><NIcon name="bell" size={20} /></span> Notifications</h2>
        <button type="button" className="sp-btn sp-btn-secondary sp-btn-sm" onClick={markAll}>Mark all as read</button>
      </div>
      <HelpBox topic="notifications" />
      {error && <div className="sp-inline-alert error">{error}</div>}
      <div className="sp-filters-bar">
        <div className="sp-segmented" role="group" aria-label="Filter notifications">
          <button type="button" className={!category ? 'is-active' : ''} onClick={() => setCategory('')}>All</button>
          {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
            <button key={k} type="button" className={category === k ? 'is-active' : ''} onClick={() => setCategory(k)}>{label}</button>
          ))}
        </div>
        <label style={{ fontSize: '13px', display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
          <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} /> Unread only
        </label>
      </div>

      {!loading && rows.length === 0 && <p className="sp-bell-empty" style={{ padding: '30px' }}>Nothing here yet.</p>}
      {groups.map(g => (
        <section key={g.day} className="sp-notes-day">
          <h3>{g.day}</h3>
          {g.items.map(n => (
            <div key={n.id} className={`sp-bell-item sp-note-row cat-${n.category} ${n.read ? '' : 'is-unread'}`}>
              <button type="button" className="sp-bell-item-main" onClick={() => open(n)}>
                <span className={`sp-bell-icon lvl-${n.level}`}><NIcon name={n.category} size={18} /></span>
                <span className="sp-bell-text">
                  <strong>{n.title}</strong>
                  {n.message && <span>{n.message}</span>}
                  <small title={formatDateTimeIST(n.created_at)}>{timeAgo(n.created_at)} · {CATEGORY_LABELS[n.category] || n.category}</small>
                </span>
              </button>
              {n.type === 'payment_received' && n.bill_status === 'ready' && <button type="button" className="sp-bell-action" onClick={() => open(n)}><NIcon name="send" size={14} /> Send bill</button>}
              {n.type === 'payment_received' && n.bill_status === 'sent' && <span className="sp-bill-sent-chip">Bill sent</span>}
            </div>
          ))}
        </section>
      ))}
      {loading && <div style={{ textAlign: 'center', padding: '20px' }}><i className="fa fa-spinner fa-spin"></i></div>}
      {hasMore && !loading && (
        <div style={{ textAlign: 'center', marginTop: '14px' }}>
          <button type="button" className="sp-btn sp-btn-outline" onClick={() => load(rows[rows.length - 1].id)}>Show older</button>
        </div>
      )}
    </div>
  );
}
