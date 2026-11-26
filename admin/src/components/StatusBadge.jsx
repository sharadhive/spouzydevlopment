import React from 'react';
import { statusLabel } from '../constants/statuses';

export default function StatusBadge({ status }) {
  if (!status || typeof status !== 'string') return null;
  const normalized = status.toLowerCase().trim().replace(/\s+/g, '_');
  return (
    <span className={`sp-badge ${normalized}`}>
      {statusLabel(normalized)}
    </span>
  );
}
