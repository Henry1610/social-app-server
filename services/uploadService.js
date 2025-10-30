import cloudinary from '../config/cloudinary.js'

export const uploadBufferToCloudinary = (buffer, filename, mimetype, folder) => {
  return new Promise((resolve, reject) => {
    const uploadOptions = { folder, resource_type: 'auto', filename_override: filename, use_filename: true, unique_filename: true }
    const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
      if (error) return reject(error)
      resolve(result)
    })
    stream.end(buffer)
  })
}


