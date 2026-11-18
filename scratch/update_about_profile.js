const fs = require('fs');

let c = fs.readFileSync('about-profile.htm', 'utf8');

// Replace badge icons
c = c.replace(
  '<span class="sp-hero-pill-badge"><i class="fa fa-calendar-check-o" style="color: #2ed573;"></i> Established in 2004</span>',
  '<span class="sp-hero-pill-badge"><i class="fa fa-calendar-check-o" style="color: #1e7e44;"></i> Established in 2004</span>'
);
c = c.replace(
  '<span class="sp-hero-pill-badge"><i class="fa fa-user" style="color: #e08b73;"></i> Founded by Neilesh Jethmal</span>',
  '<span class="sp-hero-pill-badge"><i class="fa fa-user" style="color: #8A402F;"></i> Founded by Neilesh Jethmal</span>'
);
c = c.replace(
  '<span class="sp-hero-pill-badge"><i class="fa fa-balance-scale" style="color: #70a1ff;"></i> 4 Decades Advisory Experience</span>',
  '<span class="sp-hero-pill-badge"><i class="fa fa-balance-scale" style="color: #2655b0;"></i> 4 Decades Advisory Experience</span>'
);

// Replace kickers
c = c.replace(
  '<span class="sp-kicker" style="color: var(--sp-copper); font-size: 13px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase;">',
  '<span class="sp-kicker" style="color: var(--sp-link-copper, #8A402F); font-size: 13px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase;">'
);
c = c.replace(
  '<span class="sp-kicker" style="color: var(--sp-copper); font-size: 12px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase;">THE 3 PILLARS OF RESOLUTION</span>',
  '<span class="sp-kicker" style="color: var(--sp-link-copper, #8A402F); font-size: 12px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase;">THE 3 PILLARS OF RESOLUTION</span>'
);

// Search icon
c = c.replace(
  '<i class="fa fa-search" style="color: #bf674f; font-size: 18px;" aria-hidden="true"></i>',
  '<i class="fa fa-search" style="color: #8A402F; font-size: 18px;" aria-hidden="true"></i>'
);

fs.writeFileSync('about-profile.htm', c, 'utf8');
console.log('Updated about-profile.htm successfully.');
