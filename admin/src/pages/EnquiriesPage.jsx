import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ENQUIRY_STATUSES, statusLabel, formatDateIST, formatDateTimeIST } from '../constants/statuses';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import HelpBox from '../components/HelpBox';

const SOURCE_LABELS = { contact_page: 'Contact page', floating_widget: 'Callback widget', other: 'Other' };

export default function EnquiriesPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const canEdit = user?.can('enquiries:edit');
  const canExport = user?.can('enquiries:export');
  const [enquiries, setEnquiries] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState(ENQUIRY_STATUSES.includes(searchParams.get('status')) ? searchParams.get('status') : '');
  const [sourceFilter, setSourceFilter] = useState(searchParams.get('source') || '');
  const [searchTerm, setSearchTerm] = useState(searchParams.get('ref') || '');
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState('');
  const [feedback, setFeedback] = useState('');

  // Selected for viewing / editing
  const [selected, setSelected] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const abortControllerRef = useRef(null);

  useEffect(() => {
    loadEnquiries();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [page, statusFilter, sourceFilter]);

  async function loadEnquiries() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setPageError('');

    try {
      const q = new URLSearchParams({
        page,
        limit: 15,
        ...(statusFilter && { status: statusFilter }),
        ...(sourceFilter && { source: sourceFilter }),
        ...(searchTerm && { search: searchTerm })
      });
      const res = await api.get(`/admin/enquiries?${q}`, {
        signal: abortControllerRef.current.signal
      });
      if (res.success) {
        setEnquiries(res.data.enquiries || []);
        setTotal(res.data.total || 0);
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        setPageError(e.message || 'Failed to load enquiries');
      }
    } finally {
      setLoading(false);
    }
  }

  function handleSearchSubmit(e) {
    e.preventDefault();
    setPage(1);
    loadEnquiries();
  }

  async function openDetail(enq) {
    setPageError('');
    try {
      const res = await api.get(`/admin/enquiries/${enq.id}`);
      if (res.success) {
        setSelected(res.data);
        setModalOpen(true);
      }
    } catch (e) {
      setPageError(e.message || 'Failed to load enquiry details');
    }
  }

  async function handleStatusChange(newStatus) {
    if (!selected) return;
    try {
      const res = await api.patch(`/admin/enquiries/${selected.id}`, { status: newStatus });
      if (res.success) {
        setSelected({ ...selected, status: newStatus });
        setFeedback(`Status updated to ${newStatus}`);
        setTimeout(() => setFeedback(''), 4000);
        loadEnquiries();
      }
    } catch (e) {
      setFeedback(`Failed to update status: ${e.message}`);
    }
  }

  async function handleAddNote(e) {
    e.preventDefault();
    if (!newNote.trim() || !selected) return;
    setSavingNote(true);
    try {
      const res = await api.post(`/admin/enquiries/${selected.id}/notes`, { note_text: newNote });
      if (res.success) {
        setSelected({
          ...selected,
          notes: [...(selected.notes || []), res.data]
        });
        setNewNote('');
        setFeedback('Note recorded successfully');
        setTimeout(() => setFeedback(''), 4000);
      }
    } catch (e) {
      setFeedback(`Failed to add note: ${e.message}`);
    } finally {
      setSavingNote(false);
    }
  }

  return (
    <div>
      <div className="sp-card">
        <div className="sp-card-header">
          <h2 className="sp-card-title">
            <i className="fa fa-envelope-open-o" style={{ marginRight: '8px' }}></i> Enquiries CRM ({total})
          </h2>

          {canExport && (
            <a href="/api/admin/enquiries/export/csv" className="sp-btn sp-btn-secondary" download>
              <i className="fa fa-download"></i> Export to CSV
            </a>
          )}
        </div>
        <HelpBox topic="enquiries" />

        {pageError && (
          <div style={{
            background: '#FFEBEE',
            borderLeft: '4px solid #C62828',
            color: '#B71C1C',
            padding: '12px 16px',
            borderRadius: '4px',
            marginBottom: '16px'
          }}>
            <i className="fa fa-exclamation-circle"></i> {pageError}
            <button onClick={loadEnquiries} className="sp-btn sp-btn-secondary sp-btn-sm" style={{ marginLeft: '12px' }}>
              Retry
            </button>
          </div>
        )}

        {/* Filters */}
        <form onSubmit={handleSearchSubmit} className="sp-filters-bar">
          <div style={{ flex: '1', minWidth: '240px' }}>
            <input 
              type="text" 
              className="sp-input" 
              placeholder="Search reference, name, email, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div style={{ width: '180px' }}>
            <select 
              className="sp-select"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            >
              <option value="">All Statuses</option>
              {ENQUIRY_STATUSES.map(st => <option key={st} value={st}>{statusLabel(st)}</option>)}
            </select>
          </div>

          <div style={{ width: '180px' }}>
            <select className="sp-select" value={sourceFilter} onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}>
              <option value="">All sources</option>
              <option value="contact_page">Contact page</option>
              <option value="floating_widget">Callback widget</option>
            </select>
          </div>

          <button type="submit" className="sp-btn sp-btn-primary">
            <i className="fa fa-search"></i> Filter
          </button>
        </form>

        {/* Table */}
        <div className="sp-table-wrapper">
          <table className="sp-table">
            <thead>
              <tr>
                <th>Ref</th>
                <th>Client Name</th>
                <th>Contact</th>
                <th>Subject / Area</th>
                <th>Status</th>
                <th>Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '30px' }}>
                    <i className="fa fa-spinner fa-spin"></i> Loading enquiries...
                  </td>
                </tr>
              ) : enquiries.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: '#999' }}>
                    {pageError ? 'Unable to load records.' : 'No enquiries matching current filter.'}
                  </td>
                </tr>
              ) : (
                enquiries.map((e) => (
                  <tr key={e.id}>
                    <td><strong style={{ color: 'var(--sp-copper)' }}>{e.reference_no}</strong></td>
                    <td><strong>{e.name}</strong></td>
                    <td>
                      <div>{e.email}</div>
                      <small style={{ color: '#666' }}>{e.phone}</small>
                    </td>
                    <td>{e.subject || 'General'}</td>
                    <td><StatusBadge status={e.status} /></td>
                    <td>{formatDateIST(e.createdAt)}</td>
                    <td>
                      <button 
                        onClick={() => openDetail(e)} 
                        className="sp-btn sp-btn-secondary sp-btn-sm"
                      >
                        Inspect &rarr;
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Simple Pagination */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
          <span style={{ fontSize: '13px', color: '#666' }}>
            Showing page {page} of {Math.max(1, Math.ceil(total / 15))} ({total} total)
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              disabled={page <= 1} 
              onClick={() => setPage(page - 1)}
              className="sp-btn sp-btn-secondary sp-btn-sm"
            >
              Previous
            </button>
            <button 
              disabled={page * 15 >= total} 
              onClick={() => setPage(page + 1)}
              className="sp-btn sp-btn-secondary sp-btn-sm"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {modalOpen && selected && (
        <Modal 
          isOpen={modalOpen} 
          onClose={() => setModalOpen(false)}
          title={`Enquiry: ${selected.reference_no}`}
        >
          {feedback && (
            <div style={{
              background: '#E8F5E9',
              borderLeft: '4px solid #2E7D32',
              color: '#1B5E20',
              padding: '10px 14px',
              borderRadius: '4px',
              fontSize: '13px',
              marginBottom: '16px'
            }}>
              {feedback}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div>
              <strong style={{ display: 'block', color: '#888', fontSize: '11px', textTransform: 'uppercase' }}>Client Name</strong>
              <div style={{ fontSize: '15px', fontWeight: 'bold' }}>{selected.name}</div>
            </div>
            <div>
              <strong style={{ display: 'block', color: '#888', fontSize: '11px', textTransform: 'uppercase' }}>Service / Area</strong>
              <div>{selected.service_interest || selected.subject || 'General Consultation'}</div>
            </div>
            <div>
              <strong style={{ display: 'block', color: '#888', fontSize: '11px', textTransform: 'uppercase' }}>Email</strong>
              <div><a href={`mailto:${selected.email}`}>{selected.email}</a></div>
            </div>
            <div>
              <strong style={{ display: 'block', color: '#888', fontSize: '11px', textTransform: 'uppercase' }}>Phone / WhatsApp</strong>
              <div>{selected.phone} {selected.whatsapp && `(WA: ${selected.whatsapp})`}</div>
            </div>
            <div>
              <strong style={{ display: 'block', color: '#888', fontSize: '11px', textTransform: 'uppercase' }}>Preferred Contact</strong>
              <div>{selected.preferred_contact_method || selected.preferred_clinic || 'Not specified'}</div>
            </div>
            <div>
              <strong style={{ display: 'block', color: '#888', fontSize: '11px', textTransform: 'uppercase' }}>Source · Consent</strong>
              <div>{SOURCE_LABELS[selected.source] || selected.source || 'Contact page'} · {selected.consent_agreed ? 'Consent given' : 'No consent recorded'}</div>
            </div>
            <div>
              <strong style={{ display: 'block', color: '#888', fontSize: '11px', textTransform: 'uppercase' }}>Received</strong>
              <div>{formatDateTimeIST(selected.createdAt)}</div>
            </div>
            <div>
              <strong style={{ display: 'block', color: '#888', fontSize: '11px', textTransform: 'uppercase' }}>Current Status</strong>
              <div style={{ marginTop: '4px' }}>
                <StatusBadge status={selected.status} />
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '20px', background: '#F9F6F0', padding: '14px', borderRadius: '6px' }}>
            <strong style={{ display: 'block', color: '#4B2030', marginBottom: '6px' }}>Message Details:</strong>
            <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: '1.5', color: '#333' }}>{selected.message}</p>
          </div>

          {/* Status Change Selector */}
          <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <label style={{ fontWeight: 'bold', fontSize: '13px' }}>Update Status:</label>
            <select 
              className="sp-select" 
              style={{ width: 'auto' }}
              value={selected.status}
              disabled={!canEdit}
              onChange={(e) => handleStatusChange(e.target.value)}
            >
              {ENQUIRY_STATUSES.map(st => (
                <option key={st} value={st}>{statusLabel(st)}</option>
              ))}
            </select>
          </div>

          {/* Notes History & Add Note */}
          <div>
            <h4 style={{ fontSize: '14px', borderBottom: '1px solid #EEE', paddingBottom: '8px', marginBottom: '12px' }}>
              Staff Internal Notes &amp; Actions ({selected.notes?.length || 0})
            </h4>

            <div style={{ maxHeight: '180px', overflowY: 'auto', marginBottom: '16px' }}>
              {selected.notes && selected.notes.length > 0 ? (
                selected.notes.map((n, idx) => (
                  <div key={idx} style={{ padding: '8px 10px', background: '#FFF', border: '1px solid #EEE', borderRadius: '4px', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#888' }}>
                      <span>{n.author ? `${n.author.first_name || ''} ${n.author.last_name || ''}`.trim() : 'Staff User'}</span>
                      <span>{formatDateTimeIST(n.createdAt)}</span>
                    </div>
                    <div style={{ fontSize: '13px', marginTop: '4px' }}>{n.note_text}</div>
                  </div>
                ))
              ) : (
                <p style={{ color: '#999', fontSize: '12px' }}>No internal notes recorded yet.</p>
              )}
            </div>

            {canEdit && <form onSubmit={handleAddNote} style={{ display: 'flex', gap: '8px' }}>
              <input 
                type="text" 
                className="sp-input" 
                placeholder="Add confidential staff note..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                disabled={savingNote}
              />
              <button type="submit" className="sp-btn sp-btn-primary" disabled={savingNote || !newNote.trim()}>
                {savingNote ? 'Adding...' : 'Add Note'}
              </button>
            </form>}
          </div>
        </Modal>
      )}
    </div>
  );
}
