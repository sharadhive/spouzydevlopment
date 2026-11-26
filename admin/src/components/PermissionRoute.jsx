import React from 'react';
import { useAuth } from '../context/AuthContext';
import AccessDenied from './AccessDenied';

export default function PermissionRoute({ required, moduleName, children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: '#666' }}>
        <i className="fa fa-spinner fa-spin fa-2x"></i>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const allowed = Array.isArray(required)
    ? required.some(p => user.can && user.can(p))
    : (user.can && user.can(required));

  if (!allowed) {
    return <AccessDenied moduleName={moduleName || 'this module'} returnTo={user.landingRoute} />;
  }

  return children;
}
