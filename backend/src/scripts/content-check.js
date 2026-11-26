/**
 * Content health check for the website and admin.
 *
 *   npm run content:check              report only: images that do not exist, and test data
 *                                      left in the database by old test scripts (changes nothing)
 *   npm run content:clean-test-data    the same report, then removes ONLY those test leftovers
 *
 * Exit code 0 = everything fine, 1 = something to fix (listed in the report).
 */
process.env.SPOUZY_NO_AUTOSTART = '1';
const { sequelize, HeroBanner, Tip, BlogArticle, Practitioner, MediaAsset, Offer } = require('../models');
const { resolveImage } = require('../config/media-paths');

const REMOVE_TEST_DATA = process.argv.includes('--remove-test-data');

// Records created by the old test script tests/test-roles-and-permissions.js when it was run
// against the real database. Matched on BOTH the exact text and the exact (missing) image,
// so real content is never touched.
const TEST_LEFTOVERS = [
  {
    area: 'Hero banner',
    model: HeroBanner,
    match: { image_path: ['/image/banner1.jpg', 'image/banner1.jpg'] },
    test: r => /^Rebuilding Marital Connection/.test(r.headline || ''),
    label: r => `${r.headline}${r.headline_emphasis ? ' ' + r.headline_emphasis : ''}`
  },
  {
    area: 'Relationship tip',
    model: Tip,
    match: { photo_url: ['/image/tips/tip1.jpg', 'image/tips/tip1.jpg'] },
    test: r => /^Active listening requires validating emotions before seeking solutions/.test(r.tip_text || ''),
    label: r => r.tip_text
  }
];

function short(s, n = 60) {
  const v = String(s || '').replace(/\s+/g, ' ').trim();
  return v.length > n ? v.slice(0, n - 1) + '…' : v;
}

function check(rows, area, title, fields, extra = {}) {
  const problems = [];
  rows.forEach(r => {
    fields.forEach(f => {
      const value = r[f];
      if (!value) return;
      const res = resolveImage(value);
      if (res.kind === 'invalid' || (res.kind === 'local' && !res.exists)) {
        problems.push({ area, id: r.id, title: short(title(r)), field: f, value, live: extra.live ? extra.live(r) : null });
      }
    });
  });
  return problems;
}

async function main() {
  sequelize.options.logging = false;
  await sequelize.authenticate();

  // 1. Test leftovers
  const leftovers = [];
  for (const t of TEST_LEFTOVERS) {
    const rows = await t.model.findAll({ where: t.match });
    rows.filter(t.test).forEach(r => leftovers.push({ def: t, row: r }));
  }

  // 2. Images that do not exist
  const leftoverKeys = new Set(leftovers.map(l => l.def.area + ':' + l.row.id));
  let problems = [];
  problems = problems.concat(check(await HeroBanner.findAll(), 'Hero banner', r => `${r.headline} ${r.headline_emphasis || ''}`,
    ['image_path', 'mobile_image_path'], { live: r => !!r.is_active && r.status === 'published' }));
  problems = problems.concat(check(await Tip.findAll(), 'Relationship tip', r => r.tip_text, ['photo_url'], { live: r => !!r.is_active }));
  problems = problems.concat(check(await BlogArticle.findAll(), 'Blog article', r => r.title, ['cover_image', 'banner_image', 'thumbnail_image'], { live: r => !!r.is_published }));
  problems = problems.concat(check(await Practitioner.findAll(), 'Practitioner', r => r.name, ['photo_url'], { live: r => !!r.is_active }));
  const offers = Offer ? await Offer.findAll().catch(() => []) : []; // table exists after migration 7
  problems = problems.concat(check(offers, 'Offer', r => r.title, ['image_path'], { live: r => !!r.is_active }));
  const media = await MediaAsset.findAll({ where: { storage_type: 'public' } });
  media.forEach(m => {
    const res = resolveImage('/media/public/' + m.stored_filename);
    if (!res.exists) problems.push({ area: 'Media library', id: m.id, title: short(m.original_name), field: 'file', value: '/media/public/' + m.stored_filename, live: null });
  });
  const realProblems = problems.filter(p => !leftoverKeys.has(p.area + ':' + p.id));

  console.log('\nSPOUZY content check');
  console.log('====================');
  console.log(`Checked: ${(await HeroBanner.count())} hero banners, ${(await Tip.count())} tips, ${(await BlogArticle.count())} blog articles, ` +
    `${(await Practitioner.count())} practitioners, ${offers.length} offers, ${media.length} media library files.\n`);

  if (!leftovers.length) {
    console.log('Test data left by old test scripts: none.');
  } else {
    console.log(`Test data left by old test scripts: ${leftovers.length} record(s)`);
    leftovers.forEach(l => console.log(`  - ${l.def.area} #${l.row.id}: ${short(l.def.label(l.row))}`));
  }

  if (!realProblems.length) {
    console.log('Missing images in your own content: none.');
  } else {
    console.log(`\nMissing images in your own content: ${realProblems.length}`);
    realProblems.forEach(p => console.log(`  - ${p.area} #${p.id} "${p.title}" (${p.live ? 'LIVE on the website' : 'not live'}): ${p.field} = ${p.value}`));
    console.log('  Fix: open the item in the admin panel and upload or choose a photo.');
  }

  if (leftovers.length && REMOVE_TEST_DATA) {
    for (const l of leftovers) await l.row.destroy();
    console.log(`\nRemoved ${leftovers.length} test record(s). Nothing else was changed.`);
  } else if (leftovers.length) {
    console.log('\nTo remove the test records listed above, run: npm run content:clean-test-data');
  }

  const remaining = (REMOVE_TEST_DATA ? 0 : leftovers.length) + realProblems.length;
  console.log(remaining ? '\nResult: needs attention (see above).' : '\nResult: all content images are OK.');
  await sequelize.close();
  process.exit(remaining ? 1 : 0);
}

main().catch(err => {
  console.error('Content check failed:', err.message);
  process.exit(1);
});
