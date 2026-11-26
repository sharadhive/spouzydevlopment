import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { statusLabel } from '../constants/statuses';
import { PALETTE, CountUp, DonutChart, BarChart, HBarChart, LineChart, Gauge, Funnel, Sparkline } from './charts';

const PERIODS = [7, 30, 90];
const C = { wine: PALETTE[0], copper: PALETTE[1], teal: PALETTE[2], gold: PALETTE[3], plum: PALETTE[4], green: PALETTE[5], rose: PALETTE[6], slate: PALETTE[7] };

const MODE_LABELS = { video: 'Video call', audio: 'Audio call', in_clinic: 'In clinic', in_person: 'In clinic', online: 'Online', phone: 'Phone' };
const SOURCE_LABELS = { contact_page: 'Contact page', floating_widget: 'Call-back widget / chat' };
const TOPIC_LABELS = {
  price: 'Prices', includes: 'What packages include', packages: 'Packages', booking: 'Booking', timing: 'Timings', location: 'Clinic locations',
  email: 'Email', phone: 'Phone / WhatsApp', payment: 'Payment', refund: 'Refunds', privacy: 'Privacy', online: 'Online sessions', team: 'The team',
  join: 'Joining as a doctor or counsellor', careers: 'Jobs', account: 'Account help', howItWorks: 'How it works', blog: 'Articles', about: 'About SPOUZY',
  callback: 'Call-back requests', human: 'Talk to a person', sessionLength: 'Session length', free: 'Free consultation', myAppointments: 'My appointments',
  myOrders: 'My orders', crisis: 'Urgent help', faq: 'FAQs', service: 'Services', thanks: 'Thanks', bye: 'Goodbye'
};
const EVENT_LABELS = { page_view: 'Pages opened', click: 'Buttons pressed', booking: 'Bookings', signup: 'Sign-ups', login: 'Logins', cart_add: 'Added to cart', checkout: 'Checkouts', payment: 'Payments', chat: 'Chat questions' };
const STATUS_COLORS = { confirmed: C.teal, completed: C.green, hold: C.gold, rescheduled: C.plum, cancelled: C.rose, no_show: C.slate, new: C.wine, contacted: C.copper, in_progress: C.gold, resolved: C.green, closed: C.slate, submitted: C.copper, under_review: C.gold, interview_scheduled: C.plum, approved: C.green, offered: C.green, rejected: C.rose, pending_payment: C.gold };

const inr = (n) => '₹' + (Number(n) || 0).toLocaleString('en-IN');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayLabel = (d, long) => {
  const s = `${Number(d.slice(8))} ${MONTHS[Number(d.slice(5, 7)) - 1]}`;
  return long ? `${s} ${d.slice(0, 4)}` : s;
};
const toItems = (obj, labels = {}, colors = {}) => Object.entries(obj || {}).map(([k, v], i) => ({ label: labels[k] || statusLabel(k) || k, value: v, color: colors[k] || PALETTE[i % PALETTE.length] }));

function ChartCard({ title, icon, sub, span = 1, children, to }) {
  return (
    <div className={`sp-card sp-chart-card span-${span}`}>
      <div className="sp-chart-card-head">
        <h3><i className={`fa ${icon}`} aria-hidden="true"></i> {title}</h3>
        {to && <Link to={to} className="sp-chart-card-link">Open</Link>}
      </div>
      {sub && <p className="sp-chart-card-sub">{sub}</p>}
      {children}
    </div>
  );
}

function Kpi({ icon, label, value, format, sub, color, spark, to }) {
  const body = (
    <div className="sp-kpi" style={{ '--kpi': color }}>
      <div className="sp-kpi-top"><span className="sp-kpi-icon"><i className={`fa ${icon}`}></i></span><span className="sp-kpi-label">{label}</span></div>
      <div className="sp-kpi-value"><CountUp value={value} format={format} /></div>
      <div className="sp-kpi-foot"><small>{sub}</small>{spark && <Sparkline values={spark} color={color} />}</div>
    </div>
  );
  return to ? <Link to={to} className="sp-kpi-link">{body}</Link> : body;
}

export default function AnalyticsPanel() {
  const [days, setDays] = useState(() => {
    try { return parseInt(window.localStorage.getItem('spouzy_dash_days'), 10) || 30; } catch (e) { return 30; }
  });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (d) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/admin/dashboard/analytics?days=${d}`);
      setData(res.data);
    } catch (err) {
      setError(err.message || 'Could not load the charts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(days); }, [days, load]);

  function pick(d) {
    setDays(d);
    try { window.localStorage.setItem('spouzy_dash_days', String(d)); } catch (e) { /* ignore */ }
  }

  const a = data || {};
  const labels = a.range?.labels || [];
  const b = a.bookings;
  const rev = a.revenue;
  const enq = a.enquiries;
  const chat = a.chat;
  const cust = a.customers;
  const ord = a.orders;
  const apps = a.applications;
  const hasAnything = b || rev || enq || chat || cust || apps;

  // Combined activity line: whatever the role may see
  const activitySeries = [
    b && { key: 'bookings', label: 'Bookings', color: C.teal },
    enq && { key: 'enquiries', label: 'Enquiries', color: C.wine },
    cust && { key: 'signups', label: 'New accounts', color: C.copper },
    chat && { key: 'chats', label: 'Chats', color: C.plum }
  ].filter(Boolean);
  const activityRows = labels.map((d, i) => ({
    bookings: b ? b.byDay[i].free + b.byDay[i].paid : 0,
    enquiries: enq ? enq.byDay[i].count : 0,
    signups: cust ? cust.byDay[i].signups : 0,
    chats: chat ? chat.byDay[i].count : 0
  }));

  return (
    <div className="sp-analytics">
      <div className="sp-analytics-head">
        <div>
          <h2><i className="fa fa-pie-chart" aria-hidden="true"></i> Analytics</h2>
          <small>{a.range ? `${dayLabel(a.range.from, true)} – ${dayLabel(a.range.to, true)} (India time)` : ''}</small>
        </div>
        <div className="sp-seg" role="group" aria-label="Period">
          {PERIODS.map(p => (
            <button key={p} type="button" className={days === p ? 'active' : ''} onClick={() => pick(p)} disabled={loading && days === p}>{p} days</button>
          ))}
        </div>
      </div>

      {error && <div className="sp-inline-alert error">{error} <button type="button" className="sp-link-btn" onClick={() => load(days)}>Try again</button></div>}
      {loading && !data && <div className="sp-analytics-loading"><i className="fa fa-spinner fa-spin fa-2x"></i></div>}
      {data && !hasAnything && <div className="sp-card"><p style={{ margin: 0 }}>Your role has no charts. Use the menu on the left.</p></div>}

      {data && (
        <div className={`sp-analytics-body ${loading ? 'is-loading' : ''}`} key={days}>
          <div className="sp-kpi-grid">
            {b && <Kpi to="/appointments" icon="fa-calendar-check-o" label="Bookings" value={b.total} sub={`${b.free} free · ${b.paid} paid`} color={C.teal} spark={b.byDay.map(x => x.free + x.paid)} />}
            {rev && <Kpi to="/shop?tab=orders" icon="fa-inr" label="Revenue received" value={rev.total} format={inr} sub={rev.onlineEnabled ? `${rev.payments} payments` : 'Online payment is off'} color={C.green} spark={rev.byDay.map(x => x.packages + x.consultations)} />}
            {cust && <Kpi to="/shop?tab=customers" icon="fa-user-plus" label="New accounts" value={cust.newAccounts} sub={`${cust.activeCustomers} customers active`} color={C.copper} spark={cust.byDay.map(x => x.signups)} />}
            {enq && <Kpi to="/enquiries" icon="fa-envelope-o" label="Enquiries" value={enq.total} sub={enq.handledRate === null ? 'none yet' : `${enq.handledRate}% handled`} color={C.wine} spark={enq.byDay.map(x => x.count)} />}
            {chat && <Kpi to="/chats" icon="fa-comments" label="Website chats" value={chat.conversations} sub={chat.answerRate === null ? 'no questions yet' : `${chat.answerRate}% questions answered`} color={C.plum} spark={chat.byDay.map(x => x.count)} />}
            {apps && <Kpi to={apps.clinical !== undefined ? '/clinical' : '/careers'} icon="fa-id-badge" label="Applications" value={(apps.clinical || 0) + (apps.careers || 0)} sub={`${apps.clinical || 0} clinical · ${apps.careers || 0} careers`} color={C.gold} spark={apps.byDay.map(x => x.clinical + x.careers)} />}
          </div>

          <div className="sp-chart-grid">
            {activitySeries.length > 0 && (
              <ChartCard span={2} icon="fa-line-chart" title="Activity per day" sub="Hover over the chart to see each day.">
                <LineChart labels={labels} series={activitySeries} rows={activityRows} labelFormat={dayLabel} />
              </ChartCard>
            )}
            {b && (
              <ChartCard icon="fa-pie-chart" title="Booking status" to="/appointments">
                <DonutChart data={toItems(b.byStatus, {}, STATUS_COLORS)} centerLabel="bookings" />
              </ChartCard>
            )}

            {b && (
              <ChartCard span={2} icon="fa-bar-chart" title="Free and paid bookings per day">
                <BarChart labels={labels} rows={b.byDay} stacked labelFormat={dayLabel}
                  series={[{ key: 'free', label: 'Free consultations', color: C.gold }, { key: 'paid', label: 'Paid sessions', color: C.teal }]} />
              </ChartCard>
            )}
            {b && (
              <ChartCard icon="fa-video-camera" title="How clients meet">
                <DonutChart pie size={170} data={toItems(b.byMode, MODE_LABELS)} />
              </ChartCard>
            )}

            {b && (
              <ChartCard icon="fa-heart" title="Most booked services" to="/appointments?tab=services">
                <HBarChart items={b.byService} color={[C.wine, C.copper, C.teal, C.gold, C.plum, C.green]} />
              </ChartCard>
            )}
            {b && (
              <ChartCard icon="fa-user-md" title="Bookings by practitioner" to="/appointments?tab=practitioners">
                <HBarChart items={b.byPractitioner} color={C.teal} />
              </ChartCard>
            )}
            {b && (
              <ChartCard icon="fa-check-circle" title="Show-up rate" sub="Completed sessions out of completed and no-shows.">
                <Gauge value={b.showUpRate} label={`${b.sessionsHeld} sessions completed`} color="auto" />
              </ChartCard>
            )}

            {b && (
              <ChartCard span={2} icon="fa-calendar" title="Busiest days of the week" sub="Sessions taking place in this period.">
                <BarChart labels={['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']} rows={b.byWeekday.map(v => ({ v }))} height={170} series={[{ key: 'v', label: 'Sessions', color: C.copper }]} />
              </ChartCard>
            )}
            {b && (
              <ChartCard icon="fa-clock-o" title="Busiest start times" sub="The six busiest session times.">
                <HBarChart items={[...(b.byHour || [])].sort((x, y) => y.count - x.count).slice(0, 6).sort((x, y) => x.hour.localeCompare(y.hour)).map(h => ({ name: `${h.hour}:00`, count: h.count }))} color={C.plum} />
              </ChartCard>
            )}

            {rev && (
              <ChartCard span={2} icon="fa-area-chart" title="Money received per day" sub={rev.onlineEnabled ? 'Packages and consultations paid in this period.' : 'Online payment is switched off, so only payments recorded by staff appear here.'}>
                <LineChart labels={labels} rows={rev.byDay} stacked format={inr} labelFormat={dayLabel}
                  series={[{ key: 'consultations', label: 'Consultations', color: C.teal }, { key: 'packages', label: 'Packages', color: C.green }]} />
              </ChartCard>
            )}
            {rev && (
              <ChartCard icon="fa-inr" title="Where the money comes from">
                <DonutChart format={inr} centerLabel={`avg ${inr(rev.average)}`} data={[{ label: 'Consultations', value: rev.consultations, color: C.teal }, { label: 'Packages', value: rev.packages, color: C.green }]} />
              </ChartCard>
            )}

            {a.funnel && (
              <ChartCard span={2} icon="fa-filter" title="From new account to purchase" sub="Of the accounts created in this period, how many went on to book and buy.">
                <Funnel steps={a.funnel} colors={[C.copper, C.teal, C.plum, C.green]} />
              </ChartCard>
            )}
            {ord && (
              <ChartCard icon="fa-shopping-bag" title="Packages ordered" to="/shop?tab=orders">
                <DonutChart data={ord.byPackage.map((p, i) => ({ label: p.name, value: p.count, color: PALETTE[(i + 1) % PALETTE.length] }))} centerLabel="packages" />
              </ChartCard>
            )}

            {cust && (
              <ChartCard span={2} icon="fa-users" title="Customers per day" sub="New accounts and customers who used the website while logged in.">
                <BarChart labels={labels} rows={cust.byDay} labelFormat={dayLabel}
                  series={[{ key: 'active', label: 'Active customers', color: C.teal }, { key: 'signups', label: 'New accounts', color: C.copper }]} />
              </ChartCard>
            )}
            {cust && (
              <ChartCard icon="fa-file-text-o" title="Most opened pages" sub="By logged-in customers.">
                <HBarChart items={cust.topPages} color={C.wine} />
              </ChartCard>
            )}
            {cust && (
              <ChartCard icon="fa-hand-pointer-o" title="What customers did">
                <HBarChart items={Object.entries(cust.events || {}).filter(([k]) => EVENT_LABELS[k]).map(([k, v]) => ({ name: EVENT_LABELS[k], count: v })).sort((x, y) => y.count - x.count)} color={[C.teal, C.copper, C.wine, C.gold, C.plum, C.green, C.rose, C.slate]} />
              </ChartCard>
            )}

            {enq && (
              <ChartCard icon="fa-envelope-open-o" title="Enquiries by status" to="/enquiries">
                <DonutChart data={toItems(enq.byStatus, {}, STATUS_COLORS)} centerLabel="enquiries" />
              </ChartCard>
            )}
            {enq && (
              <ChartCard icon="fa-random" title="Where enquiries come from">
                <DonutChart pie size={170} data={toItems(enq.bySource, SOURCE_LABELS)} />
              </ChartCard>
            )}

            {chat && (
              <ChartCard icon="fa-comments-o" title="Chat questions answered" to="/chats?tab=questions" sub={`${chat.messages} questions · ${chat.notUnderstood} not understood`}>
                <Gauge value={chat.answerRate} label="answered automatically" color="auto" />
              </ChartCard>
            )}
            {chat && (
              <ChartCard icon="fa-commenting" title="What people ask the chat">
                <HBarChart items={(chat.topTopics || []).map(t => ({ name: TOPIC_LABELS[t.name] || t.name, count: t.count }))} color={C.plum} />
              </ChartCard>
            )}

            {apps && (
              <ChartCard span={apps.clinicalByStatus && apps.careersByStatus ? 1 : 2} icon="fa-id-badge" title="Applications per day">
                <BarChart labels={labels} rows={apps.byDay} stacked labelFormat={dayLabel}
                  series={[apps.clinical !== undefined && { key: 'clinical', label: 'Doctors and counsellors', color: C.copper }, apps.careers !== undefined && { key: 'careers', label: 'Careers', color: C.gold }].filter(Boolean)} />
              </ChartCard>
            )}
            {apps && apps.clinicalByStatus && (
              <ChartCard icon="fa-user-md" title="Clinical applications" to="/clinical">
                <DonutChart data={toItems(apps.clinicalByStatus, {}, STATUS_COLORS)} centerLabel="applications" />
              </ChartCard>
            )}
            {apps && apps.careersByStatus && (
              <ChartCard icon="fa-briefcase" title="Career applications" to="/careers">
                <DonutChart data={toItems(apps.careersByStatus, {}, STATUS_COLORS)} centerLabel="applications" />
              </ChartCard>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
