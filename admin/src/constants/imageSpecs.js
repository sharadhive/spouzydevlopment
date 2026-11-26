/**
 * Recommended image sizes for every image the admin can upload.
 * Measured from how the website actually shows each image (November 2026 layout).
 */
export const IMAGE_SPECS = {
  bannerDesktop: {
    focus: '50% 24%',
    title: 'Hero banner — desktop image',
    width: 1920, height: 1080, minWidth: 1280, minHeight: 720,
    ratio: 16 / 9, ratioText: '16:9 landscape',
    where: 'Homepage slider on laptops and desktops (shown about 1120 × 620 px, cropped to fill).',
    tip: 'Keep faces in the upper half and towards the right: the headline and buttons sit on the left, and the bottom is darkened.'
  },
  bannerMobile: {
    focus: '50% 22%',
    title: 'Hero banner — mobile image',
    width: 1080, height: 1620, minWidth: 720, minHeight: 1080,
    ratio: 2 / 3, ratioText: '2:3 portrait',
    where: 'Homepage slider on phones (shown about 360 × 570 px).',
    tip: 'Optional. Without it, phones show the middle of the desktop image. Keep faces in the top third: text covers the lower part.'
  },
  tipPhoto: {
    focus: '50% 40%',
    title: 'Relationship tip photo',
    width: 800, height: 1200, minWidth: 480, minHeight: 720,
    ratio: 2 / 3, ratioText: '2:3 portrait',
    where: '"Daily Tip For You" card next to the homepage slider (about 230 × 375 px).',
    tip: 'Portrait photos work best; the centre of the photo is kept.'
  },
  blogBanner: {
    focus: '50% 50%',
    title: 'Blog banner',
    width: 1600, height: 900, minWidth: 1280, minHeight: 720,
    ratio: 16 / 9, ratioText: '16:9 landscape',
    where: 'Top of the article page (up to 1100 × 620 px) and the sliding banner on the Blog page (about 520 × 292 px).',
    tip: 'Keep the main subject in the middle. Avoid small text: the title is written over the lower part in the sliding banner.'
  },
  blogThumb: {
    focus: '50% 50%',
    title: 'Blog thumbnail',
    width: 1280, height: 720, minWidth: 800, minHeight: 450,
    ratio: 16 / 9, ratioText: '16:9 landscape',
    where: 'Article card on the Blog list (about 360 × 203 px; full width on phones).',
    tip: 'Optional: without it the card uses the banner. A close, simple picture reads best at this size.'
  },
  blogCover: {
    focus: '50% 50%',
    title: 'Picture inside the article',
    width: 1800, height: 840, minWidth: 1200, minHeight: 560,
    ratio: 15 / 7, ratioText: 'about 2.1:1 wide',
    where: 'Inside the article, under the date (shown up to 900 × 420 px).',
    tip: 'Optional. Wide photo without text in it; the middle band is what shows.'
  },
  staffPhoto: {
    focus: '50% 30%',
    title: 'Practitioner photo',
    width: 800, height: 800, minWidth: 400, minHeight: 400,
    ratio: 1, ratioText: '1:1 square',
    where: 'Practitioner profiles and booking cards.',
    tip: 'Head and shoulders, plain light background, face centred.'
  },
  offerCard: {
    focus: '50% 50%',
    title: 'Offer card image',
    width: 1080, height: 1350, minWidth: 720, minHeight: 720,
    ratio: null, ratioText: '4:5 portrait (1:1 square also fine)',
    where: 'Offer popup on the website: up to 400 px wide on computers, nearly full width on phones. The whole image is shown; nothing is cut off.',
    tip: 'Make the offer words large and keep about 60 px empty at every edge. A square 1080 × 1080 Instagram post works too.'
  },
  library: {
    focus: '50% 50%',
    title: 'Media library image',
    width: 1920, height: 1920, minWidth: 800, minHeight: 400,
    ratio: null, ratioText: 'any shape',
    where: 'Any public image you want to reuse (copy its path into a banner, tip or article).',
    tip: 'Upload the size you need; large photos are reduced to 1920 px on the longest side.'
  }
};

export const SPEC_ORDER = ['bannerDesktop', 'bannerMobile', 'tipPhoto', 'blogBanner', 'blogThumb', 'blogCover', 'staffPhoto', 'offerCard', 'library'];

/** "1920 × 1080 px (16:9 landscape) · at least 1280 × 720" */
export function specLine(spec) {
  if (!spec) return '';
  return `Best ${spec.width} × ${spec.height} px (${spec.ratioText}) · at least ${spec.minWidth} × ${spec.minHeight} px`;
}

/** Warnings for an image of the given size against a spec (empty array = fine) */
export function checkDimensions(spec, width, height) {
  const out = [];
  if (!spec || !width || !height) return out;
  if (width < spec.minWidth || height < spec.minHeight) {
    out.push(`Too small: ${width} × ${height} px. It will look blurry; use at least ${spec.minWidth} × ${spec.minHeight} px.`);
  }
  if (spec.ratio) {
    const r = width / height;
    const off = Math.abs(r - spec.ratio) / spec.ratio;
    if (off > 0.2) {
      const shape = r > 1.05 ? 'a landscape' : r < 0.95 ? 'a portrait' : 'a square';
      const cut = r < spec.ratio ? 'the top and bottom' : 'the left and right sides';
      out.push(`This is ${shape} photo (${r.toFixed(2)}:1) and this spot is ${spec.ratioText}, so ${cut} will be cut off. Check the preview above.`);
    }
  }
  return out;
}
