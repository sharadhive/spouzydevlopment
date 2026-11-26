const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const config = require('../config/environment');
const models = require('../models');

// Allowed file types and their magic bytes
const FILE_TYPE_SIGNATURES = {
  // JPEG: FF D8 FF
  'image/jpeg': [0xFF, 0xD8, 0xFF],
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  'image/png': [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
  // WebP: 52 49 46 46 (RIFF) ... 57 45 42 50 (WEBP)
  'image/webp': [0x52, 0x49, 0x46, 0x46],
  // PDF: 25 50 44 46 (%PDF)
  'application/pdf': [0x25, 0x50, 0x44, 0x46],
  // DOCX / ZIP: 50 4B 03 04 (PK..)
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [0x50, 0x4B, 0x03, 0x04],
  // DOC (legacy OLE): D0 CF 11 E0
  'application/msword': [0xD0, 0xCF, 0x11, 0xE0]
};

class UploadService {
  /**
   * Verify buffer magic bytes match claimed mime type
   */
  verifyMagicBytes(buffer, mimeType) {
    const signature = FILE_TYPE_SIGNATURES[mimeType];
    if (!signature) return false;

    if (buffer.length < signature.length) return false;
    for (let i = 0; i < signature.length; i++) {
      if (buffer[i] !== signature[i]) {
        return false;
      }
    }
    return true;
  }

  /**
   * Store an uploaded file safely
   */
  async storeFile({ buffer, originalName, mimeType, size, isPrivate = true, userId = null, altText = null }) {
    // 1. Sanitize original filename and check dangerous extensions
    const cleanOriginal = path.basename(originalName).replace(/[^a-zA-Z0-9._-]/g, '_');
    const ext = path.extname(cleanOriginal).toLowerCase();

    const blockedExtensions = ['.exe', '.bat', '.sh', '.php', '.phtml', '.js', '.html', '.htm', '.svg', '.jar', '.vbs', '.cmd'];
    if (blockedExtensions.includes(ext)) {
      throw new Error(`Executable and script files (${ext}) are strictly prohibited.`);
    }

    // 2. Magic byte check
    if (!this.verifyMagicBytes(buffer, mimeType)) {
      // Fallback: If mimeType is doc/docx, check PK or OLE header
      const isPk = buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04;
      const isOle = buffer.length >= 4 && buffer[0] === 0xD0 && buffer[1] === 0xCF && buffer[2] === 0x11 && buffer[3] === 0xE0;
      const isPdf = buffer.length >= 4 && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;

      if ((ext === '.docx' && isPk) || (ext === '.doc' && (isOle || isPk)) || (ext === '.pdf' && isPdf)) {
        // Allowed
      } else {
        throw new Error('File content does not match its claimed extension or MIME type.');
      }
    }

    // 3. Generate random stored filename
    const uuid = uuidv4();
    const storedFilename = `${uuid}${ext}`;
    const targetDir = isPrivate ? config.storage.privateUploads : config.storage.publicUploads;
    
    // Ensure directory exists
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const fullPath = path.join(targetDir, storedFilename);
    const relativePath = path.join(isPrivate ? 'private' : 'public', storedFilename).replace(/\\/g, '/');

    // 4. Write to disk
    fs.writeFileSync(fullPath, buffer);

    // 5. Create database record
    const asset = await models.MediaAsset.create({
      uuid,
      original_name: cleanOriginal,
      stored_filename: storedFilename,
      mime_type: mimeType,
      file_size: size,
      storage_type: isPrivate ? 'private' : 'public',
      relative_path: relativePath,
      alt_text: altText,
      uploaded_by_user_id: userId
    });

    return asset;
  }

  /**
   * Resolve absolute path for an asset
   */
  getAbsolutePath(asset) {
    const baseDir = asset.storage_type === 'private' ? config.storage.privateUploads : config.storage.publicUploads;
    const safePath = path.join(baseDir, asset.stored_filename);

    // Path traversal guard
    if (!safePath.startsWith(baseDir)) {
      throw new Error('Invalid file path.');
    }

    return safePath;
  }

  /**
   * Delete asset from disk and DB
   */
  async deleteAsset(assetId) {
    const asset = await models.MediaAsset.findByPk(assetId);
    if (!asset) return false;

    try {
      const fullPath = this.getAbsolutePath(asset);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    } catch (err) {
      console.warn('Failed to delete physical file:', err.message);
    }

    await asset.destroy();
    return true;
  }
}

module.exports = new UploadService();
