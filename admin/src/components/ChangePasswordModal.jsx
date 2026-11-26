import React, { useState } from 'react';
import Modal from './Modal';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function ChangePasswordModal({ isOpen, onClose }) {
  const { checkAuth } = useAuth();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  function close() {
    setForm({ currentPassword: '', newPassword: '', confirm: '' });
    setError('');
    setDone(false);
    onClose();
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (form.newPassword !== form.confirm) {
      setError('The two new passwords do not match.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/auth/change-password', { currentPassword: form.currentPassword, newPassword: form.newPassword });
      setDone(true);
      await checkAuth();
    } catch (err) {
      setError(err.message || 'Could not change the password.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen onClose={close} title="Change password" maxWidth="440px">
      {done ? (
        <div>
          <div className="sp-inline-alert success"><i className="fa fa-check-circle"></i> Password changed. Other devices have been signed out.</div>
          <div style={{ textAlign: 'right' }}><button className="sp-btn sp-btn-primary" onClick={close}>Done</button></div>
        </div>
      ) : (
        <form onSubmit={submit}>
          {error && <div className="sp-inline-alert error">{error}</div>}
          <div className="sp-form-group">
            <label className="sp-form-label">Current password</label>
            <input type="password" className="sp-input" autoComplete="current-password" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} required />
          </div>
          <div className="sp-form-group">
            <label className="sp-form-label">New password</label>
            <input type="password" className="sp-input" autoComplete="new-password" minLength={8} value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} required />
            <small style={{ color: '#777' }}>At least 8 characters, with upper-case, lower-case and a number.</small>
          </div>
          <div className="sp-form-group">
            <label className="sp-form-label">Repeat new password</label>
            <input type="password" className="sp-input" autoComplete="new-password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} required />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button type="button" className="sp-btn sp-btn-outline" onClick={close}>Cancel</button>
            <button type="submit" className="sp-btn sp-btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Change password'}</button>
          </div>
        </form>
      )}
    </Modal>
  );
}
