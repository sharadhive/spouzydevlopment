const fs = require('fs');

let h = fs.readFileSync('careers.htm', 'utf8');

// Replace Doctor's aria-current in nav and drawer with Careers
h = h.replace(
  '<a class="sp-dropdown-item" href="join-doctor.htm" aria-current="page" data-preview-active="">Doctor</a>',
  '<a class="sp-dropdown-item" href="join-doctor.htm">Doctor</a>'
);
h = h.replace(
  '<a class="sp-dropdown-item" href="careers.htm">Careers</a>',
  '<a class="sp-dropdown-item" href="careers.htm" aria-current="page" data-preview-active="">Careers</a>'
);

h = h.replace(
  '<a class="sp-drawer-sublink" href="join-doctor.htm" aria-current="page">Doctor',
  '<a class="sp-drawer-sublink" href="join-doctor.htm">Doctor'
);
h = h.replace(
  '<a class="sp-drawer-sublink" href="careers.htm">Careers',
  '<a class="sp-drawer-sublink" href="careers.htm" aria-current="page">Careers'
);

fs.writeFileSync('careers.htm', h, 'utf8');
console.log('Updated active aria-current state on careers.htm');
