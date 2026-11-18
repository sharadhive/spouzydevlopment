const fs = require('fs');

const testFiles = ['index.htm', 'index.html', 'about-us.htm', 'corporate-kamasutra.htm'];

const teddyMarkup = `
            <!-- Col 5: SPOUZY Companion Animation -->
            <div class="sp-footer-teddy" aria-label="SPOUZY companion animation">
                <div class="sp-footer-teddy-stage">
                    <video
                        class="sp-footer-teddy-video"
                        src="image/gif/SPOUZY_Teddy_Dance_Transparent.webm"
                        autoplay
                        muted
                        loop
                        playsinline
                        preload="none"
                        aria-hidden="true">
                        <source src="image/gif/SPOUZY_Teddy_Dance_Transparent.webm" type="video/webm">
                    </video>
                    <img
                        class="sp-footer-teddy-static"
                        src="image/gif/spouzy-teddy-dance-static.png"
                        alt="SPOUZY companion animation fallback"
                        loading="lazy"
                        width="240"
                        height="135">
                    <button
                        type="button"
                        class="sp-footer-teddy-toggle"
                        aria-label="Pause animation"
                        title="Pause animation">
                        <svg class="sp-teddy-icon-pause" viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
                            <rect x="5" y="4" width="4" height="16" rx="1"></rect>
                            <rect x="15" y="4" width="4" height="16" rx="1"></rect>
                        </svg>
                        <svg class="sp-teddy-icon-play" viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true" style="display: none;">
                            <polygon points="6,4 20,12 6,20"></polygon>
                        </svg>
                    </button>
                </div>
            </div>`;

testFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const heading = '<h4 class="sp-footer-col-title">Problem Solver Group</h4>';
  const headingIdx = content.indexOf(heading);
  const ulIdx = content.indexOf('</ul>', headingIdx);
  const divAfterUl = content.indexOf('</div>', ulIdx);
  const insertPos = divAfterUl + 6; // right after </div>
  
  const preview = content.slice(divAfterUl - 20, insertPos) + teddyMarkup + content.slice(insertPos, insertPos + 40);
  console.log(`=== Preview for ${file} ===`);
  console.log(preview.slice(0, 300) + '\n... [truncated] ...\n' + preview.slice(-100));
});
