/** Public list of live offers for the website popup and package cards. Empty list = no popup. */
const express = require('express');
const router = express.Router();
const offerService = require('../services/offer.service');

router.get('/', async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-cache');
    res.json({ success: true, data: { offers: await offerService.listPublic() } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
