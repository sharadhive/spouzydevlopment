const fs = require('fs');

function testReplacements(fileName) {
  let content = fs.readFileSync(fileName, 'utf8');

  const reOpt = /(<a class="sp-dropdown-item"[^>]*href=["']gen-z-kama-sutra\.htm["'][^>]*>Gen Z Kama Sutra<\/a>)/;
  const reFig = /(<figure class="nav-visual"[^>]*><img[^>]*gen-z-kama-sutra\.webp[^>]*><figcaption>Gen Z Kama Sutra<\/figcaption><\/figure>)/;
  const reDrawer = /(<a class="sp-drawer-sublink"[^>]*href=["']gen-z-kama-sutra\.htm["'][^>]*>Gen Z Kama Sutra<img class="drawer-option-photo"[^>]*gen-z-kama-sutra\.webp[^>]*><\/a>)/;
  const reSearch = /(<li class="sp-search-result-item"><a href=["']gen-z-kama-sutra\.htm["']>Gen Z Kama Sutra <span>↗<\/span><\/a><\/li>)/;

  console.log(`=== Testing ${fileName} ===`);
  console.log('Opt match:', reOpt.test(content));
  console.log('Fig match:', reFig.test(content));
  console.log('Drawer match:', reDrawer.test(content));
  console.log('Search match:', reSearch.test(content));

  if (!reOpt.test(content) || !reFig.test(content) || !reDrawer.test(content) || !reSearch.test(content)) {
    console.error(`Failed matching in ${fileName}`);
    return false;
  }
  return true;
}

testReplacements('index.htm');
testReplacements('gen-z-kama-sutra.htm');
testReplacements('about-us.htm');
testReplacements('register.htm');
