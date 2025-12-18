import multer from 'multer'

const storage = multer.memoryStorage()

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) cb(null, true)
  else cb(new Error('INVALID_FILE_TYPE'))
}

// File filter cho chat - chấp nhận tất cả file types
const chatFileFilter = (req, file, cb) => {
  cb(null, true) // Chấp nhận tất cả file types
}

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  }
})

// Upload middleware cho chat - chấp nhận tất cả file types
export const uploadChat = multer({
  storage,
  fileFilter: chatFileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  }
})


