import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, downloadFile } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import Modal from '../Modal';
import StatusBadge from '../StatusBadge';
import { formatDateTimeIST } from '../../constants/statuses';
import { errorText, Toggle, FormActions } from './common';
import { useList, Loading } from './HomepagePanels';
import { textToHtmlPreview, PAGE_SHORT } from '../../utils/faqText';

/*
 * FAQs: three views
 *  - "FAQ page & service pages": the big list (Excel upload/download, search, filters, select many)
 *  - "Homepage questions": the short list on the homepage, in its own order
 *  - "Visitor questions": questions sent from the FAQ page, to answer or reject
 */
const EMPTY_FAQ = { category: 'General', question: '', answer_text: '', sort_order: '', is_published: true, show_on_faq_page: true, show_on_home: false, pages: [] };
const PER_PAGE = 50;

export function FaqsPanel({ onMessage, registerAdd }) {
  const { user } = useAuth();
  const canEdit = user?.can('moderation:edit');
  const [params, setParams] = useSearchParams();
  const view = ['list', 'home', 'questions'].includes(params.get('view')) ? params.get('view') : 'list';
  const [faqs, setFaqs] = useState([]);
  const [meta, setMeta] = useState({ pages: [], categories: [], total: 0, faq_page: 0, home: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [importing, setImporting] = useState(false);
  const [pendingQuestions, setPendingQuestions] = useState(0);

  const reload = useCallback(async () => {
    try {
      const [list, m] = await Promise.all([api.get('/admin/faqs'), api.get('/admin/faqs/meta')]);
      setFaqs(list.data || []);
      setMeta(m.data || {});
      setError('');
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { reload(); }, [reload]);
  useEffect(() => {
    api.get('/admin/visitor-questions?status=pending&limit=1').then(r => setPendingQuestions((r.data && r.data.total) || 0)).catch(() => {});
  }, [view]);

  useEffect(() => {
    if (!registerAdd) return;
    if (!canEdit || view === 'questions') { registerAdd(null); return; }
    registerAdd(() => setEditing(view === 'home' ? { ...EMPTY_FAQ, show_on_home: true, show_on_faq_page: false } : { ...EMPTY_FAQ }));
  }, [registerAdd, canEdit, view]);

  function go(v) {
    const next = new URLSearchParams(params);
    next.set('view', v);
    setParams(next, { replace: true });
  }

  async function remove(f) {
    if (!window.confirm(`Delete this question?\n\n“${f.question}”\n\nIt is removed from every page. This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/faqs/${f.id}`);
      onMessage('Question deleted');
      reload();
    } catch (err) {
      onMessage(errorText(err), true);
    }
  }

  async function quickUpdate(f, body, msg) {
    try {
      await api.put(`/admin/faqs/${f.id}`, body);
      if (msg) onMessage(msg);
      reload();
    } catch (err) {
      onMessage(errorText(err), true);
    }
  }

  const homeCount = faqs.filter(f => f.show_on_home).length;

  return (
    <div>
      <div className="sp-faq-views" role="tablist" aria-label="FAQ lists">
        <button type="button" className={view === 'list' ? 'is-active' : ''} onClick={() => go('list')}>
          <i className="fa fa-list-ul"></i> FAQ page &amp; service pages <span>{meta.total ?? faqs.length}</span>
        </button>
        <button type="button" className={view === 'home' ? 'is-active' : ''} onClick={() => go('home')}>
          <i className="fa fa-home"></i> Homepage questions <span>{homeCount}</span>
        </button>
        <button type="button" className={view === 'questions' ? 'is-active' : ''} onClick={() => go('questions')}>
          <i className="fa fa-inbox"></i> Visitor questions {pendingQuestions > 0 && <span className="is-alert">{pendingQuestions} new</span>}
        </button>
      </div>

      {error && <div className="sp-inline-alert error">{error}</div>}
      {loading && view !== 'questions' ? <Loading /> : (
        <>
          {view === 'list' && (
            <FaqListView faqs={faqs} meta={meta} canEdit={canEdit} onEdit={(f) => setEditing({ ...EMPTY_FAQ, ...f })}
              onDelete={remove} onQuick={quickUpdate} onImport={() => setImporting(true)} onMessage={onMessage} reload={reload}
              onAdd={() => setEditing({ ...EMPTY_FAQ })} />
          )}
          {view === 'home' && (
            <HomeQuestionsView faqs={faqs} canEdit={canEdit} onEdit={(f) => setEditing({ ...EMPTY_FAQ, ...f })} onDelete={remove}
              onQuick={quickUpdate} onMessage={onMessage} reload={reload}
              onAdd={() => setEditing({ ...EMPTY_FAQ, show_on_home: true, show_on_faq_page: false })} />
          )}
        </>
      )}
      {view === 'questions' && <VisitorQuestionsView canEdit={canEdit} onMessage={onMessage} onPublished={reload} />}

      {editing && (
        <FaqEditor faq={editing} pages={meta.pages || []} categories={meta.categories || []}
          onClose={() => setEditing(null)}
          onSaved={(msg) => { setEditing(null); onMessage(msg); reload(); }}
          onError={(m) => onMessage(m, true)} />
      )}
      {importing && (
        <ImportWizard onClose={() => setImporting(false)} onDone={(msg) => { onMessage(msg); reload(); }} pages={meta.pages || []} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Big list                                                            */
/* ------------------------------------------------------------------ */
function PageChips({ f }) {
  return (
    <div className="sp-faq-where">
      {f.show_on_faq_page && <span className="is-faq">FAQ page</span>}
      {f.show_on_home && <span className="is-home">Homepage</span>}
      {(f.pages || []).map(k => <span key={k}>{PAGE_SHORT[k] || k}</span>)}
      {!f.show_on_faq_page && !f.show_on_home && !(f.pages || []).length && <span className="is-none">Not shown anywhere</span>}
    </div>
  );
}

function FaqListView({ faqs, meta, canEdit, onEdit, onDelete, onQuick, onImport, onMessage, reload, onAdd }) {
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [where, setWhere] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [bulkPage, setBulkPage] = useState('');
  const [bulkCategory, setBulkCategory] = useState('');
  const [downloading, setDownloading] = useState('');

  const filtered = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return faqs.filter(f => {
      if (category && (f.category || 'General') !== category) return false;
      if (status === 'shown' && !f.is_published) return false;
      if (status === 'hidden' && f.is_published) return false;
      if (where === 'faq' && !f.show_on_faq_page) return false;
      if (where === 'none' && (f.show_on_faq_page || f.show_on_home || (f.pages || []).length)) return false;
      if (where && !['faq', 'none'].includes(where) && !(f.pages || []).includes(where)) return false;
      if (words.length) {
        const hay = `${f.question} ${f.answer_text || ''} ${f.category || ''}`.toLowerCase();
        if (!words.every(w => hay.includes(w))) return false;
      }
      return true;
    });
  }, [faqs, q, category, where, status]);

  useEffect(() => { setPage(1); }, [q, category, where, status]);
  useEffect(() => {
    // forget selections that no longer exist
    setSelected(prev => new Set([...prev].filter(id => faqs.some(f => f.id === id))));
  }, [faqs]);

  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const shown = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const allOnPage = shown.length > 0 && shown.every(f => selected.has(f.id));

  function toggle(id) {
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }
  function togglePage() {
    setSelected(prev => {
      const n = new Set(prev);
      if (allOnPage) shown.forEach(f => n.delete(f.id)); else shown.forEach(f => n.add(f.id));
      return n;
    });
  }

  async function bulk(action, extra = {}) {
    const ids = [...selected];
    if (!ids.length) return;
    if (action === 'delete' && !window.confirm(`Delete ${ids.length} question${ids.length > 1 ? 's' : ''}? This cannot be undone.`)) return;
    setBusy(true);
    try {
      const r = await api.post('/admin/faqs/bulk', { ids, action, ...extra });
      const n = r.data.changed;
      const labels = { publish: 'shown on the website', hide: 'hidden', delete: 'deleted', add_page: 'added to the page', remove_page: 'removed from the page', set_category: 'moved to the category', faq_page_on: 'added to the FAQ page', faq_page_off: 'taken off the FAQ page' };
      onMessage(`${n} question${n === 1 ? '' : 's'} ${labels[action] || 'updated'}`);
      if (action === 'delete') setSelected(new Set());
      setBulkPage('');
      setBulkCategory('');
      reload();
    } catch (err) {
      onMessage(errorText(err), true);
    } finally {
      setBusy(false);
    }
  }

  async function download(kind) {
    setDownloading(kind);
    try {
      await downloadFile(kind === 'sample' ? '/admin/faqs/template' : '/admin/faqs/export', kind === 'sample' ? 'SPOUZY-FAQ-upload-sample.xlsx' : 'SPOUZY-FAQs.xlsx');
    } catch (err) {
      onMessage(errorText(err), true);
    } finally {
      setDownloading('');
    }
  }

  return (
    <div>
      <div className="sp-faq-excel">
        <div className="sp-faq-excel-text">
          <i className="fa fa-file-excel-o" aria-hidden="true"></i>
          <div>
            <strong>Many questions at once? Use Excel.</strong>
            <span>Download the sample file, fill one question per row (choose the pages with Yes/No), then upload it. You see a preview before anything is saved.</span>
          </div>
        </div>
        <div className="sp-faq-excel-actions">
          {canEdit && <button type="button" className="sp-btn sp-btn-primary sp-btn-sm" onClick={onImport}><i className="fa fa-upload"></i> Upload Excel</button>}
          <button type="button" className="sp-btn sp-btn-secondary sp-btn-sm" disabled={!!downloading} onClick={() => download('sample')}>
            {downloading === 'sample' ? <i className="fa fa-spinner fa-spin"></i> : <i className="fa fa-download"></i>} Sample file
          </button>
          <button type="button" className="sp-btn sp-btn-outline sp-btn-sm" disabled={!!downloading || !faqs.length} onClick={() => download('all')}>
            {downloading === 'all' ? <i className="fa fa-spinner fa-spin"></i> : <i className="fa fa-table"></i>} Download all ({faqs.length})
          </button>
        </div>
      </div>

      <div className="sp-faq-pagechips" aria-label="Questions per page">
        <button type="button" className={where === '' ? 'is-active' : ''} onClick={() => setWhere('')}>All <b>{faqs.length}</b></button>
        <button type="button" className={where === 'faq' ? 'is-active' : ''} onClick={() => setWhere('faq')}>FAQ page <b>{meta.faq_page || 0}</b></button>
        {(meta.pages || []).map(p => (
          <button key={p.key} type="button" className={where === p.key ? 'is-active' : ''} onClick={() => setWhere(p.key)} title={`Shown on ${p.file}`}>
            {p.label} <b>{p.count}</b>
          </button>
        ))}
      </div>

      <div className="sp-filters-bar sp-faq-filters">
        <div className="sp-faq-search">
          <i className="fa fa-search" aria-hidden="true"></i>
          <input className="sp-input" type="search" placeholder="Search questions and answers…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search FAQs" />
        </div>
        <select className="sp-input" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
          <option value="">All categories</option>
          {(meta.categories || []).map(c => <option key={c.name} value={c.name}>{c.name} ({c.count})</option>)}
        </select>
        <select className="sp-input" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">Shown and hidden</option>
          <option value="shown">Shown on website</option>
          <option value="hidden">Hidden</option>
        </select>
        {where === '' && <button type="button" className="sp-link-btn" onClick={() => setWhere('none')}>Not on any page</button>}
      </div>

      {canEdit && selected.size > 0 && (
        <div className="sp-faq-bulk" role="region" aria-label="Selected questions">
          <strong>{selected.size} selected</strong>
          <button type="button" className="sp-btn sp-btn-sm sp-btn-secondary" disabled={busy} onClick={() => bulk('publish')}>Show</button>
          <button type="button" className="sp-btn sp-btn-sm sp-btn-outline" disabled={busy} onClick={() => bulk('hide')}>Hide</button>
          <span className="sp-faq-bulk-group">
            <select className="sp-input" value={bulkPage} onChange={(e) => setBulkPage(e.target.value)} aria-label="Page">
              <option value="">Choose a page…</option>
              <option value="__faq">FAQ page</option>
              {(meta.pages || []).map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
            <button type="button" className="sp-btn sp-btn-sm sp-btn-secondary" disabled={busy || !bulkPage}
              onClick={() => (bulkPage === '__faq' ? bulk('faq_page_on') : bulk('add_page', { page: bulkPage }))}>Add to page</button>
            <button type="button" className="sp-btn sp-btn-sm sp-btn-outline" disabled={busy || !bulkPage}
              onClick={() => (bulkPage === '__faq' ? bulk('faq_page_off') : bulk('remove_page', { page: bulkPage }))}>Remove from page</button>
          </span>
          <span className="sp-faq-bulk-group">
            <input className="sp-input" list="sp-faq-cats" placeholder="Category…" value={bulkCategory} onChange={(e) => setBulkCategory(e.target.value)} aria-label="New category" />
            <button type="button" className="sp-btn sp-btn-sm sp-btn-outline" disabled={busy || !bulkCategory.trim()} onClick={() => bulk('set_category', { category: bulkCategory })}>Set category</button>
          </span>
          <button type="button" className="sp-btn sp-btn-sm sp-btn-outline sp-btn-danger" disabled={busy} onClick={() => bulk('delete')}><i className="fa fa-trash"></i> Delete</button>
          <button type="button" className="sp-link-btn" onClick={() => setSelected(new Set())}>Clear</button>
          {filtered.length > selected.size && (
            <button type="button" className="sp-link-btn" onClick={() => setSelected(new Set(filtered.map(f => f.id)))}>Select all {filtered.length} in this list</button>
          )}
        </div>
      )}
      <datalist id="sp-faq-cats">{(meta.categories || []).map(c => <option key={c.name} value={c.name} />)}</datalist>

      {faqs.length === 0 ? (
        <div className="sp-faq-empty">
          <i className="fa fa-question-circle-o" aria-hidden="true"></i>
          <p>No questions yet. Upload your Excel file or add the first question.</p>
          {canEdit && <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            <button type="button" className="sp-btn sp-btn-primary" onClick={onImport}><i className="fa fa-upload"></i> Upload Excel</button>
            <button type="button" className="sp-btn sp-btn-outline" onClick={onAdd}><i className="fa fa-plus"></i> Add a question</button>
          </div>}
        </div>
      ) : (
        <div className="sp-table-wrapper">
          <table className="sp-table sp-faq-table">
            <thead>
              <tr>
                {canEdit && <th style={{ width: '34px' }}><input type="checkbox" checked={allOnPage} onChange={togglePage} aria-label="Select all on this page" /></th>}
                <th>Question</th>
                <th>Category</th>
                <th>Shows on</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 ? (
                <tr><td colSpan={canEdit ? 6 : 5} style={{ textAlign: 'center', padding: '18px', color: '#999' }}>No questions match. <button type="button" className="sp-link-btn" onClick={() => { setQ(''); setCategory(''); setWhere(''); setStatus(''); }}>Clear filters</button></td></tr>
              ) : shown.map(f => (
                <tr key={f.id} className={selected.has(f.id) ? 'is-selected' : ''}>
                  {canEdit && <td><input type="checkbox" checked={selected.has(f.id)} onChange={() => toggle(f.id)} aria-label={`Select: ${f.question}`} /></td>}
                  <td className="sp-faq-q">
                    <strong>{f.question}</strong>
                    <small>{String(f.answer_text || '').replace(/\s+/g, ' ').slice(0, 150)}{String(f.answer_text || '').length > 150 ? '…' : ''}</small>
                  </td>
                  <td><span className="sp-faq-cat">{f.category || 'General'}</span></td>
                  <td><PageChips f={f} /></td>
                  <td>
                    {canEdit ? (
                      <button type="button" className={`sp-faq-status ${f.is_published ? 'is-on' : ''}`} onClick={() => onQuick(f, { is_published: !f.is_published }, f.is_published ? 'Hidden from the website' : 'Shown on the website')}
                        title={f.is_published ? 'Click to hide' : 'Click to show'}>
                        {f.is_published ? 'Shown' : 'Hidden'}
                      </button>
                    ) : <span className={`sp-badge ${f.is_published ? 'published' : 'closed'}`}>{f.is_published ? 'Shown' : 'Hidden'}</span>}
                  </td>
                  <td>
                    {canEdit && (
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button className="sp-btn sp-btn-secondary sp-btn-sm" onClick={() => onEdit(f)}>Edit</button>
                        <button className="sp-btn sp-btn-outline sp-btn-sm" onClick={() => onDelete(f)} aria-label={`Delete: ${f.question}`}><i className="fa fa-trash"></i></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {filtered.length > PER_PAGE && (
        <div className="sp-faq-pager">
          <span>Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} of {filtered.length}</span>
          <button type="button" className="sp-btn sp-btn-outline sp-btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹ Previous</button>
          <span>Page {page} of {pages}</span>
          <button type="button" className="sp-btn sp-btn-outline sp-btn-sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next ›</button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Homepage questions                                                  */
/* ------------------------------------------------------------------ */
function HomeQuestionsView({ faqs, canEdit, onEdit, onDelete, onQuick, onMessage, reload, onAdd }) {
  const list = useMemo(() => faqs.filter(f => f.show_on_home).sort((a, b) => (a.home_order - b.home_order) || (a.id - b.id)), [faqs]);
  const [busy, setBusy] = useState(false);

  async function move(i, dir) {
    const ids = list.map(f => f.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    setBusy(true);
    try {
      await api.post('/admin/faqs/reorder', { list: 'home', ids });
      reload();
    } catch (err) {
      onMessage(errorText(err), true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="sp-faq-lead">
        These questions show on the homepage in the <strong>Common Questions Before Booking</strong> section, in this order.
        Keep it short: 4 to 6 questions work best. They are managed here, separately from the Excel list.
      </p>
      {list.length === 0 ? (
        <div className="sp-faq-empty">
          <i className="fa fa-home" aria-hidden="true"></i>
          <p>No homepage questions. The section is hidden on the website until you add one.</p>
          {canEdit && <button type="button" className="sp-btn sp-btn-primary" onClick={onAdd}><i className="fa fa-plus"></i> Add homepage question</button>}
        </div>
      ) : (
        <ol className="sp-home-faqs">
          {list.map((f, i) => (
            <li key={f.id} className={f.is_published ? '' : 'is-hidden'}>
              <div className="sp-home-faq-order">
                {canEdit && <>
                  <button type="button" disabled={busy || i === 0} onClick={() => move(i, -1)} aria-label="Move up"><i className="fa fa-chevron-up"></i></button>
                  <span>{i + 1}</span>
                  <button type="button" disabled={busy || i === list.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><i className="fa fa-chevron-down"></i></button>
                </>}
              </div>
              <div className="sp-home-faq-body">
                <strong>{f.question}</strong>
                <div className="sp-faq-answer-preview" dangerouslySetInnerHTML={{ __html: f.answer_html }} />
                <PageChips f={f} />
              </div>
              {canEdit && (
                <div className="sp-home-faq-actions">
                  <button className="sp-btn sp-btn-secondary sp-btn-sm" onClick={() => onEdit(f)}>Edit</button>
                  <button className="sp-btn sp-btn-outline sp-btn-sm" onClick={() => onQuick(f, { is_published: !f.is_published }, f.is_published ? 'Hidden from the website' : 'Shown on the website')}>{f.is_published ? 'Hide' : 'Show'}</button>
                  <button className="sp-btn sp-btn-outline sp-btn-sm" onClick={() => onQuick(f, { show_on_home: false }, 'Removed from the homepage')}>Remove from homepage</button>
                  <button className="sp-btn sp-btn-outline sp-btn-sm" onClick={() => onDelete(f)} aria-label="Delete"><i className="fa fa-trash"></i></button>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
      {canEdit && list.length > 0 && (
        <button type="button" className="sp-btn sp-btn-outline" onClick={onAdd} style={{ marginTop: '10px' }}><i className="fa fa-plus"></i> Add homepage question</button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Add / edit one question                                             */
/* ------------------------------------------------------------------ */
function FaqEditor({ faq, pages, categories, onClose, onSaved, onError }) {
  const [f, setF] = useState(() => ({ ...faq, pages: faq.pages || [], answer_text: faq.answer_text || '' }));
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }));
  const togglePage = (key) => set('pages', f.pages.includes(key) ? f.pages.filter(k => k !== key) : [...f.pages, key]);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        question: f.question, answer_text: f.answer_text, category: f.category || 'General',
        is_published: !!f.is_published, show_on_faq_page: !!f.show_on_faq_page, show_on_home: !!f.show_on_home, pages: f.pages
      };
      if (f.sort_order !== '' && f.sort_order !== null && f.sort_order !== undefined) body.sort_order = f.sort_order;
      if (f.id) await api.put(`/admin/faqs/${f.id}`, body);
      else await api.post('/admin/faqs', body);
      const where = [f.show_on_faq_page && 'the FAQ page', f.show_on_home && 'the homepage', f.pages.length && `${f.pages.length} service page${f.pages.length > 1 ? 's' : ''}`].filter(Boolean);
      onSaved(f.is_published && where.length ? `Saved: shows on ${where.join(', ')}` : 'Saved (not shown on the website yet)');
    } catch (err) {
      onError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen onClose={onClose} title={f.id ? 'Edit question' : 'New question'} maxWidth="760px">
      <form onSubmit={save}>
        <div className="sp-form-group">
          <label className="sp-form-label" htmlFor="faqQ">Question *</label>
          <textarea id="faqQ" className="sp-textarea" rows="2" value={f.question} onChange={(e) => set('question', e.target.value)} required placeholder="Write it the way customers ask it" />
        </div>
        <div className="sp-form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <label className="sp-form-label" htmlFor="faqA">Answer *</label>
            <button type="button" className="sp-link-btn" onClick={() => setShowPreview(!showPreview)}>{showPreview ? 'Hide preview' : 'Show preview'}</button>
          </div>
          <textarea id="faqA" className="sp-textarea" rows="7" value={f.answer_text} onChange={(e) => set('answer_text', e.target.value)} required />
          <small className="sp-faq-format">Empty line = new paragraph · start a line with <code>- </code> for a bullet · <code>**bold**</code> · link: <code>[Confidentiality Pledge](confidentiality.htm)</code></small>
          {showPreview && <div className="sp-faq-answer-preview is-box" dangerouslySetInnerHTML={{ __html: textToHtmlPreview(f.answer_text) || '<p style="color:#999">The answer will appear here.</p>' }} />}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
          <div className="sp-form-group">
            <label className="sp-form-label" htmlFor="faqCat">Category</label>
            <input id="faqCat" className="sp-input" list="sp-faq-editor-cats" value={f.category} onChange={(e) => set('category', e.target.value)} />
            <datalist id="sp-faq-editor-cats">{categories.map(c => <option key={c.name} value={c.name} />)}</datalist>
          </div>
          <div className="sp-form-group">
            <label className="sp-form-label" htmlFor="faqOrder">Order on the FAQ page</label>
            <input id="faqOrder" type="number" className="sp-input" value={f.sort_order ?? ''} onChange={(e) => set('sort_order', e.target.value)} placeholder="Last" />
          </div>
        </div>
        <fieldset className="sp-faq-placement">
          <legend>Where should it show?</legend>
          <div className="sp-faq-placement-main">
            <label><input type="checkbox" checked={!!f.show_on_faq_page} onChange={(e) => set('show_on_faq_page', e.target.checked)} /> FAQ page <small>faq.htm</small></label>
            <label><input type="checkbox" checked={!!f.show_on_home} onChange={(e) => set('show_on_home', e.target.checked)} /> Homepage questions <small>index.htm</small></label>
          </div>
          <div className="sp-faq-placement-pages">
            <span>What We Do pages:</span>
            {pages.map(p => (
              <label key={p.key} className={f.pages.includes(p.key) ? 'is-on' : ''}>
                <input type="checkbox" checked={f.pages.includes(p.key)} onChange={() => togglePage(p.key)} /> {p.label}
              </label>
            ))}
          </div>
        </fieldset>
        <Toggle label="Show on the website (untick to keep it saved but hidden)" checked={f.is_published} onChange={(v) => set('is_published', v)} />
        <FormActions onCancel={onClose} saving={saving} label={f.id ? 'Save changes' : 'Add question'} />
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Excel upload: choose file -> preview -> import                       */
/* ------------------------------------------------------------------ */
function ImportWizard({ onClose, onDone, pages }) {
  const [file, setFile] = useState(null);
  const [strategy, setStrategy] = useState('merge');
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [drag, setDrag] = useState(false);
  const inputRef = useRef(null);

  async function send(mode, f = file, s = strategy) {
    if (!f) return;
    setBusy(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('mode', mode);
      fd.append('strategy', s);
      fd.append('file', f);
      const r = await api.post('/admin/faqs/import', fd);
      if (mode === 'apply') {
        setResult(r.data);
        const d = r.data;
        onDone(`Excel imported: ${d.create} added, ${d.update} updated${d.remove ? `, ${d.remove} removed` : ''}`);
      } else setPreview(r.data);
    } catch (err) {
      setError(errorText(err));
      if (mode === 'preview') setPreview(null);
    } finally {
      setBusy(false);
    }
  }

  function choose(f) {
    if (!f) return;
    setFile(f);
    setResult(null);
    send('preview', f, strategy);
  }

  function changeStrategy(s) {
    setStrategy(s);
    if (file && !result) send('preview', file, s);
  }

  const toDo = preview ? preview.create + preview.update + (preview.remove || 0) + (preview.off_faq_page || 0) : 0;
  const pageLabel = (k) => (pages.find(p => p.key === k) || {}).label || k;

  return (
    <Modal isOpen onClose={onClose} title="Upload FAQs from Excel" maxWidth="820px">
      {result ? (
        <div className="sp-import-done">
          <i className="fa fa-check-circle" aria-hidden="true"></i>
          <h4>Import finished</h4>
          <p><strong>{result.create}</strong> added · <strong>{result.update}</strong> updated · <strong>{result.unchanged}</strong> already the same
            {result.remove ? <> · <strong>{result.remove}</strong> removed</> : null}
            {result.error_count ? <> · <strong>{result.error_count}</strong> rows skipped</> : null}</p>
          <p className="sp-faq-lead">The website and the chat assistant use the new answers straight away.</p>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            <button type="button" className="sp-btn sp-btn-outline" onClick={() => { setResult(null); setPreview(null); setFile(null); }}>Upload another file</button>
            <button type="button" className="sp-btn sp-btn-primary" onClick={onClose}>Done</button>
          </div>
        </div>
      ) : (
        <>
          <div className={`sp-dropzone ${drag ? 'is-drag' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); choose(e.dataTransfer.files && e.dataTransfer.files[0]); }}
            onClick={() => inputRef.current && inputRef.current.click()} role="button" tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current && inputRef.current.click(); } }}>
            <input ref={inputRef} type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" style={{ display: 'none' }}
              onChange={(e) => { choose(e.target.files && e.target.files[0]); e.target.value = ''; }} />
            <i className="fa fa-file-excel-o" aria-hidden="true"></i>
            {file ? <><strong>{file.name}</strong><span>Click to choose a different file</span></> : <><strong>Drop your Excel file here or click to choose</strong><span>.xlsx (Excel) or .csv · up to 5,000 rows</span></>}
          </div>

          <div className="sp-import-mode" role="radiogroup" aria-label="How to import">
            <label className={strategy === 'merge' ? 'is-on' : ''}>
              <input type="radio" name="strategy" checked={strategy === 'merge'} onChange={() => changeStrategy('merge')} />
              <span><strong>Add new and update matching</strong> (recommended)<small>New questions are added. A row with the same ID or exactly the same question updates it. Nothing is removed.</small></span>
            </label>
            <label className={strategy === 'replace' ? 'is-on' : ''}>
              <input type="radio" name="strategy" checked={strategy === 'replace'} onChange={() => changeStrategy('replace')} />
              <span><strong>Replace the FAQ page list</strong><small>The FAQ page will have exactly the questions in this file; others on the FAQ page are deleted. Homepage questions are never deleted.</small></span>
            </label>
          </div>

          {busy && <div className="sp-import-busy"><i className="fa fa-spinner fa-spin"></i> Reading the file…</div>}
          {error && <div className="sp-inline-alert error"><i className="fa fa-exclamation-circle"></i> {error}</div>}

          {preview && !busy && (
            <div className="sp-import-preview">
              <div className="sp-import-stats">
                <div className="is-new"><b>{preview.create}</b><span>new</span></div>
                <div className="is-upd"><b>{preview.update}</b><span>will be updated</span></div>
                <div><b>{preview.unchanged}</b><span>already the same</span></div>
                {strategy === 'replace' && <div className="is-del"><b>{preview.remove}</b><span>will be deleted</span></div>}
                <div className={preview.error_count ? 'is-err' : ''}><b>{preview.error_count}</b><span>rows with problems</span></div>
              </div>
              <p className="sp-faq-lead">
                Sheet “{preview.sheet}” · columns found: {preview.columns.join(', ')}
                {preview.example_rows ? ` · ${preview.example_rows} example row${preview.example_rows > 1 ? 's' : ''} skipped` : ''}
                {preview.empty_rows ? ` · ${preview.empty_rows} empty row${preview.empty_rows > 1 ? 's' : ''} ignored` : ''}
                {!preview.pages_in_file ? ' · no page columns, so the pages of existing questions stay as they are' : ''}
              </p>

              {preview.error_count > 0 && (
                <details open className="sp-import-list is-err">
                  <summary>{preview.error_count} row{preview.error_count > 1 ? 's' : ''} will be skipped — fix them in Excel and upload again later</summary>
                  <table className="sp-table"><thead><tr><th>Excel row</th><th>Question</th><th>Problem</th></tr></thead>
                    <tbody>{preview.errors.map((e, i) => <tr key={i}><td>{e.row}</td><td>{e.question || '—'}</td><td>{e.message}</td></tr>)}</tbody>
                  </table>
                  {preview.error_count > preview.errors.length && <small>…and {preview.error_count - preview.errors.length} more.</small>}
                </details>
              )}
              {preview.warnings && preview.warnings.length > 0 && (
                <details className="sp-import-list">
                  <summary>{preview.warnings.length} note{preview.warnings.length > 1 ? 's' : ''}</summary>
                  <ul>{preview.warnings.map((w, i) => <li key={i}>Row {w.row}: {w.message}</li>)}</ul>
                </details>
              )}
              {preview.samples.create.length > 0 && (
                <details className="sp-import-list">
                  <summary>First new questions</summary>
                  <ul>{preview.samples.create.map(c => <li key={c.row}><strong>{c.question}</strong> <small>{c.category}{c.pages.length ? ` · ${c.pages.map(pageLabel).join(', ')}` : ''}</small></li>)}</ul>
                </details>
              )}
              {preview.samples.update.length > 0 && (
                <details className="sp-import-list">
                  <summary>First updated questions</summary>
                  <ul>{preview.samples.update.map(u => <li key={u.row}><strong>{u.question}</strong> <small>changes: {u.changes.join(', ')}</small></li>)}</ul>
                </details>
              )}
              {strategy === 'replace' && preview.samples.remove.length > 0 && (
                <details className="sp-import-list is-err">
                  <summary>Questions that will be deleted</summary>
                  <ul>{preview.samples.remove.map(r => <li key={r.id}>{r.question}</li>)}</ul>
                  {preview.remove > preview.samples.remove.length && <small>…and {preview.remove - preview.samples.remove.length} more.</small>}
                </details>
              )}
            </div>
          )}

          <div className="sp-modal-actions">
            <button type="button" className="sp-btn sp-btn-outline" onClick={onClose}>Cancel</button>
            <button type="button" className="sp-btn sp-btn-primary" disabled={!preview || busy || toDo === 0}
              onClick={() => {
                if (strategy === 'replace' && preview.remove > 0 && !window.confirm(`${preview.remove} questions will be deleted from the FAQ page. Continue?`)) return;
                send('apply');
              }}>
              {busy ? 'Working…' : toDo === 0 && preview ? 'Nothing to change' : `Import ${preview ? preview.create + preview.update : ''} question${preview && preview.create + preview.update === 1 ? '' : 's'}`}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Questions sent by visitors from the FAQ page                         */
/* ------------------------------------------------------------------ */
function VisitorQuestionsView({ canEdit, onMessage, onPublished }) {
  const questions = useList('/admin/visitor-questions?limit=200', (d) => d.questions);
  const [answering, setAnswering] = useState(null);
  const [saving, setSaving] = useState(false);
  const [qFilter, setQFilter] = useState('pending');

  async function submitAnswer(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/admin/visitor-questions/${answering.id}/answer`, {
        answer_html: textToHtmlPreview(answering.answer_text) || answering.answer_text,
        publish_to_faq: answering.publish,
        category: answering.category || 'General'
      });
      onMessage(answering.publish ? 'Answered and added to the FAQ page' : 'Answer saved (not published)');
      setAnswering(null);
      questions.reload();
      onPublished();
    } catch (err) {
      onMessage(errorText(err), true);
    } finally {
      setSaving(false);
    }
  }

  async function rejectQuestion(q) {
    if (!window.confirm('Reject this question? It will not be published.')) return;
    try {
      await api.patch(`/admin/visitor-questions/${q.id}`, { status: 'rejected' });
      onMessage('Question rejected');
      questions.reload();
    } catch (err) {
      onMessage(errorText(err), true);
    }
  }

  const visible = questions.rows.filter(q => !qFilter || q.status === qFilter);
  return (
    <div>
      <p className="sp-faq-lead">Questions visitors send from the FAQ page. Answer the useful ones and add them to the FAQ page with one click.</p>
      <div className="sp-segmented" style={{ marginBottom: '10px' }}>
        {['pending', 'published', 'answered', 'rejected', ''].map(st => (
          <button key={st || 'all'} type="button" className={qFilter === st ? 'is-active' : ''} onClick={() => setQFilter(st)}>
            {st ? `${st.charAt(0).toUpperCase()}${st.slice(1)} (${questions.rows.filter(q => q.status === st).length})` : `All (${questions.rows.length})`}
          </button>
        ))}
      </div>
      {questions.loading ? <Loading /> : (
        <div className="sp-table-wrapper">
          <table className="sp-table">
            <thead><tr><th>Received</th><th>Question</th><th>From</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {visible.length === 0 ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '16px', color: '#999' }}>Nothing here.</td></tr>
              ) : visible.map(q => (
                <tr key={q.id}>
                  <td><small>{formatDateTimeIST(q.createdAt)}</small></td>
                  <td style={{ maxWidth: '420px', whiteSpace: 'pre-wrap' }}>{q.question}<div><small style={{ color: '#888' }}>{q.category}</small></div></td>
                  <td><small>{q.submitter_name || 'Anonymous'}{q.submitter_email ? <><br />{q.submitter_email}</> : null}</small></td>
                  <td><StatusBadge status={q.status} /></td>
                  <td>
                    {canEdit && q.status === 'pending' && (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button className="sp-btn sp-btn-secondary sp-btn-sm" onClick={() => setAnswering({ ...q, answer_text: '', publish: true })}>Answer</button>
                        <button className="sp-btn sp-btn-outline sp-btn-sm" onClick={() => rejectQuestion(q)}>Reject</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {answering && (
        <Modal isOpen onClose={() => setAnswering(null)} title="Answer visitor question">
          <form onSubmit={submitAnswer}>
            <div style={{ background: '#F9F6F0', padding: '12px', borderRadius: '6px', marginBottom: '12px', whiteSpace: 'pre-wrap' }}>{answering.question}</div>
            <div className="sp-form-group">
              <label className="sp-form-label">Answer *</label>
              <textarea className="sp-textarea" rows="6" value={answering.answer_text} onChange={(e) => setAnswering({ ...answering, answer_text: e.target.value })} required />
              <small className="sp-faq-format">Empty line = new paragraph · <code>- </code> bullet · <code>**bold**</code> · <code>[text](page.htm)</code></small>
            </div>
            <div className="sp-form-group">
              <label className="sp-form-label">FAQ category</label>
              <input className="sp-input" value={answering.category || 'General'} onChange={(e) => setAnswering({ ...answering, category: e.target.value })} />
            </div>
            <Toggle label="Add it to the FAQ page" checked={answering.publish} onChange={(v) => setAnswering({ ...answering, publish: v })} />
            <FormActions onCancel={() => setAnswering(null)} saving={saving} label="Save answer" />
          </form>
        </Modal>
      )}
    </div>
  );
}
