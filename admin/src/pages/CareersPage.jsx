import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import { CAREER_STATUSES, statusLabel, formatDateIST, formatDateTimeIST } from '../constants/statuses';
import HelpBox from '../components/HelpBox';

const EMPTY_OPENING = {
  title: '',
  department: '',
  summary: '',
  responsibilities: '',
  required_skills: '',
  preferred_background: '',
  employment_type: 'Full-time',
  location: 'Discussed during selection',
  salary_notes: 'Compensation and employment terms are discussed during the selection process.',
  sort_order: 0,
  is_active: true
};

function toLines(value) {
  let list = value;
  if (typeof list === 'string') { try { list = JSON.parse(list); } catch (e) { list = list.split('\n'); } }
  return Array.isArray(list) ? list.join('\n') : '';
}

function fromLines(text) {
  return String(text || '').split('\n').map(s => s.trim()).filter(Boolean);
}

function Field({ label, children }) {
  return (
    <div>
      <span className="sp-detail-label">{label}</span>
      <div>{children || <span style={{ color: '#aaa' }}>Not provided</span>}</div>
    </div>
  );
}

export default function CareersPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const canEdit = user?.can('careers:edit');
  const canDownload = user?.can('careers:download');

  const [activeTab, setActiveTab] = useState(searchParams.get('tab') === 'openings' ? 'openings' : 'applications');
  const [applications, setApplications] = useState([]);
  const [openings, setOpenings] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState(CAREER_STATUSES.includes(searchParams.get('status')) ? searchParams.get('status') : '');
  const [openingFilter, setOpeningFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState('');
  const [feedback, setFeedback] = useState('');

  const [selectedApp, setSelectedApp] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [notes, setNotes] = useState('');

  const [openingModalOpen, setOpeningModalOpen] = useState(false);
  const [editingOpening, setEditingOpening] = useState(null);
  const [openingForm, setOpeningForm] = useState(EMPTY_OPENING);
  const [savingOpening, setSavingOpening] = useState(false);

  const abortControllerRef = useRef(null);

  useEffect(() => {
    loadOpenings();
  }, []);

  useEffect(() => {
    if (activeTab === 'applications') loadApplications();
    return () => { if (abortControllerRef.current) abortControllerRef.current.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, page, statusFilter, openingFilter]);

  function showMessage(msg, isErr = false) {
    if (isErr) {
      setPageError(msg);
      setTimeout(() => setPageError(''), 6000);
    } else {
      setFeedback(msg);
      setTimeout(() => setFeedback(''), 4000);
    }
  }

  async function loadApplications() {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    setLoading(true);
    setPageError('');
    try {
      const q = new URLSearchParams({
        page,
        limit: 15,
        ...(statusFilter && { status: statusFilter }),
        ...(openingFilter && { openingId: openingFilter }),
        ...(searchTerm && { search: searchTerm })
      });
      const res = await api.get(`/admin/career-applications?${q}`, { signal: abortControllerRef.current.signal });
      if (res.success) {
        setApplications(res.data.applications || []);
        setTotal(res.data.total || 0);
      }
    } catch (e) {
      if (e.name !== 'AbortError') setPageError(e.message || 'Failed to load career applications');
    } finally {
      setLoading(false);
    }
  }

  async function loadOpenings() {
    try {
      const res = await api.get('/admin/career-openings');
      if (res.success) setOpenings(res.data || []);
    } catch (e) {
      setPageError(e.message || 'Failed to load openings');
    }
  }

  async function openAppDetail(app) {
    try {
      const res = await api.get(`/admin/career-applications/${app.id}`);
      if (res.success) {
        setSelectedApp(res.data);
        setNotes(res.data.internal_notes || '');
        setModalOpen(true);
      }
    } catch (e) {
      showMessage(e.message, true);
    }
  }

  async function updateApp(patch, message) {
    if (!selectedApp) return;
    try {
      await api.patch(`/admin/career-applications/${selectedApp.id}`, patch);
      setSelectedApp({ ...selectedApp, ...patch });
      showMessage(message);
      loadApplications();
    } catch (e) {
      showMessage(e.message, true);
    }
  }

  function openNewOpening() {
    setEditingOpening(null);
    setOpeningForm(EMPTY_OPENING);
    setOpeningModalOpen(true);
  }

  function openEditOpening(op) {
    setEditingOpening(op);
    setOpeningForm({
      title: op.title || '',
      department: op.department || '',
      summary: op.summary || '',
      responsibilities: toLines(op.responsibilities),
      required_skills: toLines(op.required_skills),
      preferred_background: toLines(op.preferred_background),
      employment_type: op.employment_type || 'Full-time',
      location: op.location || '',
      salary_notes: op.salary_notes || '',
      sort_order: op.sort_order || 0,
      is_active: !!op.is_active
    });
    setOpeningModalOpen(true);
  }

  async function handleSaveOpening(e) {
    e.preventDefault();
    setSavingOpening(true);
    const payload = {
      ...openingForm,
      responsibilities: fromLines(openingForm.responsibilities),
      required_skills: fromLines(openingForm.required_skills),
      preferred_background: fromLines(openingForm.preferred_background),
      sort_order: parseInt(openingForm.sort_order, 10) || 0,
      ...(editingOpening ? { slug: editingOpening.slug } : {})
    };
    try {
      if (editingOpening) {
        await api.put(`/admin/career-openings/${editingOpening.id}`, payload);
        showMessage('Opening updated. The careers page now shows the new details.');
      } else {
        await api.post('/admin/career-openings', payload);
        showMessage('Opening published on the careers page.');
      }
      setOpeningModalOpen(false);
      loadOpenings();
    } catch (err) {
      showMessage(err.message, true);
    } finally {
      setSavingOpening(false);
    }
  }

  async function toggleOpening(op) {
    try {
      await api.put(`/admin/career-openings/${op.id}`, {
        ...op,
        is_active: !op.is_active,
        responsibilities: Array.isArray(op.responsibilities) ? op.responsibilities : [],
        required_skills: Array.isArray(op.required_skills) ? op.required_skills : [],
        preferred_background: Array.isArray(op.preferred_background) ? op.preferred_background : []
      });
      showMessage(op.is_active ? `"${op.title}" closed and hidden from the website.` : `"${op.title}" reopened on the website.`);
      loadOpenings();
    } catch (e) {
      showMessage(e.message, true);
    }
  }

  const f = openingForm;
  const setF = (patch) => setOpeningForm({ ...openingForm, ...patch });

  return (
    <div>
      <div className="sp-card">
        <div className="sp-card-header">
          <h2 className="sp-card-title"><i className="fa fa-briefcase" style={{ marginRight: '8px' }}></i> Careers &amp; Recruitment</h2>
          {activeTab === 'openings' && canEdit && (
            <button type="button" onClick={openNewOpening} className="sp-btn sp-btn-primary"><i className="fa fa-plus"></i> Post Job Opening</button>
          )}
        </div>

        {feedback && <div className="sp-inline-alert success"><i className="fa fa-check-circle"></i> {feedback}</div>}
        {pageError && (
          <div className="sp-inline-alert error">
            <i className="fa fa-exclamation-circle"></i> {pageError}
            <button onClick={activeTab === 'applications' ? loadApplications : loadOpenings} className="sp-btn sp-btn-secondary sp-btn-sm" style={{ marginLeft: '12px' }}>Retry</button>
          </div>
        )}

        <div className="sp-tabs">
          <button type="button" className={`sp-tab-btn ${activeTab === 'applications' ? 'active' : ''}`} onClick={() => { setActiveTab('applications'); setPage(1); }}>
            <i className="fa fa-id-card-o"></i> Candidate Applications ({total})
          </button>
          <button type="button" className={`sp-tab-btn ${activeTab === 'openings' ? 'active' : ''}`} onClick={() => setActiveTab('openings')}>
            <i className="fa fa-list"></i> Job Openings ({openings.length})
          </button>
        </div>
        <HelpBox topic="careers" />

        {activeTab === 'applications' ? (
          <div>
            <form onSubmit={(e) => { e.preventDefault(); setPage(1); loadApplications(); }} className="sp-filters-bar">
              <div style={{ flex: '1', minWidth: '220px' }}>
                <input type="text" className="sp-input" placeholder="Search reference, name, email, mobile, role..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
              <div style={{ width: '200px' }}>
                <select className="sp-select" value={openingFilter} onChange={(e) => { setOpeningFilter(e.target.value); setPage(1); }}>
                  <option value="">All roles</option>
                  {openings.map(op => <option key={op.id} value={op.id}>{op.title}</option>)}
                </select>
              </div>
              <div style={{ width: '200px' }}>
                <select className="sp-select" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
                  <option value="">All statuses</option>
                  {CAREER_STATUSES.map(st => <option key={st} value={st}>{statusLabel(st)}</option>)}
                </select>
              </div>
              <button type="submit" className="sp-btn sp-btn-primary"><i className="fa fa-search"></i> Filter</button>
            </form>

            <div className="sp-table-wrapper">
              <table className="sp-table">
                <thead>
                  <tr><th>Ref #</th><th>Candidate</th><th>Role</th><th>Experience</th><th>City</th><th>Status</th><th>Applied</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="8" style={{ textAlign: 'center', padding: '30px' }}><i className="fa fa-spinner fa-spin"></i> Loading...</td></tr>
                  ) : applications.length === 0 ? (
                    <tr><td colSpan="8" style={{ textAlign: 'center', padding: '30px', color: '#999' }}>No candidate applications found.</td></tr>
                  ) : applications.map((app) => (
                    <tr key={app.id}>
                      <td><strong style={{ color: 'var(--sp-copper)' }}>{app.reference_no}</strong></td>
                      <td>
                        <strong>{app.full_name}</strong>
                        <div><small style={{ color: '#666' }}>{app.email} · {app.mobile}</small></div>
                      </td>
                      <td>{app.opening?.title || app.role_title}</td>
                      <td>{app.experience_level}</td>
                      <td>{app.city}</td>
                      <td><StatusBadge status={app.status} /></td>
                      <td>{formatDateIST(app.createdAt)}</td>
                      <td><button onClick={() => openAppDetail(app)} className="sp-btn sp-btn-secondary sp-btn-sm">Review &rarr;</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
              <span style={{ fontSize: '13px', color: '#666' }}>Page {page} of {Math.max(1, Math.ceil(total / 15))}</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="sp-btn sp-btn-secondary sp-btn-sm">Previous</button>
                <button disabled={page * 15 >= total} onClick={() => setPage(page + 1)} className="sp-btn sp-btn-secondary sp-btn-sm">Next</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="sp-table-wrapper">
            <table className="sp-table">
              <thead>
                <tr><th>Job Title</th><th>Department</th><th>Type</th><th>Applications</th><th>Status</th>{canEdit && <th>Actions</th>}</tr>
              </thead>
              <tbody>
                {openings.length === 0 ? (
                  <tr><td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: '#999' }}>No openings yet.</td></tr>
                ) : openings.map((op) => (
                  <tr key={op.id}>
                    <td><strong>{op.title}</strong><div><small style={{ color: '#888' }}>/{op.slug}</small></div></td>
                    <td>{op.department}</td>
                    <td>{op.employment_type}</td>
                    <td>{Array.isArray(op.applications) ? op.applications.length : 0}</td>
                    <td><span className={`sp-badge ${op.is_active ? 'approved' : 'closed'}`}>{op.is_active ? 'Open on website' : 'Closed'}</span></td>
                    {canEdit && (
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button onClick={() => openEditOpening(op)} className="sp-btn sp-btn-secondary sp-btn-sm" style={{ marginRight: '6px' }}><i className="fa fa-pencil"></i> Edit</button>
                        <button onClick={() => toggleOpening(op)} className="sp-btn sp-btn-outline sp-btn-sm">{op.is_active ? 'Close' : 'Reopen'}</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && selectedApp && (
        <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} maxWidth="760px" title={`Candidate ${selectedApp.reference_no} · ${selectedApp.full_name}`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px', flexWrap: 'wrap' }}>
            <label style={{ fontWeight: 'bold', fontSize: '13px' }}>Status:</label>
            {canEdit ? (
              <select className="sp-select" style={{ width: 'auto' }} value={selectedApp.status} onChange={(e) => updateApp({ status: e.target.value }, `Status updated to ${statusLabel(e.target.value)}`)}>
                {CAREER_STATUSES.map(st => <option key={st} value={st}>{statusLabel(st)}</option>)}
              </select>
            ) : <StatusBadge status={selectedApp.status} />}
            <small style={{ color: '#888' }}>Applied {formatDateTimeIST(selectedApp.createdAt)}</small>
          </div>

          <div className="sp-detail-grid">
            <Field label="Role applied for"><strong>{selectedApp.opening?.title || selectedApp.role_title}</strong></Field>
            <Field label="Email">{selectedApp.email && <a href={`mailto:${selectedApp.email}`}>{selectedApp.email}</a>}</Field>
            <Field label="Mobile / WhatsApp">{selectedApp.mobile}{selectedApp.whatsapp && selectedApp.whatsapp !== selectedApp.mobile ? ` · WA ${selectedApp.whatsapp}` : ''}</Field>
            <Field label="City">{selectedApp.city}</Field>
            <Field label="Experience">{selectedApp.experience_level}</Field>
            <Field label="Current / last role">{selectedApp.current_role}</Field>
            <Field label="Highest qualification">{selectedApp.highest_qualification}</Field>
            <Field label="Notice period">{selectedApp.notice_period}</Field>
            <Field label="Expected compensation">{selectedApp.expected_compensation}</Field>
            <Field label="Portfolio / LinkedIn">{selectedApp.portfolio_url && <a href={selectedApp.portfolio_url} target="_blank" rel="noopener noreferrer">{selectedApp.portfolio_url}</a>}</Field>
            <Field label="Consent given">{selectedApp.consent_agreed ? 'Yes' : 'No'}</Field>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <span className="sp-detail-label">Key skills</span>
            <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{selectedApp.skills}</p>
          </div>
          <div style={{ marginBottom: '16px', background: '#F9F6F0', padding: '14px', borderRadius: '6px' }}>
            <span className="sp-detail-label">Why they want to join</span>
            <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{selectedApp.statement_of_purpose}</p>
          </div>

          <div className="sp-doc-list">
            {selectedApp.resume && (canDownload ? (
              <a className="sp-doc-link" href={`/api/media/private/${selectedApp.resume.id}`} target="_blank" rel="noopener noreferrer">
                <i className="fa fa-file-text-o"></i> Open resume ({selectedApp.resume.original_name})
              </a>
            ) : (
              <span className="sp-doc-link"><i className="fa fa-lock"></i> Resume (restricted)</span>
            ))}
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', fontSize: '13px', marginBottom: '6px' }}>Internal notes</label>
            <textarea className="sp-textarea" rows="3" value={notes} disabled={!canEdit} onChange={(e) => setNotes(e.target.value)} placeholder="Interview notes, next steps..." />
            {canEdit && <button type="button" className="sp-btn sp-btn-primary" style={{ marginTop: '8px' }} onClick={() => updateApp({ internal_notes: notes }, 'Notes saved')}>Save Notes</button>}
          </div>
        </Modal>
      )}

      {openingModalOpen && (
        <Modal isOpen={openingModalOpen} onClose={() => setOpeningModalOpen(false)} maxWidth="760px" title={editingOpening ? `Edit opening: ${editingOpening.title}` : 'Create New Job Opening'}>
          <form onSubmit={handleSaveOpening}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="sp-form-group">
                <label className="sp-form-label">Job title *</label>
                <input type="text" className="sp-input" value={f.title} onChange={(e) => setF({ title: e.target.value })} required />
              </div>
              <div className="sp-form-group">
                <label className="sp-form-label">Department *</label>
                <input type="text" className="sp-input" value={f.department} onChange={(e) => setF({ department: e.target.value })} placeholder="e.g. Marketing" required />
              </div>
            </div>
            <div className="sp-form-group">
              <label className="sp-form-label">Summary (shown on the job card) *</label>
              <textarea className="sp-textarea" rows="2" value={f.summary} onChange={(e) => setF({ summary: e.target.value })} required />
            </div>
            <div className="sp-form-group">
              <label className="sp-form-label">Key responsibilities (one per line)</label>
              <textarea className="sp-textarea" rows="4" value={f.responsibilities} onChange={(e) => setF({ responsibilities: e.target.value })} />
            </div>
            <div className="sp-form-group">
              <label className="sp-form-label">Required skills (one per line)</label>
              <textarea className="sp-textarea" rows="3" value={f.required_skills} onChange={(e) => setF({ required_skills: e.target.value })} />
            </div>
            <div className="sp-form-group">
              <label className="sp-form-label">Preferred background (one per line)</label>
              <textarea className="sp-textarea" rows="2" value={f.preferred_background} onChange={(e) => setF({ preferred_background: e.target.value })} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 110px', gap: '12px' }}>
              <div className="sp-form-group">
                <label className="sp-form-label">Employment type</label>
                <select className="sp-select" value={f.employment_type} onChange={(e) => setF({ employment_type: e.target.value })}>
                  <option value="Full-time">Full-time</option>
                  <option value="Part-time">Part-time</option>
                  <option value="Contract">Contract</option>
                  <option value="Internship">Internship</option>
                </select>
              </div>
              <div className="sp-form-group">
                <label className="sp-form-label">Location</label>
                <input type="text" className="sp-input" value={f.location} onChange={(e) => setF({ location: e.target.value })} />
              </div>
              <div className="sp-form-group">
                <label className="sp-form-label">Order</label>
                <input type="number" className="sp-input" value={f.sort_order} onChange={(e) => setF({ sort_order: e.target.value })} />
              </div>
            </div>
            <div className="sp-form-group">
              <label className="sp-form-label">Compensation note</label>
              <input type="text" className="sp-input" value={f.salary_notes} onChange={(e) => setF({ salary_notes: e.target.value })} />
            </div>
            <label style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '14px' }}>
              <input type="checkbox" checked={!!f.is_active} onChange={(e) => setF({ is_active: e.target.checked })} /> Show this opening on the website
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <button type="button" onClick={() => setOpeningModalOpen(false)} className="sp-btn sp-btn-outline">Cancel</button>
              <button type="submit" className="sp-btn sp-btn-primary" disabled={savingOpening}>{savingOpening ? 'Saving...' : (editingOpening ? 'Save Changes' : 'Publish Opening')}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
