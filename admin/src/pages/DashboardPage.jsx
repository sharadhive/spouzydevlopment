import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import HelpBox from '../components/HelpBox';
import AnalyticsPanel from '../components/AnalyticsPanel';
import NIcon, { timeAgo } from '../components/NotificationIcons';
import { formatDateIST, formatDateTimeIST, formatInrFromMinor } from '../constants/statuses';

function StatCard({ to, icon, tone, value, label, hint }) {
  const body = (
    <div className="sp-stat-card" style={{ cursor: to ? 'pointer' : 'default' }}>
      <div className={`sp-stat-icon ${tone}`}><i className={`fa ${icon}`}></i></div>
      <div>
        <div className="sp-stat-value">{value}</div>
        <div className="sp-stat-label">{label}</div>
        {hint && <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>{hint}</div>}
      </div>
    </div>
  );
  return to ? <Link to={to} style={{ textDecoration: 'none', color: 'inherit' }}>{body}</Link> : body;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const abortControllerRef = useRef(null);

  useEffect(() => {
    load();
    return () => { if (abortControllerRef.current) abortControllerRef.current.abort(); };
  }, []);

  async function load() {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/admin/dashboard/overview', { signal: abortControllerRef.current.signal });
      if (res.success) setData(res.data);
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }

  if (loading && !data) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}><i className="fa fa-spinner fa-spin fa-2x"></i></div>;
  }

  if (error) {
    return (
      <div className="sp-card" style={{ borderLeft: '4px solid var(--sp-danger)', padding: '24px' }}>
        <h3 style={{ color: 'var(--sp-danger)', marginBottom: '8px' }}><i className="fa fa-exclamation-circle"></i> Could not load the dashboard</h3>
        <p style={{ color: '#555', marginBottom: '16px' }}>{error}</p>
        <button onClick={load} className="sp-btn sp-btn-secondary"><i className="fa fa-refresh"></i> Retry</button>
      </div>
    );
  }

  const s = data?.sections || {};
  const today = data?.today;
  const hasAny = Object.keys(s).length > 0;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px' }}>Welcome, {user?.first_name || user?.name}</h2>
          <small style={{ color: '#888' }}>{today ? formatDateIST(today) : ''} · updated {data?.generatedAt ? formatDateTimeIST(data.generatedAt) : ''}</small>
        </div>
        <button onClick={load} className="sp-btn sp-btn-secondary sp-btn-sm" disabled={loading}><i className={`fa fa-refresh ${loading ? 'fa-spin' : ''}`}></i> Refresh</button>
      </div>

      <HelpBox topic="dashboard" />
      <LatestNotifications />

      {!hasAny && (
        <div className="sp-card"><p style={{ margin: 0 }}>Your role has no dashboard sections. Use the menu on the left.</p></div>
      )}

      <div className="sp-stats-grid">
        {s.enquiries && (
          <StatCard to="/enquiries?status=new" icon="fa-envelope-o" tone="wine" value={s.enquiries.new}
            label="New enquiries" hint={`${s.enquiries.today} today · ${s.enquiries.total} total`} />
        )}
        {s.clinical && (
          <StatCard to="/clinical?status=submitted" icon="fa-user-md" tone="copper" value={s.clinical.awaitingReview.total}
            label="Doctor / counsellor applications to review" hint={`${s.clinical.awaitingReview.doctor} doctors · ${s.clinical.awaitingReview.counsellor} counsellors`} />
        )}
        {s.careers && (
          <StatCard to="/careers?status=submitted" icon="fa-briefcase" tone="blue" value={s.careers.awaitingReview}
            label="Career applications to review" hint={`${s.careers.openOpenings} open roles · ${s.careers.total} total`} />
        )}
        {s.appointments && (
          <StatCard to={`/appointments?date=${today}`} icon="fa-calendar-check-o" tone="green" value={s.appointments.todayCount}
            label="Consultations today" hint={`${s.appointments.upcoming7Days} in the next 7 days`} />
        )}
        {s.appointments && (
          <StatCard to="/appointments?type=paid&payment=pending" icon="fa-inr" tone="copper" value={s.appointments.paymentPending}
            label="Paid bookings awaiting payment" hint={`${s.appointments.activeHolds} on 15-min payment hold`} />
        )}
        {s.appointments && (
          <StatCard to="/appointments?type=free" icon="fa-gift" tone="green" value={s.appointments.upcomingByType.free}
            label="Upcoming free consultations" hint={`${s.appointments.upcomingByType.paid} upcoming paid`} />
        )}
        {s.payments && (
          <StatCard to="/settings" icon="fa-credit-card" tone={s.payments.onlineEnabled ? 'green' : 'wine'}
            value={formatInrFromMinor(s.payments.paidThisMonthMinor)}
            label={s.payments.onlineEnabled ? 'Collected online this month' : 'Online payment OFF (coming soon)'}
            hint={`${s.payments.paidCountThisMonth} payments this month`} />
        )}
        {s.shop && (
          <StatCard to="/shop?tab=bills&status=ready" icon="fa-file-text-o" tone={s.shop.billsReady ? 'wine' : 'green'} value={s.shop.billsReady || 0}
            label="Bills ready to send" hint={s.shop.billsReady ? 'Check the details and send them to the customers' : 'All bills sent'} />
        )}
        {s.shop && (
          <StatCard to="/shop?tab=orders" icon="fa-shopping-bag" tone="copper" value={s.shop.ordersToday}
            label="Package orders today" hint={`${s.shop.pendingPayment} awaiting payment · ${s.shop.freeClaims} free claims`} />
        )}
        {s.chat && (
          <StatCard to={s.chat.unansweredLast7Days ? '/chats?tab=questions' : '/chats'} icon="fa-comments" tone="blue" value={s.chat.chatsLast24h}
            label="Website chats (last 24 hours)" hint={`${s.chat.unansweredLast7Days} questions to answer this week`} />
        )}
        {s.shop && (
          <StatCard to="/shop?tab=customers" icon="fa-bolt" tone="green" value={s.shop.activeToday}
            label="Customers active today" hint="Open to see who logged in and what they did" />
        )}
        {s.shop && (
          <StatCard to="/shop?tab=customers" icon="fa-user-circle" tone="blue" value={s.shop.customers}
            label="Website customer accounts" hint={`${s.shop.newCustomers7Days} new this week · ${formatInrFromMinor(s.shop.paidThisMonthMinor)} paid this month`} />
        )}
        {s.verifications && (
          <StatCard to="/verifications" icon="fa-id-card-o" tone={s.verifications.pending ? 'wine' : 'green'} value={s.verifications.pending}
            label="Student / ex-servicemen IDs to check" hint={s.verifications.pending ? 'Approve or reject so they can book' : 'All IDs checked'} />
        )}
        {s.moderation && (
          <StatCard to="/content?tab=faqs" icon="fa-question-circle" tone="blue" value={s.moderation.questionsPending}
            label="Visitor questions to answer" hint={`${s.moderation.faqsPublished} FAQs published`} />
        )}
        {s.moderation && (
          <StatCard to="/content?tab=stories" icon="fa-comments-o" tone="wine" value={s.moderation.storiesPending}
            label="Stories awaiting moderation" />
        )}
        {s.content && (
          <StatCard to="/content?tab=blogs" icon="fa-newspaper-o" tone="copper" value={s.content.blogsPublished}
            label="Published articles" hint={`${s.content.blogsDraft} drafts · ${s.content.bannersActive} active banners`} />
        )}
      </div>

      {hasAny && <AnalyticsPanel />}

      <div className="sp-grid-2">
        {s.enquiries && (
          <div className="sp-card">
            <div className="sp-card-header">
              <h2 className="sp-card-title"><i className="fa fa-envelope-open-o" style={{ marginRight: '8px' }}></i> Latest enquiries</h2>
              <Link to="/enquiries" className="sp-btn sp-btn-secondary sp-btn-sm">View all</Link>
            </div>
            {s.enquiries.recent?.length ? (
              <div className="sp-table-wrapper">
                <table className="sp-table">
                  <thead><tr><th>Ref</th><th>Name</th><th>Interest</th><th>Status</th></tr></thead>
                  <tbody>
                    {s.enquiries.recent.map(enq => (
                      <tr key={enq.id}>
                        <td><strong>{enq.reference_no}</strong><div><small style={{ color: '#888' }}>{formatDateTimeIST(enq.createdAt)}</small></div></td>
                        <td>{enq.name}<div><small style={{ color: '#888' }}>{enq.source === 'floating_widget' ? 'Call-back widget' : 'Contact page'}</small></div></td>
                        <td>{enq.service_interest || '—'}</td>
                        <td><StatusBadge status={enq.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p style={{ color: '#888' }}>No enquiries yet.</p>}
          </div>
        )}

        {s.appointments && (
          <div className="sp-card">
            <div className="sp-card-header">
              <h2 className="sp-card-title"><i className="fa fa-calendar" style={{ marginRight: '8px' }}></i> Today's schedule</h2>
              <Link to={`/appointments?date=${today}`} className="sp-btn sp-btn-secondary sp-btn-sm">Open</Link>
            </div>
            {s.appointments.today?.length ? (
              <div className="sp-table-wrapper">
                <table className="sp-table">
                  <thead><tr><th>Time</th><th>Client</th><th>With</th><th>Status</th></tr></thead>
                  <tbody>
                    {s.appointments.today.map(a => (
                      <tr key={a.id}>
                        <td><strong>{a.start_time?.slice(0, 5)}</strong><div><small style={{ color: '#888' }}>{a.duration_minutes} min · {a.booking_type === 'free' ? 'Free' : 'Paid'}</small></div></td>
                        <td>{a.client_name}<div><small style={{ color: '#888' }}>{a.service?.name}</small></div></td>
                        <td>{a.practitioner?.name || 'Unassigned'}</td>
                        <td><StatusBadge status={a.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p style={{ color: '#888' }}>No consultations today.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

/** The newest events (same list as the bell), so nothing is missed when the dashboard opens */
function LatestNotifications() {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    let alive = true;
    api.get('/admin/notifications?limit=6').then(r => { if (alive) setRows((r.data && r.data.notifications) || []); }).catch(() => { if (alive) setRows([]); });
    return () => { alive = false; };
  }, []);
  if (!rows || !rows.length) return null;
  return (
    <div className="sp-card sp-latest-notes">
      <div className="sp-card-header" style={{ marginBottom: '6px' }}>
        <h3 className="sp-card-title" style={{ fontSize: '16px' }}><span style={{ display: 'inline-flex', verticalAlign: '-3px', marginRight: '6px' }}><NIcon name="bell" size={18} /></span> Latest notifications</h3>
        <Link to="/notifications" className="sp-btn sp-btn-outline sp-btn-sm">See all</Link>
      </div>
      <div className="sp-latest-notes-list">
        {rows.map(n => (
          <Link key={n.id} to={n.link || '/notifications'} className={`sp-latest-note cat-${n.category} ${n.read ? '' : 'is-unread'}`}>
            <span className={`sp-bell-icon lvl-${n.level}`}><NIcon name={n.category} size={16} /></span>
            <span className="sp-bell-text"><strong>{n.title}</strong><small>{timeAgo(n.created_at)}</small></span>
            {n.type === 'payment_received' && n.bill_status === 'ready' && <span className="sp-bell-action">Send bill</span>}
            {n.type === 'payment_received' && n.bill_status === 'sent' && <span className="sp-bill-sent-chip">Bill sent</span>}
          </Link>
        ))}
      </div>
    </div>
  );
}
