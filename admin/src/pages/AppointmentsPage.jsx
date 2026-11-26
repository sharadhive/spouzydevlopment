import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import { BlockedTimePanel, PractitionersPanel, ServicesPanel } from '../components/SchedulingPanels';
import HelpBox from '../components/HelpBox';
import {
  APPOINTMENT_STATUSES, APPOINTMENT_ACTIONS, PAYMENT_STATUSES,
  statusLabel, formatDateIST, formatDateTimeIST, formatInrFromMinor, todayIST
} from '../constants/statuses';

const MODE_LABELS = { video: 'Video / audio', phone: 'Phone', 'in-person': 'In person' };
const CLINIC_LABELS = { mumbai: 'Mumbai (Mulund)', pune: 'Pune (Koregaon Park)', delhi: 'New Delhi (South Extension)', bengaluru: 'Bengaluru (Indiranagar)' };

function Field({ label, children }) {
  return (
    <div>
      <span className="sp-detail-label">{label}</span>
      <div>{children || <span style={{ color: '#aaa' }}>—</span>}</div>
    </div>
  );
}

export default function AppointmentsPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const canEdit = user?.can('appointments:edit');
  const canReschedule = user?.can('appointments:reschedule');
  const canSchedule = user?.can('scheduling:view');
  const canPractitioners = user?.can('practitioners:view');

  const [tab, setTab] = useState(searchParams.get('tab') || 'appointments');
  const [appointments, setAppointments] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [dateFilter, setDateFilter] = useState(/^\d{4}-\d{2}-\d{2}$/.test(searchParams.get('date') || '') ? searchParams.get('date') : '');
  const [statusFilter, setStatusFilter] = useState(APPOINTMENT_STATUSES.includes(searchParams.get('status')) ? searchParams.get('status') : '');
  const [typeFilter, setTypeFilter] = useState(searchParams.get('type') || '');
  const [paymentFilter, setPaymentFilter] = useState(PAYMENT_STATUSES.includes(searchParams.get('payment')) ? searchParams.get('payment') : '');
  const [searchTerm, setSearchTerm] = useState(searchParams.get('ref') || '');
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState('');
  const [feedback, setFeedback] = useState('');

  const [selectedApt, setSelectedApt] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [statusNote, setStatusNote] = useState('');

  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [rescheduleData, setRescheduleData] = useState({ newDate: '', newStartTime: '10:00', duration: 30, reason: 'Client requested reschedule' });

  const abortControllerRef = useRef(null);

  useEffect(() => {
    if (tab === 'appointments') loadAppointments();
    return () => { if (abortControllerRef.current) abortControllerRef.current.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, page, dateFilter, statusFilter, typeFilter, paymentFilter]);

  function showMessage(msg, isErr = false) {
    if (isErr) {
      setPageError(msg);
      setTimeout(() => setPageError(''), 6000);
    } else {
      setFeedback(msg);
      setTimeout(() => setFeedback(''), 4000);
    }
  }

  async function loadAppointments() {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    setLoading(true);
    setPageError('');
    try {
      const q = new URLSearchParams({
        page,
        limit: 15,
        ...(dateFilter && { date: dateFilter }),
        ...(statusFilter && { status: statusFilter }),
        ...(typeFilter && { bookingType: typeFilter }),
        ...(paymentFilter && { paymentStatus: paymentFilter }),
        ...(searchTerm && { search: searchTerm })
      });
      const res = await api.get(`/admin/appointments?${q}`, { signal: abortControllerRef.current.signal });
      if (res.success) {
        setAppointments(res.data.appointments || []);
        setTotal(res.data.total || 0);
      }
    } catch (e) {
      if (e.name !== 'AbortError') setPageError(e.message || 'Failed to load appointments');
    } finally {
      setLoading(false);
    }
  }

  async function openDetail(apt) {
    try {
      const res = await api.get(`/admin/appointments/${apt.id}`);
      setSelectedApt(res.success ? res.data : apt);
    } catch (e) {
      setSelectedApt(apt);
    }
    setStatusNote('');
    setDetailModalOpen(true);
  }

  async function handleStatusChange(aptId, newStatus) {
    try {
      await api.patch(`/admin/appointments/${aptId}/status`, {
        status: newStatus,
        reason: statusNote || `Status changed to ${statusLabel(newStatus)} by staff`
      });
      showMessage(`Appointment marked ${statusLabel(newStatus)}`);
      loadAppointments();
      if (selectedApt && selectedApt.id === aptId) openDetail({ id: aptId });
    } catch (e) {
      showMessage(e.message, true);
    }
  }

  async function handleRescheduleSubmit(e) {
    e.preventDefault();
    if (!selectedApt) return;
    try {
      await api.post(`/admin/appointments/${selectedApt.id}/reschedule`, rescheduleData);
      showMessage('Appointment rescheduled');
      setRescheduleModalOpen(false);
      loadAppointments();
    } catch (err) {
      showMessage(err.message, true);
    }
  }

  function openReschedule(apt) {
    setSelectedApt(apt);
    setRescheduleData({
      newDate: apt.appointment_date,
      newStartTime: apt.start_time?.slice(0, 5) || '10:00',
      duration: apt.duration_minutes === 60 ? 60 : 30,
      reason: 'Client requested reschedule'
    });
    setRescheduleModalOpen(true);
  }

  const history = selectedApt && Array.isArray(selectedApt.status_history)
    ? [...selectedApt.status_history].sort((a, b) => b.id - a.id)
    : [];

  return (
    <div>
      <div className="sp-card">
        <div className="sp-card-header">
          <h2 className="sp-card-title"><i className="fa fa-calendar-check-o" style={{ marginRight: '8px' }}></i> Appointments &amp; Scheduling</h2>
        </div>

        {feedback && <div className="sp-inline-alert success"><i className="fa fa-check-circle"></i> {feedback}</div>}
        {pageError && (
          <div className="sp-inline-alert error">
            <i className="fa fa-exclamation-circle"></i> {pageError}
            {tab === 'appointments' && <button onClick={loadAppointments} className="sp-btn sp-btn-secondary sp-btn-sm" style={{ marginLeft: '12px' }}>Retry</button>}
          </div>
        )}

        <div className="sp-tabs">
          <button type="button" className={`sp-tab-btn ${tab === 'appointments' ? 'active' : ''}`} onClick={() => setTab('appointments')}><i className="fa fa-calendar"></i> Appointments ({total})</button>
          {canSchedule && <button type="button" className={`sp-tab-btn ${tab === 'blocks' ? 'active' : ''}`} onClick={() => setTab('blocks')}><i className="fa fa-ban"></i> Blocked Time</button>}
          {canPractitioners && <button type="button" className={`sp-tab-btn ${tab === 'practitioners' ? 'active' : ''}`} onClick={() => setTab('practitioners')}><i className="fa fa-user-md"></i> Practitioners &amp; Hours</button>}
          {canSchedule && <button type="button" className={`sp-tab-btn ${tab === 'services' ? 'active' : ''}`} onClick={() => setTab('services')}><i className="fa fa-inr"></i> Services &amp; Prices</button>}
        </div>
        <HelpBox key={`help-${tab}`} topic={tab === 'appointments' ? 'appointments' : `appointments.${tab}`} />

        {tab === 'blocks' && <BlockedTimePanel onMessage={showMessage} />}
        {tab === 'practitioners' && <PractitionersPanel onMessage={showMessage} />}
        {tab === 'services' && <ServicesPanel onMessage={showMessage} />}

        {tab === 'appointments' && (
          <>
            <form className="sp-filters-bar" onSubmit={(e) => { e.preventDefault(); setPage(1); loadAppointments(); }}>
              <div style={{ flex: '1', minWidth: '200px' }}>
                <input type="text" className="sp-input" placeholder="Search reference, name, email, mobile..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
              <div style={{ width: '160px' }}>
                <input type="date" className="sp-input" value={dateFilter} onChange={(e) => { setDateFilter(e.target.value); setPage(1); }} />
              </div>
              <div style={{ width: '170px' }}>
                <select className="sp-select" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
                  <option value="">All statuses</option>
                  {APPOINTMENT_STATUSES.map(st => <option key={st} value={st}>{statusLabel(st)}</option>)}
                </select>
              </div>
              <div style={{ width: '130px' }}>
                <select className="sp-select" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
                  <option value="">Free &amp; paid</option>
                  <option value="free">Free</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
              <div style={{ width: '160px' }}>
                <select className="sp-select" value={paymentFilter} onChange={(e) => { setPaymentFilter(e.target.value); setPage(1); }}>
                  <option value="">Any payment</option>
                  {PAYMENT_STATUSES.map(st => <option key={st} value={st}>{statusLabel(st)}</option>)}
                </select>
              </div>
              <button type="button" className="sp-btn sp-btn-outline" onClick={() => { setDateFilter(todayIST()); setPage(1); }}>Today</button>
              {(dateFilter || statusFilter || typeFilter || paymentFilter) && (
                <button type="button" onClick={() => { setDateFilter(''); setStatusFilter(''); setTypeFilter(''); setPaymentFilter(''); setPage(1); }} className="sp-btn sp-btn-outline">Clear</button>
              )}
            </form>

            <div className="sp-table-wrapper">
              <table className="sp-table">
                <thead>
                  <tr><th>Reference</th><th>Date &amp; time (IST)</th><th>Client</th><th>Practitioner</th><th>Service</th><th>Type / payment</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="8" style={{ textAlign: 'center', padding: '30px' }}><i className="fa fa-spinner fa-spin"></i> Loading appointments...</td></tr>
                  ) : appointments.length === 0 ? (
                    <tr><td colSpan="8" style={{ textAlign: 'center', padding: '30px', color: '#999' }}>{pageError ? 'Unable to load records.' : 'No appointments for the selected filters.'}</td></tr>
                  ) : appointments.map((apt) => (
                    <tr key={apt.id}>
                      <td><strong style={{ color: 'var(--sp-copper)' }}>{apt.reference_no}</strong></td>
                      <td>
                        <div><strong>{formatDateIST(apt.appointment_date)}</strong></div>
                        <small style={{ color: '#666' }}>{apt.start_time?.slice(0, 5)}–{apt.end_time?.slice(0, 5)} · {apt.duration_minutes} min</small>
                      </td>
                      <td>
                        <strong>{apt.client_name}</strong>
                        <div><small style={{ color: '#888' }}>{apt.client_mobile}</small></div>
                      </td>
                      <td>{apt.practitioner?.name || 'Unassigned'}</td>
                      <td>{apt.service?.name || '—'}</td>
                      <td>
                        <span className={`sp-badge ${apt.booking_type === 'free' ? 'free' : 'paid_type'}`}>{apt.booking_type === 'free' ? 'Free' : 'Paid'}</span>
                        {apt.booking_type !== 'free' && <div style={{ marginTop: '4px' }}><StatusBadge status={apt.payment_status} /></div>}
                      </td>
                      <td><StatusBadge status={apt.status} /></td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={() => openDetail(apt)} className="sp-btn sp-btn-secondary sp-btn-sm">View</button>
                          {canReschedule && !['cancelled', 'completed'].includes(apt.status) && (
                            <button onClick={() => openReschedule(apt)} className="sp-btn sp-btn-outline sp-btn-sm">Reschedule</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
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
          </>
        )}
      </div>

      {detailModalOpen && selectedApt && (
        <Modal isOpen={detailModalOpen} onClose={() => setDetailModalOpen(false)} maxWidth="760px" title={`Appointment ${selectedApt.reference_no}`}>
          <div className="sp-detail-grid">
            <Field label="Client">
              <strong>{selectedApt.client_name}</strong>
              <div>{selectedApt.client_mobile}{selectedApt.client_whatsapp && selectedApt.client_whatsapp !== selectedApt.client_mobile ? ` · WA ${selectedApt.client_whatsapp}` : ''}</div>
              <div>{selectedApt.client_email && <a href={`mailto:${selectedApt.client_email}`}>{selectedApt.client_email}</a>}</div>
            </Field>
            <Field label="Practitioner">
              <strong>{selectedApt.practitioner?.name || 'Unassigned'}</strong>
              <div>{selectedApt.practitioner?.title}</div>
            </Field>
            <Field label="When (IST)"><strong>{formatDateIST(selectedApt.appointment_date)}</strong> · {selectedApt.start_time?.slice(0, 5)}–{selectedApt.end_time?.slice(0, 5)} ({selectedApt.duration_minutes} min)</Field>
            <Field label="Service">{selectedApt.service?.name}</Field>
            <Field label="Mode">{MODE_LABELS[selectedApt.consultation_mode] || selectedApt.consultation_mode}{selectedApt.clinic_location ? ` · ${CLINIC_LABELS[selectedApt.clinic_location] || selectedApt.clinic_location}` : ''}</Field>
            <Field label="Type &amp; payment">
              {selectedApt.booking_type === 'free' ? 'Free consultation' : `Paid · ${formatInrFromMinor(selectedApt.amount_minor_units)}`}
              {selectedApt.booking_type !== 'free' && <> · <StatusBadge status={selectedApt.payment_status} /></>}
            </Field>
            <Field label="Status"><StatusBadge status={selectedApt.status} />{selectedApt.status === 'hold' && selectedApt.hold_expires_at ? <small> until {formatDateTimeIST(selectedApt.hold_expires_at)}</small> : null}</Field>
            <Field label="Booked">{formatDateTimeIST(selectedApt.createdAt)}</Field>
          </div>

          {selectedApt.client_notes && (
            <div style={{ marginBottom: '14px', background: '#F9F6F0', padding: '12px', borderRadius: '6px' }}>
              <span className="sp-detail-label">Client notes</span>
              <div style={{ whiteSpace: 'pre-wrap' }}>{selectedApt.client_notes}</div>
            </div>
          )}
          {selectedApt.internal_notes && (
            <div className="sp-inline-alert info" style={{ whiteSpace: 'pre-wrap' }}>{selectedApt.internal_notes}</div>
          )}

          {canEdit && (
            <div style={{ marginBottom: '18px' }}>
              <label style={{ fontWeight: 'bold', fontSize: '13px' }}>Update status</label>
              <input type="text" className="sp-input" style={{ margin: '8px 0' }} placeholder="Reason / note (optional)" value={statusNote} onChange={(e) => setStatusNote(e.target.value)} />
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {APPOINTMENT_ACTIONS.map(st => (
                  <button key={st} type="button" onClick={() => handleStatusChange(selectedApt.id, st)} disabled={selectedApt.status === st}
                    className={`sp-btn sp-btn-sm ${selectedApt.status === st ? 'sp-btn-primary' : 'sp-btn-outline'}`}>
                    {statusLabel(st)}
                  </button>
                ))}
                {canReschedule && <button type="button" className="sp-btn sp-btn-sm sp-btn-secondary" onClick={() => { setDetailModalOpen(false); openReschedule(selectedApt); }}>Reschedule…</button>}
              </div>
            </div>
          )}

          {history.length > 0 && (
            <div>
              <span className="sp-detail-label">History</span>
              <ul style={{ margin: '6px 0 0 18px', fontSize: '13px', lineHeight: 1.6 }}>
                {history.map(h => (
                  <li key={h.id}>{formatDateTimeIST(h.createdAt)} — {h.previous_status ? `${statusLabel(h.previous_status)} → ` : ''}{statusLabel(h.new_status)}{h.notes ? ` · ${h.notes}` : ''}</li>
                ))}
              </ul>
            </div>
          )}
        </Modal>
      )}

      {rescheduleModalOpen && selectedApt && (
        <Modal isOpen={rescheduleModalOpen} onClose={() => setRescheduleModalOpen(false)} title={`Reschedule ${selectedApt.reference_no}`}>
          <form onSubmit={handleRescheduleSubmit}>
            <div className="sp-form-group">
              <label className="sp-form-label">New date</label>
              <input type="date" className="sp-input" min={todayIST()} value={rescheduleData.newDate} onChange={(e) => setRescheduleData({ ...rescheduleData, newDate: e.target.value })} required />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="sp-form-group">
                <label className="sp-form-label">New start time (IST)</label>
                <input type="time" step="1800" className="sp-input" value={rescheduleData.newStartTime} onChange={(e) => setRescheduleData({ ...rescheduleData, newStartTime: e.target.value })} required />
              </div>
              <div className="sp-form-group">
                <label className="sp-form-label">Duration</label>
                <select className="sp-select" value={rescheduleData.duration} onChange={(e) => setRescheduleData({ ...rescheduleData, duration: parseInt(e.target.value, 10) })}>
                  <option value={30}>30 minutes</option>
                  <option value={60}>1 hour</option>
                </select>
              </div>
            </div>
            <div className="sp-form-group">
              <label className="sp-form-label">Reason</label>
              <textarea className="sp-textarea" rows="2" value={rescheduleData.reason} onChange={(e) => setRescheduleData({ ...rescheduleData, reason: e.target.value })} />
            </div>
            <p style={{ fontSize: '12.5px', color: '#777' }}>The practitioner's other bookings are checked; a clash is refused.</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
              <button type="button" onClick={() => setRescheduleModalOpen(false)} className="sp-btn sp-btn-outline">Cancel</button>
              <button type="submit" className="sp-btn sp-btn-primary">Confirm Reschedule</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
