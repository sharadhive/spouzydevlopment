const express = require('express');
const router = express.Router();
const clinicalService = require('../services/clinical.service');
const uploadService = require('../services/upload.service');
const upload = require('../middlewares/upload.middleware');
const { submissionLimiter } = require('../middlewares/rateLimit.middleware');
const { sendError } = require('../config/validation');

const uploadFields = upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'primary_cert', maxCount: 1 },
  { name: 'pg_cert', maxCount: 1 },
  { name: 'council_cert', maxCount: 1 },
  { name: 'additional_certs', maxCount: 5 },
  { name: 'signature_image', maxCount: 1 }
]);

async function storePrivate(f) {
  const asset = await uploadService.storeFile({
    buffer: f.buffer,
    originalName: f.originalname,
    mimeType: f.mimetype,
    size: f.size,
    isPrivate: true
  });
  return asset.id;
}

router.post('/', submissionLimiter, uploadFields, async (req, res) => {
  const filesIn = req.files || {};
  const first = (name) => (filesIn[name] && filesIn[name][0]) || null;

  try {
    // 1. Validate every field and file BEFORE anything is written to disk
    clinicalService.validateApplication(req.body, {
      photo: first('photo'),
      primary_cert: first('primary_cert'),
      pg_cert: first('pg_cert'),
      council_cert: first('council_cert'),
      additional_certs: filesIn.additional_certs || [],
      signature_image: first('signature_image')
    });

    // 2. Double-submit guard (same email + role within 15 minutes)
    const duplicate = await clinicalService.findRecentDuplicate(req.body);
    if (duplicate) {
      return res.status(200).json({
        success: true,
        duplicate: true,
        message: 'We already received this application. Your reference number is below.',
        data: {
          id: duplicate.id,
          referenceNo: duplicate.reference_no,
          roleType: duplicate.role_type,
          fullName: `${duplicate.first_name} ${duplicate.last_name}`
        }
      });
    }

    // 3. Store files privately
    const files = {};
    if (first('photo')) files.photoAssetId = await storePrivate(first('photo'));
    if (first('primary_cert')) files.primaryCertAssetId = await storePrivate(first('primary_cert'));
    if (first('pg_cert')) files.pgCertAssetId = await storePrivate(first('pg_cert'));
    if (first('council_cert')) files.councilCertAssetId = await storePrivate(first('council_cert'));
    if (first('signature_image')) files.signatureAssetId = await storePrivate(first('signature_image'));
    files.additionalCertAssetIds = [];
    for (const f of (filesIn.additional_certs || [])) {
      files.additionalCertAssetIds.push(await storePrivate(f));
    }

    const result = await clinicalService.submitApplication(req.body, files);

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully.',
      data: result
    });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
