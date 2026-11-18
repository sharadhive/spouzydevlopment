const fs = require('fs');

function checkFile(fileName, role) {
  console.log(`\n=== Validating ${fileName} ===`);
  const content = fs.readFileSync(fileName, 'utf8');

  // Check header wrapper
  const headerWrapper = '<div class="sp-header-sticky-wrapper">';
  const hasHeaderWrapper = content.includes(headerWrapper);
  console.log('Has sp-header-sticky-wrapper:', hasHeaderWrapper);

  // Check closing of header wrapper before main
  const mainIdx = content.indexOf('<main class="sp-reg-page-main"');
  const headerWrapperBeforeMain = content.substring(0, mainIdx);
  const openDivCount = (headerWrapperBeforeMain.match(/<div/g) || []).length;
  const closeDivCount = (headerWrapperBeforeMain.match(/<\/div>/g) || []).length;
  console.log(`Header divs: open=${openDivCount}, close=${closeDivCount}, diff=${openDivCount - closeDivCount}`);

  // Check footer presence
  const hasFooter = content.includes('<footer class="sp-footer-modern">');
  console.log('Has modern footer:', hasFooter);

  // Check body class
  const hasBodyClass = content.includes('class="sp-modern-wrapper spouzy-registration-page"');
  console.log('Has spouzy-registration-page body class:', hasBodyClass);

  // Check required IDs
  const requiredIds = [
    'spJoinAppForm', 'spTitle', 'spFirstName', 'spLastName', 'spGender', 'spDob',
    'spMobile', 'spWhatsapp', 'spSameAsMobile', 'spEmail', 'spPhotoDropzone', 'spPhotoInput', 'spPhotoPreview',
    'spPracticeStatus', 'spExperienceYears', 'spInstitutionName', 'spAffiliations', 'spSpecialisation', 'spObjective',
    'spPrimaryQual', 'spPrimaryYear', 'spPrimaryCollege', 'spPrimaryGrade', 'spPrimaryCertDropzone',
    'spPgQual', 'spPgYear', 'spPgCollege', 'spPgGrade', 'spPgCertDropzone',
    'spAdditionalQualsContainer', 'spAddQualBtn',
    'spCouncilSelect', 'spRegNumber', 'spRegState', 'spRegYear', 'spRegValid',
    'spWorkMode', 'spTimeFrom', 'spTimeTo', 'spTimeRangeError',
    'spDeclarationCheck', 'spDeclDate', 'spSignName', 'spTypedSignature', 'spSigCanvas', 'spClearSigBtn',
    'spFormValidationError', 'spReviewAppBtn',
    'spReviewModal', 'spReviewBackdrop', 'spReviewTitle', 'spReviewCloseBtn', 'spReviewBody', 'spReviewEditBtn', 'spCopyAppTextBtn', 'spReviewWhatsappBtn'
  ];

  if (role === 'counsellor') {
    requiredIds.push('spNaRegCheck');
  }

  let missing = [];
  for (const id of requiredIds) {
    if (!content.includes(`id="${id}"`)) {
      missing.push(id);
    }
  }

  if (missing.length === 0) {
    console.log('All required IDs present! (Total:', requiredIds.length, ')');
  } else {
    console.error('Missing IDs:', missing);
  }
}

checkFile('join-doctor.htm', 'doctor');
checkFile('join-counsellor.htm', 'counsellor');
