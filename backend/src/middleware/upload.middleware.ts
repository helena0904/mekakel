import multer from 'multer'
import path from 'path'
import crypto from 'crypto'
import fs from 'fs'
import type { RequestHandler } from 'express'

export const REPORT_DIR = path.join(
  process.cwd(),
  'private-uploads',
  'medical-reports'
)

fs.mkdirSync(REPORT_DIR, { recursive: true })

const extensions: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, REPORT_DIR),
    filename: (_req, file, cb) =>
      cb(null, `${crypto.randomUUID()}${extensions[file.mimetype]}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (extensions[file.mimetype]) return cb(null, true)
    cb(new Error('Only JPG, PNG, WEBP or PDF files are allowed.'))
  },
})

export const handleMedicalReportUpload: RequestHandler = (
  req,
  res,
  next
) => {
  upload.single('medicalReport')(req, res, (error) => {
    if (!error) return next()

    if (
      error instanceof multer.MulterError &&
      error.code === 'LIMIT_FILE_SIZE'
    ) {
      return res.status(400).json({
        message: 'Medical report must be 5 MB or smaller.',
      })
    }

    return res.status(400).json({
      message:
        error instanceof Error ? error.message : 'File upload failed.',
    })
  })
}