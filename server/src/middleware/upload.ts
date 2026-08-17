import multer from 'multer';

const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
export const productImages = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 6 },
  fileFilter: (_req, file, callback) => {
    if (allowed.has(file.mimetype)) callback(null, true);
    else callback(new Error('Format image non accepté.'));
  },
}).array('images', 6);

export const categoryImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (allowed.has(file.mimetype)) callback(null, true);
    else callback(new Error('Format image non accepté.'));
  },
}).single('image');
