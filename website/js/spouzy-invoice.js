/**
 * SPOUZY bill page (invoice.htm).
 *  - Customers: invoice.htm?id=12 shows a bill the SPOUZY team has sent them (GET /api/customer/invoices/12).
 *  - Staff: invoice.htm?id=12&staff=1 shows any bill from the admin session (GET /api/admin/invoices/12),
 *    including bills not sent yet (marked "Preview").
 * "Print / Save as PDF" uses the browser's print window; the page is laid out for A4.
 */
(function () {
  'use strict';

  const API = '/api';
  const LOGO = 'image/spouzy-logo-bill.webp';
  const params = new URLSearchParams(window.location.search);
  const id = parseInt(params.get('id'), 10) || 0;
  const staff = params.get('staff') === '1';
  const stage = document.getElementById('spInvoice');
  const printBtn = document.getElementById('spInvPrint');
  const back = document.getElementById('spInvBack');

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function lines(v) {
    return esc(v).replace(/\n/g, '<br>');
  }
  function inr(n) {
    const v = Number(n || 0);
    return '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });
  }
  function dateText(v, withTime) {
    if (!v) return '';
    const d = new Date(v);
    if (isNaN(d.getTime())) return '';
    const opts = { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' };
    if (withTime) { opts.hour = 'numeric'; opts.minute = '2-digit'; }
    return d.toLocaleString('en-IN', opts);
  }
  function message(title, text, link) {
    stage.innerHTML = '<div class="sp-inv-message"><img src="' + LOGO + '" alt="SPOUZY" class="sp-inv-message-logo"><h1>' + esc(title) + '</h1><p>' + text + '</p>' + (link || '') + '</div>';
  }

  if (staff && back) {
    back.href = '/admin/#/shop?tab=bills';
    back.textContent = '← Back to Bills (admin)';
  }

  function render(b) {
    const seller = b.seller || null;
    const c = b.customer || {};
    const isTax = !!(seller && seller.gstin && b.tax);
    const title = isTax ? 'Tax Invoice' : 'Bill';
    document.title = 'SPOUZY ' + title + ' ' + String(b.invoice_no).replace(/\//g, '-');
    const preview = b.status !== 'sent';

    const itemsRows = (b.items || []).map((it, i) =>
      '<tr>' +
        '<td class="sp-inv-num">' + (i + 1) + '</td>' +
        '<td><strong>' + esc(it.description) + '</strong>' + (it.detail ? '<small>' + esc(it.detail) + '</small>' : '') +
          (it.discount_inr > 0 ? '<small class="sp-inv-saving">Normal price ' + inr(it.list_inr) + (it.quantity > 1 ? ' each' : '') + ' · you saved ' + inr(it.discount_inr) + '</small>' : '') + '</td>' +
        (seller && seller.sac_code ? '<td class="sp-inv-c">' + esc(seller.sac_code) + '</td>' : '') +
        '<td class="sp-inv-c">' + esc(it.quantity) + '</td>' +
        '<td class="sp-inv-r">' + inr(it.unit_inr) + '</td>' +
        '<td class="sp-inv-r"><strong>' + inr(it.total_inr) + '</strong></td>' +
      '</tr>').join('');

    const totals = [];
    if (b.discount_inr > 0) {
      totals.push(['Normal price', inr(b.subtotal_inr)]);
      totals.push(['Offer saving', '− ' + inr(b.discount_inr), 'is-saving']);
    }
    if (b.tax) {
      totals.push(['Taxable value', inr(b.tax.taxable_inr)]);
      b.tax.lines.forEach(l => totals.push([l.label, inr(l.inr)]));
    }
    const p = b.payment || {};

    stage.innerHTML =
      (preview ? '<div class="sp-inv-preview" data-no-print>Preview: this bill has not been sent to the customer yet. Send it from Admin → Bills.</div>' : '') +
      '<article class="sp-inv" aria-label="' + esc(title + ' ' + b.invoice_no) + '">' +
        '<div class="sp-inv-watermark" aria-hidden="true"></div>' +
        '<header class="sp-inv-head">' +
          '<div class="sp-inv-brand">' +
            '<img src="' + LOGO + '" alt="SPOUZY" class="sp-inv-logo">' +
            '<p>Pre- &amp; Post-Marriage <span>·</span> Intimate Healthcare <span>·</span> Divorce Mediation</p>' +
          '</div>' +
          '<div class="sp-inv-title">' +
            '<h1>' + esc(title) + '</h1>' +
            '<dl>' +
              '<div><dt>Bill no.</dt><dd>' + esc(b.invoice_no) + '</dd></div>' +
              '<div><dt>Date</dt><dd>' + esc(dateText(b.issued_at)) + '</dd></div>' +
              (p.reference ? '<div><dt>' + esc(p.reference_label || 'Reference') + '</dt><dd>' + esc(p.reference) + '</dd></div>' : '') +
            '</dl>' +
          '</div>' +
        '</header>' +

        '<section class="sp-inv-parties">' +
          '<div class="sp-inv-party">' +
            '<h2>Bill from</h2>' +
            (seller
              ? '<strong>' + esc(seller.business_name) + '</strong>' +
                '<p>' + lines(seller.address) + '</p>' +
                (seller.gstin ? '<p><b>GSTIN:</b> ' + esc(seller.gstin) + '</p>' : '') +
                ((seller.phone || seller.email) ? '<p>' + [seller.phone, seller.email].filter(Boolean).map(esc).join(' · ') + '</p>' : '') +
                (seller.website ? '<p>' + esc(seller.website) + '</p>' : '')
              : '<p class="sp-inv-missing">Business details will be added by the SPOUZY team.</p>') +
          '</div>' +
          '<div class="sp-inv-party">' +
            '<h2>Bill to</h2>' +
            '<strong>' + esc(c.company || c.name) + '</strong>' +
            (c.company && c.name ? '<p>' + esc(c.name) + '</p>' : '') +
            (c.address ? '<p>' + lines(c.address) + '</p>' : '') +
            (c.gstin ? '<p><b>GSTIN:</b> ' + esc(c.gstin) + '</p>' : '') +
            ((c.phone || c.email) ? '<p>' + [c.phone, c.email].filter(Boolean).map(esc).join(' · ') + '</p>' : '') +
          '</div>' +
          '<div class="sp-inv-stamp" aria-label="Paid"><span>PAID</span><small>' + esc(dateText(p.paid_at || b.issued_at)) + '</small></div>' +
        '</section>' +

        '<table class="sp-inv-table">' +
          '<thead><tr><th class="sp-inv-num">#</th><th>Description</th>' + (seller && seller.sac_code ? '<th class="sp-inv-c">SAC</th>' : '') +
            '<th class="sp-inv-c">Qty</th><th class="sp-inv-r">Rate</th><th class="sp-inv-r">Amount</th></tr></thead>' +
          '<tbody>' + itemsRows + '</tbody>' +
        '</table>' +

        '<section class="sp-inv-bottom">' +
          '<div class="sp-inv-pay">' +
            '<h2>Payment</h2>' +
            '<p><b>' + esc(p.method || 'Paid') + '</b></p>' +
            (p.gateway_payment_id ? '<p>Payment ID: ' + esc(p.gateway_payment_id) + '</p>' : '') +
            (p.paid_at ? '<p>Paid on ' + esc(dateText(p.paid_at, true)) + '</p>' : '') +
            '<p class="sp-inv-words"><b>Amount in words:</b> ' + esc(b.amount_in_words) + '</p>' +
            (b.tax ? '<p class="sp-inv-taxnote">Prices include GST @ ' + esc(b.tax.rate) + '%.</p>' : '') +
            (b.notes ? '<p class="sp-inv-notes">' + lines(b.notes) + '</p>' : '') +
          '</div>' +
          '<div class="sp-inv-totals">' +
            totals.map(t => '<div class="sp-inv-trow ' + (t[2] || '') + '"><span>' + esc(t[0]) + '</span><span>' + esc(t[1]) + '</span></div>').join('') +
            '<div class="sp-inv-grand"><span>Total paid</span><strong>' + inr(b.total_inr) + '</strong></div>' +
          '</div>' +
        '</section>' +

        '<footer class="sp-inv-foot">' +
          '<p class="sp-inv-thanks">' + esc((seller && seller.footer_note) || 'Thank you for trusting SPOUZY with your care.') + '</p>' +
          '<p>This is a computer-generated bill and does not need a signature. Your sessions and records stay strictly confidential.</p>' +
        '</footer>' +
      '</article>';

    const logo = stage.querySelector('.sp-inv-logo');
    if (logo) logo.addEventListener('error', () => { logo.replaceWith(Object.assign(document.createElement('span'), { className: 'sp-inv-logo-text', textContent: 'SPOUZY' })); });
    if (printBtn) printBtn.hidden = false;
  }

  async function load() {
    if (!id) {
      message('Bill not found', 'This link is not complete. Open your bills from <a href="account.htm#bills">My Account</a>.');
      return;
    }
    const url = staff ? API + '/admin/invoices/' + id : API + '/customer/invoices/' + id;
    let res;
    try {
      res = await fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
    } catch (e) {
      message('No connection', 'Your bill could not be loaded. Please check your internet connection and try again.');
      return;
    }
    if (res.status === 401) {
      if (staff) { message('Please sign in', 'Sign in to the admin panel, then open the bill again.', '<a class="sp-inv-btn" href="/admin/">Open the admin panel</a>'); return; }
      window.location.replace('register.htm?next=' + encodeURIComponent('invoice.htm?id=' + id));
      return;
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      message('Bill not found', 'This bill is not available on your account. All your bills are listed in <a href="account.htm#bills">My Account → My bills</a>.');
      return;
    }
    render(staff ? json.data.invoice : json.data);
  }

  if (printBtn) printBtn.addEventListener('click', () => window.print());
  load();
})();
