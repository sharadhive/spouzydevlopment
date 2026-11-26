import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import { CLINICAL_STATUSES, statusLabel, formatDateIST, formatDateTimeIST } from '../constants/statuses';
import HelpBox from '../components/HelpBox';

function parseJsonList(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    try { const v = JSON.parse(value); return Array.isArray(v) ? v : []; } catch (e) { return []; }
  }
  return [];
}

function Field({ label, children }) {
  return (
    <div>
      <span className="sp-detail-label">{label}</span>
      <div>{children || <span style={{ color: '#aaa' }}>Not provided</span>}</div>
    </div>
  );
}

export default function ClinicalPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [roleTab, setRoleTab] = useState(searchParams.get('role') === 'counsellor' ? 'counsellor' : 'doctor');
  const [applications, setApplications] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState(CLINICAL_STATUSES.includes(searchParams.get('status')) ? searchParams.get('status') : '');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState('');
  const [feedback, setFeedback] = useState(null);

  const [selected, setSelected] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [internalNotes, setInternalNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  const canEdit = user?.can('clinical_apps:edit');
  const canExport = user?.can('clinical_apps:export');
  const canDownload = user?.can('clinical_apps:download_docs');

  const abortControllerRef = useRef(null);

  useEffect(() => {
    loadApplications();
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleTab, page, statusFilter]);

  async function loadApplications() {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    setLoading(true);
    setPageError('');
    try {
      const q = new URLSearchParams({
        page,
        limit: 15,
        roleType: roleTab,
        ...(statusFilter && { status: statusFilter }),
        ...(searchTerm && { search: searchTerm })
      });
      const res = await api.get(`/admin/clinical-applications?${q}`, { signal: abortControllerRef.current.signal });
      if (res.success) {
        setApplications(res.data.applications || []);
        setTotal(res.data.total || 0);
      }
    } catch (e) {
      if (e.name !== 'AbortError') setPageError(e.message || 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  }

  function handleSearchSubmit(e) {
    e.preventDefault();
    setPage(1);
    loadApplications();
  }

  async function openDetail(app) {
    setPageError('');
    setFeedback(null);
    try {
      const res = await api.get(`/admin/clinical-applications/${app.id}`);
      if (res.success) {
        setSelected(res.data);
        setInternalNotes(res.data.internal_notes || '');
        setModalOpen(true);
      }
    } catch (e) {
      setPageError(e.message || 'Failed to load application details');
    }
  }

  function flash(type, text) {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4000);
  }

  async function handleStatusChange(newStatus) {
    if (!selected || newStatus === selected.status) return;
    try {
      const res = await api.patch(`/admin/clinical-applications/${selected.id}`, { status: newStatus });
      if (res.success) {
        setSelected({ ...selected, status: newStatus });
        flash('success', `Status updated to ${statusLabel(newStatus)}`);
        loadApplications();
      }
    } catch (e) {
      flash('error', `Failed to update status: ${e.message}`);
    }
  }

  async function handleSaveNotes() {
    if (!selected) return;
    setSavingNotes(true);
    try {
      await api.patch(`/admin/clinical-applications/${selected.id}`, { internal_notes: internalNotes });
      setSelected({ ...selected, internal_notes: internalNotes });
      flash('success', 'Confidential notes saved');
    } catch (e) {
      flash('error', `Failed to save notes: ${e.message}`);
    } finally {
      setSavingNotes(false);
    }
  }

  function DocLink({ asset, label }) {
    if (!asset) return null;
    if (!canDownload) {
      return <span className="sp-doc-link" title="Only the Clinical Director and administrators can open certificates"><i className="fa fa-lock"></i> {label}</span>;
    }
    return (
      <a className="sp-doc-link" href={`/api/media/private/${asset.id}`} target="_blank" rel="noopener noreferrer">
        <i className={`fa ${asset.mime_type === 'application/pdf' ? 'fa-file-pdf-o' : 'fa-file-image-o'}`}></i> {label}
      </a>
    );
  }

  const additional = selected ? parseJsonList(selected.additional_qualifications) : [];
  const modes = selected ? parseJsonList(selected.consultation_modes) : [];

  return (
    <div>
      <div className="sp-card">
        <div className="sp-card-header">
          <h2 className="sp-card-title">
            <i className="fa fa-user-md" style={{ marginRight: '8px' }}></i> Clinical Applications &amp; Empanelment ({total})
          </h2>
          {canExport && (
            <a href="/api/admin/clinical-applications/export/csv" className="sp-btn sp-btn-secondary" download>
              <i className="fa fa-download"></i> Export to CSV
            </a>
          )}
        </div>

        {pageError && (
          <div className="sp-inline-alert error">
            <i className="fa fa-exclamation-circle"></i> {pageError}
            <button onClick={loadApplications} className="sp-btn sp-btn-secondary sp-btn-sm" style={{ marginLeft: '12px' }}>Retry</button>
          </div>
        )}

        <div className="sp-tabs">
          <button type="button" className={`sp-tab-btn ${roleTab === 'doctor' ? 'active' : ''}`} onClick={() => { setRoleTab('doctor'); setPage(1); }}>
            <i className="fa fa-stethoscope"></i> Doctors
          </button>
          <button type="button" className={`sp-tab-btn ${roleTab === 'counsellor' ? 'active' : ''}`} onClick={() => { setRoleTab('counsellor'); setPage(1); }}>
            <i className="fa fa-heartbeat"></i> Counsellors &amp; Psychologists
          </button>
        </div>
        <HelpBox topic="clinical" />

        <form onSubmit={handleSearchSubmit} className="sp-filters-bar">
          <div style={{ flex: '1', minWidth: '240px' }}>
            <input type="text" className="sp-input" placeholder="Search reference, name, email, mobile, reg number..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <div style={{ width: '200px' }}>
            <select className="sp-select" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="">All Statuses</option>
              {CLINICAL_STATUSES.map(st => <option key={st} value={st}>{statusLabel(st)}</option>)}
            </select>
          </div>
          <button type="submit" className="sp-btn sp-btn-primary"><i className="fa fa-search"></i> Filter</button>
        </form>

        <div className="sp-table-wrapper">
          <table className="sp-table">
            <thead>
              <tr>
                <th>Ref</th>
                <th>Candidate</th>
                <th>Specialisation</th>
                <th>Experience</th>
                <th>Council / Reg #</th>
                <th>Status</th>
                <th>Applied</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '30px' }}><i className="fa fa-spinner fa-spin"></i> Loading clinical applications...</td></tr>
              ) : applications.length === 0 ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '30px', color: '#999' }}>{pageError ? 'Unable to load records.' : `No ${roleTab} applications match the current filter.`}</td></tr>
              ) : (
                applications.map((app) => (
                  <tr key={app.id}>
                    <td><strong style={{ color: 'var(--sp-copper)' }}>{app.reference_no}</strong></td>
                    <td>
                      <strong>{app.title ? `${app.title} ` : ''}{app.first_name} {app.last_name}</strong>
                      <div><small style={{ color: '#666' }}>{app.email}</small></div>
                    </td>
                    <td>{app.specialisation || '—'}</td>
                    <td>{app.experience_years || '—'}</td>
                    <td>
                      <div>{app.registration_number || '—'}</div>
                      <small style={{ color: '#888' }}>{app.council_name}</small>
                    </td>
                    <td><StatusBadge status={app.status} /></td>
                    <td>{formatDateIST(app.createdAt)}</td>
                    <td><button onClick={() => openDetail(app)} className="sp-btn sp-btn-secondary sp-btn-sm">Review &rarr;</button></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
          <span style={{ fontSize: '13px', color: '#666' }}>Page {page} of {Math.max(1, Math.ceil(total / 15))} ({total} total)</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="sp-btn sp-btn-secondary sp-btn-sm">Previous</button>
            <button disabled={page * 15 >= total} onClick={() => setPage(page + 1)} className="sp-btn sp-btn-secondary sp-btn-sm">Next</button>
          </div>
        </div>
      </div>

      {modalOpen && selected && (
        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          maxWidth="820px"
          title={`Application ${selected.reference_no} · ${selected.role_type === 'doctor' ? 'Doctor' : 'Counsellor'}`}
        >
          {feedback && <div className={`sp-inline-alert ${feedback.type}`}>{feedback.text}</div>}

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px', flexWrap: 'wrap' }}>
            <label style={{ fontWeight: 'bold', fontSize: '13px' }}>Application status:</label>
            {canEdit ? (
              <select className="sp-select" style={{ width: 'auto' }} value={selected.status} onChange={(e) => handleStatusChange(e.target.value)}>
                {CLINICAL_STATUSES.map(st => <option key={st} value={st}>{statusLabel(st)}</option>)}
              </select>
            ) : <StatusBadge status={selected.status} />}
            <small style={{ color: '#888' }}>Submitted {formatDateTimeIST(selected.createdAt)}</small>
          </div>

          <h4 style={{ margin: '0 0 10px', color: 'var(--sp-wine)' }}>Personal &amp; contact</h4>
          <div className="sp-detail-grid">
            <Field label="Full name"><strong>{selected.title} {selected.first_name} {selected.last_name}</strong></Field>
            <Field label="Gender / Date of birth">{[selected.gender, selected.dob].filter(Boolean).join(' · ')}</Field>
            <Field label="Email">{selected.email && <a href={`mailto:${selected.email}`}>{selected.email}</a>}</Field>
            <Field label="Mobile / WhatsApp">{selected.mobile}{selected.whatsapp && selected.whatsapp !== selected.mobile ? ` · WA ${selected.whatsapp}` : ''}</Field>
          </div>

          <h4 style={{ margin: '0 0 10px', color: 'var(--sp-wine)' }}>Practice</h4>
          <div className="sp-detail-grid">
            <Field label="Practice status">{selected.practice_status}</Field>
            <Field label="Experience">{selected.experience_years}</Field>
            <Field label="Institution">{selected.institution_name}</Field>
            <Field label="Specialisation">{selected.specialisation}</Field>
            <Field label="Affiliations">{selected.affiliations}</Field>
            <Field label="Consultation mode">{modes.join(', ')}</Field>
            <Field label="Preferred hours">{selected.preferred_hours_from && selected.preferred_hours_to ? `${selected.preferred_hours_from} – ${selected.preferred_hours_to} IST` : ''}</Field>
            <Field label="Objective">{selected.objective}</Field>
          </div>

          <h4 style={{ margin: '0 0 10px', color: 'var(--sp-wine)' }}>Qualifications &amp; registration</h4>
          <div className="sp-detail-grid">
            <Field label="Primary qualification">{[selected.primary_qualification, selected.primary_college, selected.primary_year, selected.primary_grade].filter(Boolean).join(' · ')}</Field>
            <Field label="Postgraduate">{[selected.pg_qualification, selected.pg_college, selected.pg_year, selected.pg_grade].filter(Boolean).join(' · ')}</Field>
            <Field label="Council / registration body">{selected.council_name}</Field>
            <Field label="Registration">{[selected.registration_number, selected.state_jurisdiction, selected.registration_year && `since ${selected.registration_year}`, selected.valid_until && `valid until ${selected.valid_until}`].filter(Boolean).join(' · ')}</Field>
          </div>

          {additional.length > 0 && (
            <>
              <h4 style={{ margin: '0 0 10px', color: 'var(--sp-wine)' }}>Additional qualifications</h4>
              <ul style={{ margin: '0 0 18px 18px', fontSize: '14px', lineHeight: 1.7 }}>
                {additional.map((q, i) => (
                  <li key={i}>
                    {[q.degree, q.college, q.year, q.grade].filter(Boolean).join(' · ')}
                    {q.cert_asset_id && (canDownload
                      ? <> · <a href={`/api/media/private/${q.cert_asset_id}`} target="_blank" rel="noopener noreferrer">certificate</a></>
                      : <> · <i className="fa fa-lock" title="Restricted"></i> certificate</>)}
                  </li>
                ))}
              </ul>
            </>
          )}

          <h4 style={{ margin: '0 0 6px', color: 'var(--sp-wine)' }}>Documents</h4>
          <div className="sp-doc-list">
            <DocLink asset={selected.photo} label="Photograph" />
            <DocLink asset={selected.primary_cert} label="Primary certificate" />
            <DocLink asset={selected.pg_cert} label="PG certificate" />
            <DocLink asset={selected.council_cert} label="Registration certificate" />
            <DocLink asset={selected.signature} label="Drawn signature" />
            {!selected.photo && !selected.primary_cert && !selected.council_cert && <span style={{ color: '#999', fontSize: '13px' }}>No documents uploaded.</span>}
          </div>

          <h4 style={{ margin: '0 0 10px', color: 'var(--sp-wine)' }}>Declaration</h4>
          <div className="sp-detail-grid">
            <Field label="Declaration accepted">{selected.declaration_agreed ? 'Yes' : 'No'}</Field>
            <Field label="Date">{selected.declaration_date}</Field>
            <Field label="Signed name">{selected.signed_name}</Field>
            <Field label="Typed signature">{selected.typed_signature}</Field>
          </div>

          <div style={{ marginBottom: '8px' }}>
            <label style={{ display: 'block', fontWeight: 'bold', fontSize: '13px', marginBottom: '6px' }}>Confidential evaluation notes</label>
            <textarea
              className="sp-textarea"
              rows="4"
              value={internalNotes}
              disabled={!canEdit}
              onChange={(e) => setInternalNotes(e.target.value)}
              placeholder="Interview observations, verification of qualifications and registration..."
            />
            {canEdit && (
              <button type="button" onClick={handleSaveNotes} disabled={savingNotes} className="sp-btn sp-btn-primary" style={{ marginTop: '8px' }}>
                {savingNotes ? 'Saving...' : 'Save Notes'}
              </button>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
