const fs = require('fs');

const files = fs.readdirSync('.').filter(f => f.endsWith('.htm') || f.endsWith('.html'));

const NEW_SOCIAL_BLOCK = `            <div class="sp-footer-extra sp-footer-social-col" role="region" aria-label="Social media links">
                <div class="sp-footer-social" role="group" aria-label="Social media links">
                    <a href="https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fspouzy.com%2F"
                       target="_blank" rel="noopener noreferrer"
                       class="sp-footer-social-btn sp-social-fb"
                       aria-label="Share on Facebook">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="#ffffff" aria-hidden="true" focusable="false">
                            <path d="M14 13.5h2.5l1-4H14v-2c0-1.03.6-1.5 1.8-1.5H17.5V2.14C17.06 2.08 16.03 2 14.8 2 12 2 10.5 3.5 10.5 7v2.5H8v4h2.5V22h3.5v-8.5z"/>
                        </svg>
                    </a>
                    <a href="https://x.com/intent/tweet?url=https%3A%2F%2Fspouzy.com%2F&amp;text=SPOUZY"
                       target="_blank" rel="noopener noreferrer"
                       class="sp-footer-social-btn sp-social-x"
                       aria-label="Share on X">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="#ffffff" aria-hidden="true" focusable="false">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                    </a>
                    <a href="https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fspouzy.com%2F"
                       target="_blank" rel="noopener noreferrer"
                       class="sp-footer-social-btn sp-social-li"
                       aria-label="Share on LinkedIn">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="#ffffff" aria-hidden="true" focusable="false">
                            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452z"/>
                        </svg>
                    </a>
                    <!-- Instagram: profile URL pending configuration - update href when official account is verified -->
                    <span class="sp-footer-social-btn sp-social-ig sp-social-placeholder"
                          role="img"
                          aria-label="Visit SPOUZY on Instagram (profile URL pending configuration)">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="#ffffff" aria-hidden="true" focusable="false">
                            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                        </svg>
                    </span>
                </div>
            </div>`;

let updatedCount = 0;
files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  const regex = /<div class="sp-footer-extra sp-footer-social-col"[^>]*>[\s\S]*?<\/div>\s*<\/div>/;
  if (regex.test(content)) {
    content = content.replace(regex, NEW_SOCIAL_BLOCK.trim());
    fs.writeFileSync(f, content, 'utf8');
    updatedCount++;
  } else {
    console.error('Regex failed on', f);
  }
});

console.log(`Updated ${updatedCount} / ${files.length} files with refined accessible labels.`);
