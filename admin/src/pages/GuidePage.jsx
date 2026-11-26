import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { GUIDES, COMMON_TASKS, SAFETY_RULES } from '../constants/guides';
import { ImageSizeGuide } from '../components/content/LibraryPanels';

// Where each guide topic lives in the admin
const TOPIC_LINKS = {
  dashboard: '/',
  contentHub: '/content-dashboard',
  'content.banners': '/content?tab=banners',
  'content.sections': '/content?tab=sections',
  'content.tips': '/content?tab=tips',
  'content.blogs': '/content?tab=blogs',
  'content.faqs': '/content?tab=faqs',
  'content.stories': '/content?tab=stories',
  'content.media': '/content?tab=media',
  'content.social': '/content?tab=social',
  enquiries: '/enquiries',
  clinical: '/clinical',
  careers: '/careers',
  appointments: '/appointments',
  'appointments.blocks': '/appointments?tab=blocks',
  'appointments.practitioners': '/appointments?tab=practitioners',
  'appointments.services': '/appointments?tab=services',
  chats: '/chats',
  verifications: '/verifications',
  'shop.orders': '/shop?tab=orders',
  'shop.packages': '/shop?tab=packages',
  'shop.bills': '/shop?tab=bills',
  notifications: '/notifications',
  'shop.offers': '/shop?tab=offers',
  'shop.customers': '/shop?tab=customers',
  settings: '/settings',
  'settings.gateway': '/settings',
  users: '/users',
  'users.roles': '/users',
  'users.audit': '/users'
};

const GROUPS = [
  { title: 'Overview', icon: 'fa-tachometer', topics: ['dashboard', 'notifications', 'contentHub'] },
  { title: 'Content & Media (the website)', icon: 'fa-newspaper-o', topics: ['content.banners', 'content.sections', 'content.tips', 'content.blogs', 'content.faqs', 'content.stories', 'content.media', 'content.social'] },
  { title: 'Clients and bookings', icon: 'fa-calendar-check-o', topics: ['appointments', 'appointments.blocks', 'appointments.practitioners', 'appointments.services', 'enquiries', 'chats', 'verifications'] },
  { title: 'Packages, bills, offers and payments', icon: 'fa-shopping-bag', topics: ['shop.orders', 'shop.bills', 'shop.packages', 'shop.offers', 'shop.customers', 'settings.gateway'] },
  { title: 'Hiring', icon: 'fa-briefcase', topics: ['clinical', 'careers'] },
  { title: 'Settings and team', icon: 'fa-sliders', topics: ['settings', 'users', 'users.roles', 'users.audit'] }
];

const STATUS_GLOSSARY = [
  { area: 'Enquiries', items: [['New', 'Just arrived, nobody has replied yet'], ['Contacted', 'You have called or written back'], ['In Progress', 'Being handled'], ['Resolved', 'Done; the person got what they needed'], ['Closed', 'Finished without further action (spam, duplicate, no reply)']] },
  { area: 'Appointments', items: [['Awaiting Payment', 'Paid slot held for 15 minutes while the customer pays'], ['Confirmed', 'Booked; the slot is taken'], ['Rescheduled', 'Moved to another time'], ['Completed', 'The session took place'], ['Cancelled', 'Called off; the slot is free again'], ['No-show', 'The client did not attend']] },
  { area: 'Payments', items: [['No Payment', 'Free consultation or free package'], ['Payment Pending', 'To be paid (online payment off, or not yet paid)'], ['Paid', 'Money received'], ['Refunded', 'Money returned'], ['Failed', 'The payment did not go through']] }
];

const anchor = (topic) => topic.replace(/\./g, '-');

export default function GuidePage() {
  const location = useLocation();
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const matches = useMemo(() => {
    if (!q) return null;
    const hit = (text) => String(text || '').toLowerCase().includes(q);
    return new Set(Object.keys(GUIDES).filter(k => {
      const g = GUIDES[k];
      return hit(g.title) || hit(g.what) || (g.steps || []).some(hit) || (g.tips || []).some(hit) || hit(g.where);
    }));
  }, [q]);
  const taskMatches = q ? COMMON_TASKS.filter(t => (t.q + ' ' + t.a).toLowerCase().includes(q)) : COMMON_TASKS;

  // Scroll to the section named after # (links from the help boxes)
  useEffect(() => {
    const id = (location.hash || '').replace(/^#/, '');
    if (!id) return;
    const t = setTimeout(() => {
      const el = document.getElementById(id);
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); el.classList.add('is-flash'); setTimeout(() => el.classList.remove('is-flash'), 1600); }
    }, 60);
    return () => clearTimeout(t);
  }, [location.hash]);

  return (
    <div className="sp-guide">
      <div className="sp-card">
        <div className="sp-card-header">
          <h2 className="sp-card-title"><i className="fa fa-book" style={{ marginRight: '8px' }}></i> Admin Guide</h2>
        </div>
        <p className="sp-guide-lead">
          Everything this admin panel does, where to find it and how to do the everyday jobs. Every page also has a
          "How this works" box at the top; close it once you know the page and it stays out of your way.
        </p>
        <input className="sp-input sp-guide-search" placeholder="Search the guide, for example price, banner, payment, holiday…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <nav className="sp-guide-toc">
          <a href="#/guide#tasks" onClick={(e) => { e.preventDefault(); document.getElementById('tasks')?.scrollIntoView({ behavior: 'smooth' }); }}>Common tasks</a>
          {GROUPS.map(gr => (
            <a key={gr.title} href={`#/guide#${anchor(gr.topics[0])}`} onClick={(e) => { e.preventDefault(); document.getElementById(anchor(gr.topics[0]))?.scrollIntoView({ behavior: 'smooth' }); }}>{gr.title}</a>
          ))}
          <a href="#/guide#images" onClick={(e) => { e.preventDefault(); document.getElementById('images')?.scrollIntoView({ behavior: 'smooth' }); }}>Image sizes</a>
          <a href="#/guide#rules" onClick={(e) => { e.preventDefault(); document.getElementById('rules')?.scrollIntoView({ behavior: 'smooth' }); }}>Rules</a>
          <a href="#/guide#statuses" onClick={(e) => { e.preventDefault(); document.getElementById('statuses')?.scrollIntoView({ behavior: 'smooth' }); }}>Status meanings</a>
        </nav>
      </div>

      <div className="sp-card" id="tasks">
        <h3 className="sp-guide-h3"><i className="fa fa-check-square-o"></i> Common tasks</h3>
        {taskMatches.length === 0 ? <p className="sp-guide-empty">No task matches "{query}".</p> : (
          <div className="sp-guide-tasks">
            {taskMatches.map(t => (
              <details key={t.q} className="sp-guide-task" open={!!q}>
                <summary>{t.q}</summary>
                <p>{t.a}</p>
              </details>
            ))}
          </div>
        )}
      </div>

      {GROUPS.map(gr => {
        const topics = gr.topics.filter(k => !matches || matches.has(k));
        if (!topics.length) return null;
        return (
          <div className="sp-card" key={gr.title}>
            <h3 className="sp-guide-h3"><i className={`fa ${gr.icon}`}></i> {gr.title}</h3>
            <div className="sp-guide-grid">
              {topics.map(k => {
                const g = GUIDES[k];
                return (
                  <section key={k} id={anchor(k)} className="sp-guide-topic">
                    <div className="sp-guide-topic-head">
                      <h4>{g.title}</h4>
                      {TOPIC_LINKS[k] && <Link to={TOPIC_LINKS[k]} className="sp-btn sp-btn-outline sp-btn-sm">Open</Link>}
                    </div>
                    <p>{g.what}</p>
                    {g.steps && g.steps.length > 0 && <ol>{g.steps.map(s => <li key={s}>{s}</li>)}</ol>}
                    {g.tips && g.tips.length > 0 && <ul className="sp-help-tips">{g.tips.map(t => <li key={t}><i className="fa fa-lightbulb-o"></i> {t}</li>)}</ul>}
                    {g.where && <p className="sp-guide-where">On the website: <strong>{g.where}</strong></p>}
                  </section>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="sp-card" id="images">
        <h3 className="sp-guide-h3"><i className="fa fa-crop"></i> Image sizes</h3>
        <p className="sp-guide-lead">Every upload box shows its recommended size, checks the photo and shrinks it before upload. This is the full list.</p>
        <ImageSizeGuide open />
      </div>

      <div className="sp-card" id="rules">
        <h3 className="sp-guide-h3"><i className="fa fa-shield"></i> Rules to follow</h3>
        <ul className="sp-guide-rules">{SAFETY_RULES.map(r => <li key={r}>{r}</li>)}</ul>
      </div>

      <div className="sp-card" id="statuses">
        <h3 className="sp-guide-h3"><i className="fa fa-tags"></i> What the statuses mean</h3>
        <div className="sp-guide-grid">
          {STATUS_GLOSSARY.map(gl => (
            <section key={gl.area} className="sp-guide-topic">
              <h4>{gl.area}</h4>
              <table className="sp-table"><tbody>{gl.items.map(([name, meaning]) => <tr key={name}><td><strong>{name}</strong></td><td>{meaning}</td></tr>)}</tbody></table>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
