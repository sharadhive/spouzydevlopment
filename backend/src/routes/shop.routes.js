/** Public package list for the website (packages.htm). */
const express = require('express');
const router = express.Router();
const shopService = require('../services/shop.service');

router.get('/', async (req, res, next) => {
  try {
    const data = await shopService.listPublicPackages({ service: req.query.service ? String(req.query.service) : undefined });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
