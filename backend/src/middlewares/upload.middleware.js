const multer = require('multer');

// Memory storage keeps file buffers in memory for inspection & signature verification
const storage = multer.memoryStorage();

// Max single file limit: 10 MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 12, // photo + 3 certificates + up to 5 additional certificates + signature
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed: JPG, PNG, WebP, PDF, DOC, DOCX.`));
    }
  }
});

module.exports = upload;
