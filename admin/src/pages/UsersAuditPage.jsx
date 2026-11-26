import React, { useEffect, useState, useRef } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import { formatDateTimeIST } from '../constants/statuses';
import HelpBox from '../components/HelpBox';

const EMPTY_USER = { name: '', email: '', phone: '', password: '', role_id: '' };

function fullName(u) {
  return u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email;
}

function permissionGroups(all) {
  const groups = {};
  all.forEach(p => {
    const [mod] = p.split(':');
    (groups[mod] = groups[mod] || []).push(p);
  });
  return groups;
}

export default function UsersAuditPage() {
  const { user: me } = useAuth();
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [allPermissions, setAllPermissions] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [pageError, setPageError] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [newUser, setNewUser] = useState(EMPTY_USER);
  const [editUser, setEditUser] = useState(null);
  const [editRole, setEditRole] = useState(null);

  const abortControllerRef = useRef(null);
  const staffRoles = roles.filter(r => r.slug !== 'customer');

  useEffect(() => {
    loadRoles();
  }, []);

  useEffect(() => {
    loadData();
    return () => { if (abortControllerRef.current) abortControllerRef.current.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  function showMessage(msg, isErr = false) {
    if (isErr) {
      setPageError(msg);
      setTimeout(() => setPageError(''), 6000);
    } else {
      setFeedback(msg);
      setTimeout(() => setFeedback(''), 4000);
    }
  }

  async function loadRoles() {
    try {
      const [r, p] = await Promise.all([api.get('/admin/roles'), api.get('/admin/permissions')]);
      if (r.success) setRoles(r.data || []);
      if (p.success) setAllPermissions(p.data || []);
    } catch (e) {
      // Roles are needed for the forms only; the page still lists users.
    }
  }

  async function loadData() {
    if (tab === 'roles') return;
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    setLoading(true);
    setPageError('');
    try {
      if (tab === 'users') {
        const res = await api.get('/admin/users', { signal: abortControllerRef.current.signal });
        if (res.success) setUsers(res.data || []);
      } else {
        const res = await api.get('/admin/audit-logs?limit=100', { signal: abortControllerRef.current.signal });
        if (res.success) setLogs(res.data.logs || []);
      }
    } catch (e) {
      if (e.name !== 'AbortError') setPageError(e.message || 'Failed to load staff/audit records');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateUser(e) {
    e.preventDefault();
    try {
      await api.post('/admin/users', newUser);
      showMessage('Staff user created. They will be asked to change the temporary password after signing in.');
      setCreateOpen(false);
      setNewUser(EMPTY_USER);
      loadData();
    } catch (err) {
      showMessage(err.message, true);
    }
  }

  async function handleEditUser(e) {
    e.preventDefault();
    try {
      const body = { name: editUser.name, phone: editUser.phone || '', role_id: editUser.role_id, is_active: editUser.is_active };
      if (editUser.password) body.password = editUser.password;
      await api.put(`/admin/users/${editUser.id}`, body);
      showMessage('Staff account updated');
      setEditUser(null);
      loadData();
    } catch (err) {
      showMessage(err.message, true);
    }
  }

  async function handleSaveRole(e) {
    e.preventDefault();
    try {
      await api.put(`/admin/roles/${editRole.id}`, { permissions: editRole.permissions });
      showMessage(`Permissions saved for ${editRole.name}. Staff see the change on their next page load.`);
      setEditRole(null);
      loadRoles();
    } catch (err) {
      showMessage(err.message, true);
    }
  }

  function togglePerm(p) {
    const has = editRole.permissions.includes(p);
    setEditRole({ ...editRole, permissions: has ? editRole.permissions.filter(x => x !== p) : [...editRole.permissions, p] });
  }

  return (
    <div>
      <div className="sp-card">
        <div className="sp-card-header">
          <h2 className="sp-card-title"><i className="fa fa-users" style={{ marginRight: '8px' }}></i> Staff Accounts &amp; Audit Logs</h2>
          {tab === 'users' && (
            <button type="button" onClick={() => { setNewUser({ ...EMPTY_USER, role_id: staffRoles.find(r => r.slug === 'operations_staff')?.id || '' }); setCreateOpen(true); }} className="sp-btn sp-btn-primary">
              <i className="fa fa-user-plus"></i> Create Staff User
            </button>
          )}
        </div>

        {feedback && <div className="sp-inline-alert success"><i className="fa fa-check-circle"></i> {feedback}</div>}
        {pageError && (
          <div className="sp-inline-alert error">
            <i className="fa fa-exclamation-circle"></i> {pageError}
            <button onClick={loadData} className="sp-btn sp-btn-secondary sp-btn-sm" style={{ marginLeft: '12px' }}>Retry</button>
          </div>
        )}

        <div className="sp-tabs">
          <button type="button" className={`sp-tab-btn ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}><i className="fa fa-users"></i> Staff Accounts ({users.length})</button>
          <button type="button" className={`sp-tab-btn ${tab === 'roles' ? 'active' : ''}`} onClick={() => setTab('roles')}><i className="fa fa-shield"></i> Roles &amp; Permissions</button>
          <button type="button" className={`sp-tab-btn ${tab === 'audit' ? 'active' : ''}`} onClick={() => setTab('audit')}><i className="fa fa-history"></i> Audit Trail</button>
        </div>
        <HelpBox key={`help-${tab}`} topic={tab === 'users' ? 'users' : `users.${tab}`} />

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}><i className="fa fa-spinner fa-spin fa-2x"></i></div>
        ) : tab === 'users' ? (
          <div className="sp-table-wrapper">
            <table className="sp-table">
              <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last login (IST)</th><th></th></tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td><strong>{fullName(u)}</strong>{u.id === me?.id && <small style={{ color: '#888' }}> (you)</small>}</td>
                    <td>{u.email}</td>
                    <td><span className="sp-badge new">{u.role?.name || u.role?.slug || 'Staff'}</span></td>
                    <td><span className={`sp-badge ${u.is_active ? 'approved' : 'rejected'}`}>{u.is_active ? 'Active' : 'Disabled'}</span></td>
                    <td>{u.last_login_at ? formatDateTimeIST(u.last_login_at) : 'Never'}</td>
                    <td>
                      {u.role?.slug !== 'customer' && (
                        <button className="sp-btn sp-btn-outline sp-btn-sm" onClick={() => setEditUser({ id: u.id, name: fullName(u), email: u.email, phone: u.phone || '', role_id: u.role?.id || '', is_active: !!u.is_active, password: '' })}>Edit</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : tab === 'roles' ? (
          <div className="sp-table-wrapper">
            <table className="sp-table">
              <thead><tr><th>Role</th><th>Can do</th><th></th></tr></thead>
              <tbody>
                {staffRoles.map(r => (
                  <tr key={r.id}>
                    <td><strong>{r.name}</strong><div><small style={{ color: '#888' }}>{r.description}</small></div></td>
                    <td style={{ maxWidth: '520px' }}>
                      <small>{(r.permissions || []).includes('all') ? 'Everything (administrator)' : (r.permissions || []).join(', ')}</small>
                    </td>
                    <td>{r.slug !== 'admin' && <button className="sp-btn sp-btn-outline sp-btn-sm" onClick={() => setEditRole({ ...r, permissions: [...(r.permissions || [])] })}>Edit</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="sp-table-wrapper">
            <table className="sp-table">
              <thead><tr><th>When (IST)</th><th>Action</th><th>Record</th><th>By</th><th>IP</th></tr></thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr><td colSpan="5" style={{ textAlign: 'center', padding: '24px', color: '#999' }}>No audit entries yet.</td></tr>
                ) : logs.map((l) => (
                  <tr key={l.id}>
                    <td>{formatDateTimeIST(l.createdAt)}</td>
                    <td><strong>{l.action}</strong></td>
                    <td>{l.entity_type} {l.entity_id ? `(#${l.entity_id})` : ''}</td>
                    <td>{l.user ? l.user.email : (l.user_id ? `User #${l.user_id}` : 'System')}</td>
                    <td><code>{l.ip_address || '—'}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {createOpen && (
        <Modal isOpen onClose={() => setCreateOpen(false)} title="Create Staff User">
          <form onSubmit={handleCreateUser}>
            <div className="sp-form-group">
              <label className="sp-form-label">Full name</label>
              <input type="text" className="sp-input" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} required />
            </div>
            <div className="sp-form-group">
              <label className="sp-form-label">Email</label>
              <input type="email" className="sp-input" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} required />
            </div>
            <div className="sp-form-group">
              <label className="sp-form-label">Phone</label>
              <input type="text" className="sp-input" value={newUser.phone} onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })} />
            </div>
            <div className="sp-form-group">
              <label className="sp-form-label">Temporary password (min 8 characters)</label>
              <input type="text" className="sp-input" minLength={8} value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} required />
            </div>
            <div className="sp-form-group">
              <label className="sp-form-label">Role</label>
              <select className="sp-select" value={newUser.role_id} onChange={(e) => setNewUser({ ...newUser, role_id: e.target.value })} required>
                <option value="">Choose a role…</option>
                {staffRoles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <button type="button" onClick={() => setCreateOpen(false)} className="sp-btn sp-btn-outline">Cancel</button>
              <button type="submit" className="sp-btn sp-btn-primary">Create User</button>
            </div>
          </form>
        </Modal>
      )}

      {editUser && (
        <Modal isOpen onClose={() => setEditUser(null)} title={`Edit ${editUser.email}`}>
          <form onSubmit={handleEditUser}>
            <div className="sp-form-group">
              <label className="sp-form-label">Full name</label>
              <input type="text" className="sp-input" value={editUser.name} onChange={(e) => setEditUser({ ...editUser, name: e.target.value })} required />
            </div>
            <div className="sp-form-group">
              <label className="sp-form-label">Phone</label>
              <input type="text" className="sp-input" value={editUser.phone} onChange={(e) => setEditUser({ ...editUser, phone: e.target.value })} />
            </div>
            <div className="sp-form-group">
              <label className="sp-form-label">Role</label>
              <select className="sp-select" value={editUser.role_id} onChange={(e) => setEditUser({ ...editUser, role_id: e.target.value })} disabled={editUser.id === me?.id}>
                {staffRoles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div className="sp-form-group">
              <label className="sp-form-label">Reset password (leave empty to keep)</label>
              <input type="text" className="sp-input" minLength={8} value={editUser.password} onChange={(e) => setEditUser({ ...editUser, password: e.target.value })} />
              <small style={{ color: '#777' }}>Resetting signs the user out everywhere and asks them to choose a new password.</small>
            </div>
            <label style={{ fontSize: '13px' }}>
              <input type="checkbox" checked={editUser.is_active} disabled={editUser.id === me?.id} onChange={(e) => setEditUser({ ...editUser, is_active: e.target.checked })} /> Account active
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <button type="button" onClick={() => setEditUser(null)} className="sp-btn sp-btn-outline">Cancel</button>
              <button type="submit" className="sp-btn sp-btn-primary">Save</button>
            </div>
          </form>
        </Modal>
      )}

      {editRole && (
        <Modal isOpen onClose={() => setEditRole(null)} title={`Permissions — ${editRole.name}`} maxWidth="720px">
          <form onSubmit={handleSaveRole}>
            {Object.entries(permissionGroups(allPermissions)).map(([mod, perms]) => (
              <div key={mod} style={{ marginBottom: '10px' }}>
                <span className="sp-detail-label">{mod.replace(/_/g, ' ')}</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                  {perms.map(p => (
                    <label key={p} style={{ fontSize: '13px' }}>
                      <input type="checkbox" checked={editRole.permissions.includes(p)} onChange={() => togglePerm(p)} /> {p.split(':')[1].replace(/_/g, ' ')}
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <button type="button" onClick={() => setEditRole(null)} className="sp-btn sp-btn-outline">Cancel</button>
              <button type="submit" className="sp-btn sp-btn-primary">Save permissions</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
