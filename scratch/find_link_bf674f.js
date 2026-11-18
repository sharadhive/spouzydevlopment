const fs = require('fs');

const files = fs.readdirSync('.').filter(f => f.endsWith('.htm') || f.endsWith('.html'));

const occurrences = [];

for (const f of files) {
  const c = fs.readFileSync(f, 'utf8');
  const matches = [...c.matchAll(/<a[^>]*style="[^"]*#bf674f[^"]*"[^>]*>/gi)];
  if (matches.length > 0) {
    occurrences.push({ file: f, count: matches.length, samples: matches.map(m => m[0].substring(0, 100)) });
  }
}

console.log('Files with inline #bf674f on <a>:', occurrences.length);
console.log(JSON.stringify(occurrences, null, 2));
