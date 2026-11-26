const API_BASE = '/api';

function getCsrfToken() {
  const match = document.cookie.match(/(?:^|;\s*)spouzy_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = { ...options.headers };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const csrf = getCsrfToken();
  if (csrf) {
    headers['X-CSRF-Token'] = csrf;
  }

  const config = {
    ...options,
    headers,
    credentials: 'include'
  };

  const response = await fetch(url, config);

  if (response.status === 401 && !endpoint.includes('/auth/login')) {
    window.location.hash = '#/login';
    const err = new Error('Session expired. Please log in again.');
    err.status = 401;
    throw err;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const err = new Error(data.message || `Request failed with status ${response.status}`);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

export const api = {
  get: (url, options) => request(url, { ...options, method: 'GET' }),
  post: (url, body, options) => request(url, { ...options, method: 'POST', body: body instanceof FormData ? body : JSON.stringify(body) }),
  put: (url, body, options) => request(url, { ...options, method: 'PUT', body: body instanceof FormData ? body : JSON.stringify(body) }),
  patch: (url, body, options) => request(url, { ...options, method: 'PATCH', body: body instanceof FormData ? body : JSON.stringify(body) }),
  delete: (url, options) => request(url, { ...options, method: 'DELETE' }),
};

/** Download a file from the API (for example an Excel file) with the admin's login, keeping the server's file name */
export async function downloadFile(endpoint, fallbackName = 'download') {
  const response = await fetch(`${API_BASE}${endpoint}`, { credentials: 'include' });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const err = new Error(data.message || `Download failed (${response.status})`);
    err.status = response.status;
    throw err;
  }
  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="?([^";]+)"?/i);
  const name = match ? match[1] : fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return name;
}
