/**
 * KN Express Backend Server
 * Handles TRUE-ID API integration and booking submissions
 * 
 * Run: node backend-server.js
 */

const express = require('express')
const cors = require('cors')
const multer = require('multer')
const axios = require('axios')
const FormData = require('form-data')
const fs = require('fs')
const path = require('path')

const app = express()

// Configuration
const PORT = process.env.PORT || 5000
const TRUE_ID_API_URL = process.env.TRUE_ID_API_URL || 'http://localhost:8000'

// Middleware
app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads'
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir)
    }
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
  }
})

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|bmp/
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
    const mimetype = allowedTypes.test(file.mimetype)
    
    if (mimetype && extname) {
      return cb(null, true)
    } else {
      cb(new Error('Invalid file type. Only image files are allowed.'))
    }
  }
})

// Helper function to clean up uploaded files
function cleanupFiles(files) {
  Object.values(files).forEach(fileArray => {
    if (Array.isArray(fileArray)) {
      fileArray.forEach(file => {
        if (file.path && fs.existsSync(file.path)) {
          fs.unlinkSync(file.path)
        }
      })
    }
  })
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// TRUE-ID validation endpoint
app.post('/api/validate-identity',
  upload.fields([
    { name: 'id_front', maxCount: 1 },
    { name: 'person', maxCount: 1 },
    { name: 'id_back', maxCount: 1 }
  ]),
  async (req, res) => {
    console.log('📝 Received identity validation request')
    
    try {
      // Check if required files are present
      if (!req.files['id_front'] || !req.files['person']) {
        cleanupFiles(req.files)
        return res.status(400).json({
          success: false,
          error: 'Both id_front and person images are required'
        })
      }
      
      const idFront = req.files['id_front'][0]
      const person = req.files['person'][0]
      const idBack = req.files['id_back'] ? req.files['id_back'][0] : null
      
      console.log('📤 Forwarding to TRUE-ID API...')
      
      // Create form data for TRUE-ID API
      const form = new FormData()
      form.append('id_front', fs.createReadStream(idFront.path), {
        filename: 'id_front.jpg',
        contentType: idFront.mimetype
      })
      form.append('person', fs.createReadStream(person.path), {
        filename: 'person.jpg',
        contentType: person.mimetype
      })
      
      if (idBack) {
        form.append('id_back', fs.createReadStream(idBack.path), {
          filename: 'id_back.jpg',
          contentType: idBack.mimetype
        })
      }
      
      // Call TRUE-ID API
      const response = await axios.post(
        `${TRUE_ID_API_URL}/api/validate-complete`,
        form,
        {
          headers: {
            ...form.getHeaders(),
            'Accept': 'application/json'
          },
          timeout: 30000 // 30 second timeout
        }
      )
      
      const result = response.data
      
      console.log(`✅ TRUE-ID Response:`)
      console.log(`   Status: ${result.status}`)
      console.log(`   Confidence: ${result.confidence}%`)
      
      // Clean up uploaded files
      cleanupFiles(req.files)
      
      // Return result
      res.json({
        success: true,
        validation: result,
        verified: result.status === 'Authentic'
      })
      
    } catch (error) {
      console.error('❌ Validation error:', error.message)
      
      // Clean up uploaded files
      if (req.files) {
        cleanupFiles(req.files)
      }
      
      res.status(500).json({
        success: false,
        error: error.response?.data?.detail || error.message
      })
    }
  }
)

// Booking submission endpoint
app.post('/api/bookings', async (req, res) => {
  console.log('📦 Received booking submission')
  
  try {
    const bookingData = req.body
    
    // Validate booking data
    if (!bookingData.sender || !bookingData.receiver || !bookingData.items) {
      return res.status(400).json({
        success: false,
        error: 'Missing required booking information'
      })
    }
    
    // Check verification status
    if (!bookingData.verification?.eidVerified || !bookingData.verification?.faceVerified) {
      return res.status(400).json({
        success: false,
        error: 'Identity verification required before booking submission'
      })
    }
    
    // Generate booking reference
    const referenceNumber = 'KNX' + Date.now().toString(36).toUpperCase()
    
    console.log(`✅ Booking created: ${referenceNumber}`)
    
    // In production, save to database here
    // await saveBookingToDatabase(bookingData, referenceNumber)
    
    // In production, send confirmation email here
    // await sendConfirmationEmail(bookingData.sender.emailAddress, referenceNumber)
    
    res.json({
      success: true,
      referenceNumber: referenceNumber,
      message: 'Booking submitted successfully',
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('❌ Booking submission error:', error.message)
    
    res.status(500).json({
      success: false,
      error: 'Failed to process booking submission'
    })
  }
})

// Check TRUE-ID API availability
app.get('/api/check-trueid', async (req, res) => {
  try {
    const response = await axios.get(`${TRUE_ID_API_URL}/docs`, { timeout: 5000 })
    res.json({
      available: true,
      url: TRUE_ID_API_URL
    })
  } catch (error) {
    res.json({
      available: false,
      url: TRUE_ID_API_URL,
      error: error.message
    })
  }
})

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error)
  res.status(500).json({
    success: false,
    error: error.message || 'Internal server error'
  })
})

// Start server on all network interfaces (0.0.0.0)
app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 KN Express Backend Server')
  console.log(`📍 Server running on: http://localhost:${PORT}`)
  console.log(`📱 Network access: http://192.168.0.169:${PORT}`)
  console.log(`🔐 TRUE-ID API URL: ${TRUE_ID_API_URL}`)
  console.log('\nEndpoints:')
  console.log(`  POST /api/validate-identity - Identity verification`)
  console.log(`  POST /api/bookings - Booking submission`)
  console.log(`  GET  /api/check-trueid - Check TRUE-ID availability`)
  console.log(`  GET  /health - Health check`)
  console.log('\n✅ Server ready and accessible from network!')
})

module.exports = app

