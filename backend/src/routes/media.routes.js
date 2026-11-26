const express = require('express');
const router = express.Router();
const fs = require('fs');
const { Op } = require('sequelize');
const { MediaAsset, ClinicalApplication, CareerApplication } = require('../models');
const uploadService = require('../services/upload.service');
const { authenticate } = require('../middlewares/auth.middleware');
const { hasPermission } = require('../middlewares/rbac.middleware');

/**
 * Which permission is needed to open a private file depends on the record that owns it:
 *   clinical application documents → clinical_apps:download_docs
 *   career resumes                 → careers:download
 *   anything else                  → media:view
 */
async function requiredPermissionFor(assetId) {
  const id = parseInt(assetId, 10);
  const clinical = await ClinicalApplication.findOne({
    where: {
      [Op.or]: [
        { photo_asset_id: id },
        { primary_cert_asset_id: id },
        { pg_cert_asset_id: id },
        { council_cert_asset_id: id },
        { signature_asset_id: id }
      ]
    },
    attributes: ['id']
  });
  if (clinical) return 'clinical_apps:download_docs';

  // Additional qualification certificates are referenced inside a JSON column
  const withAdditional = await ClinicalApplication.findAll({
    where: { additional_qualifications: { [Op.ne]: null } },
    attributes: ['id', 'additional_qualifications']
  });
  const ownsAdditional = withAdditional.some(a => {
    let list = a.additional_qualifications;
    if (typeof list === 'string') { try { list = JSON.parse(list); } catch (e) { list = []; } }
    return Array.isArray(list) && list.some(q => q && Number(q.cert_asset_id) === id);
  });
  if (ownsAdditional) return 'clinical_apps:download_docs';

  const career = await CareerApplication.findOne({ where: { resume_asset_id: id }, attributes: ['id'] });
  if (career) return 'careers:download';

  if (await require('../services/verification.service').ownsAsset(id)) return 'verifications:view';

  return 'media:view';
}

// Protected download for private media
router.get('/private/:id', authenticate, async (req, res) => {
  try {
    const roleSlug = req.user.role?.slug || '';
    if (roleSlug === 'customer') {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }

    const asset = await MediaAsset.findByPk(req.params.id);
    if (!asset) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }

    const needed = await requiredPermissionFor(asset.id);
    if (!hasPermission(req.user, needed)) {
      return res.status(403).json({ success: false, message: `Forbidden. Missing required permission: ${needed}` });
    }

    const filePath = uploadService.getAbsolutePath(asset);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Physical file not found on server' });
    }

    const safeName = asset.original_name.replace(/[^a-zA-Z0-9._-]/g, '_');
    res.setHeader('Content-Type', asset.mime_type || 'application/octet-stream');
    res.setHeader('Content-Length', asset.file_size);
    res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');

    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not open the file.' });
  }
});

module.exports = router;
