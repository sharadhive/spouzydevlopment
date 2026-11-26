import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AccessDenied({ moduleName = 'this section', returnTo }) {
  const { user } = useAuth();
  const targetRoute = returnTo || user?.landingRoute || '/';

  return (
    <div style={{ padding: '30px 20px', maxWidth: '600px', margin: '40px auto' }}>
      <div className="sp-card" style={{ textAlign: 'center', padding: '40px 24px', borderTop: '4px solid #8B263E' }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: '#FFF0F3',
          color: '#8B263E',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '28px',
          margin: '0 auto 20px'
        }}>
          <i className="fa fa-lock"></i>
        </div>
        <h2 style={{ fontSize: '22px', fontWeight: 'bold', color: '#4B2030', marginBottom: '8px' }}>
          Access Restricted (403)
        </h2>
        <p style={{ color: '#666', lineHeight: '1.6', marginBottom: '24px' }}>
          Your account (<strong>{user?.roleName || 'Current Role'}</strong>) does not have permission to view or manage {moduleName}.
        </p>
        <div>
          <Link to={targetRoute} className="sp-btn sp-btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa fa-arrow-left"></i> Return to Authorised Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
