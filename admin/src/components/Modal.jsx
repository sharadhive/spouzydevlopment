import React from 'react';

export default function Modal({ isOpen, onClose, title, children, footer, maxWidth = '640px' }) {
  if (!isOpen) return null;

  return (
    <div className="sp-modal-overlay" onClick={onClose}>
      <div 
        className="sp-modal" 
        style={{ maxWidth }} 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sp-modal-header">
          <h3 className="sp-modal-title">{title}</h3>
          <button 
            type="button" 
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#666' }}
          >
            &times;
          </button>
        </div>
        <div className="sp-modal-body">
          {children}
        </div>
        {footer && (
          <div className="sp-modal-footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
