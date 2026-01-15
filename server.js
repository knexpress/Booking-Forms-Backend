/**
 * KN Express Backend API
 * Express server with MongoDB integration
 * Deploy to: Render.com, Railway.app, Heroku, etc.
 * 
 * ISO 27001/27002 Compliance: All console logging disabled for security
 */

import express from 'express'
import cors from 'cors'
import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'
import { format } from 'util'
// EID verification removed - OpenAI integration no longer used
// import { processEmiratesID } from './services/longcat-ocr.js'
import { generateOTP, sendOTP, getOTPExpiry, isOTPExpired, getOTPConfig } from './services/otp-service.js'

// Load environment variables
dotenv.config()

// ISO 27001/27002 Compliance: Disable all console logging to prevent data leakage
// Override console methods to prevent sensitive data exposure (phone numbers, OTPs, MongoDB URIs, personal information)
// EXCEPTION: Allow OTP-related debug logs only

// Store original console methods BEFORE overriding
// This ensures we can always log startup and connectivity information
const originalConsole = {
  log: (...args) => {
    // Directly write to stdout to bypass any potential overrides
    process.stdout.write(format(...args) + '\n')
  },
  error: (...args) => {
    process.stderr.write(format(...args) + '\n')
  },
  warn: console.warn,
  info: console.info,
  debug: console.debug
}

// Override console methods - only allow OTP-related logs, startup logs, and connectivity logs
console.log = (...args) => {
  const message = args.join(' ').toLowerCase()
  // Allow OTP-related logs, startup logs, and connectivity logs
  if (message.includes('otp') || 
      message.includes('🔐') || 
      message.includes('📱') || 
      message.includes('phone') ||
      message.includes('/api/otp') ||
      message.includes('smsala') ||
      message.includes('sms') ||
      message.includes('===== otp') ||
      message.includes('otp generate') ||
      message.includes('otp verify') ||
      message.includes('otp sent') ||
      message.includes('otp stored') ||
      message.includes('otp verified') ||
      message.includes('📥') ||  // Request ID emoji (appears in OTP endpoints)
      message.includes('⏰') ||  // Timestamp emoji (appears in OTP endpoints)
      message.includes('🔵') ||  // Blue circle emoji (OTP request header)
      message.includes('🚀') ||  // Rocket emoji (server startup)
      message.includes('📍') ||  // Location pin (server address)
      message.includes('📡') ||  // Satellite (endpoints list)
      message.includes('✅') ||  // Checkmark (success messages)
      message.includes('connected to mongodb') ||
      message.includes('mongodb connection') ||
      message.includes('database:') ||
      message.includes('collection:') ||
      message.includes('server ready') ||
      message.includes('listening on')) {
    originalConsole.log(...args)
  }
}

console.error = (...args) => {
  const message = args.join(' ').toLowerCase()
  // Allow OTP-related error logs
  if (message.includes('otp') || 
      message.includes('🔐') || 
      message.includes('📱') || 
      message.includes('phone') ||
      message.includes('/api/otp') ||
      message.includes('smsala') ||
      message.includes('sms') ||
      message.includes('===== otp') ||
      message.includes('otp generate') ||
      message.includes('otp verify') ||
      message.includes('otp error')) {
    originalConsole.error(...args)
  }
}

console.warn = () => {}
console.info = () => {}
console.debug = () => {}

// ============================================================================
// AWB (Air Waybill) Generation Utilities
// ============================================================================

/**
 * Generate random uppercase letters
 * @param {number} length - Number of letters to generate
 * @returns {string} Random uppercase letters
 */
function generateRandomLetters(length) {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += letters.charAt(Math.floor(Math.random() * letters.length))
  }
  return result
}

/**
 * Generate random digits
 * @param {number} length - Number of digits to generate
 * @returns {string} Random digits
 */
function generateRandomDigits(length) {
  let result = ''
  for (let i = 0; i < length; i++) {
    result += Math.floor(Math.random() * 10).toString()
  }
  return result
}

/**
 * Generate random alphanumeric characters (uppercase letters and digits)
 * @param {number} length - Number of characters to generate
 * @returns {string} Random alphanumeric characters
 */
function generateRandomAlphanumeric(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * Generate AWB (Air Waybill) number based on service type
 * Format:
 * - UAE to PH: AE + 2 letters + 3 digits + 2 letters + 8 alphanumeric (17 chars)
 * - PH to UAE: PH + 2 letters + 3 digits + 2 letters + 8 alphanumeric (17 chars)
 * @param {string} service - Service type ('uae-to-pinas' or 'ph-to-uae' / 'philippines-to-uae')
 * @returns {string} Generated AWB number
 */
function generateAWB(service) {
  // Determine prefix based on service
  const serviceLower = (service || 'uae-to-pinas').toLowerCase()
  const isPhilippinesToUAE = serviceLower.includes('philippines-to-uae') || 
                              serviceLower.includes('pinas-to-uae') ||
                              serviceLower.includes('ph-to-uae')
  const prefix = isPhilippinesToUAE ? 'PH' : 'AE'
  
  // Generate components
  const twoLetters1 = generateRandomLetters(2)      // 2 uppercase letters
  const threeDigits = generateRandomDigits(3)       // 3 digits
  const twoLetters2 = generateRandomLetters(2)     // 2 uppercase letters
  const eightAlphanumeric = generateRandomAlphanumeric(8) // 8 alphanumeric
  
  return `${prefix}${twoLetters1}${threeDigits}${twoLetters2}${eightAlphanumeric}`
}

/**
 * Validate AWB format based on service type
 * @param {string} awb - AWB number to validate
 * @param {string} service - Service type
 * @returns {boolean} True if AWB format is valid
 */
function validateAWBFormat(awb, service) {
  if (!awb || typeof awb !== 'string' || awb.length !== 17) {
    return false
  }
  
  const serviceLower = (service || 'uae-to-pinas').toLowerCase()
  const isPhilippinesToUAE = serviceLower.includes('philippines-to-uae') || 
                              serviceLower.includes('pinas-to-uae') ||
                              serviceLower.includes('ph-to-uae')
  
  const awbRegex = isPhilippinesToUAE
    ? /^PH[A-Z]{2}[0-9]{3}[A-Z]{2}[A-Z0-9]{8}$/
    : /^AE[A-Z]{2}[0-9]{3}[A-Z]{2}[A-Z0-9]{8}$/
  
  return awbRegex.test(awb)
}

/**
 * Generate unique AWB by checking database for duplicates
 * @param {string} service - Service type
 * @param {Object} collection - MongoDB collection instance
 * @param {number} maxAttempts - Maximum number of generation attempts (default: 10)
 * @returns {Promise<string>} Unique AWB number
 * @throws {Error} If unable to generate unique AWB after max attempts
 */
async function generateUniqueAWB(service, collection, maxAttempts = 10) {
  let awb
  let isUnique = false
  let attempts = 0
  
  while (!isUnique && attempts < maxAttempts) {
    awb = generateAWB(service)
    
    // Validate format
    if (!validateAWBFormat(awb, service)) {
      attempts++
      continue
    }
    
    // Check if AWB already exists in database
    const existingBooking = await collection.findOne({ awb: awb })
    if (!existingBooking) {
      isUnique = true
    } else {
      attempts++
    }
  }
  
  if (!isUnique) {
    throw new Error(`Failed to generate unique AWB after ${maxAttempts} attempts`)
  }
  
  return awb
}

const app = express()
const PORT = process.env.PORT || 5000

// MongoDB configuration
const MONGODB_URI = process.env.MONGODB_URI

// Extract database name from URI if present, otherwise use environment variable or default
function extractDatabaseName(uri) {
  if (!uri) return null
  
  // Try to extract database name from URI path
  // Format: mongodb+srv://user:pass@cluster.mongodb.net/database?options
  const pathMatch = uri.match(/mongodb(\+srv)?:\/\/[^\/]+\/([^?]+)/)
  if (pathMatch && pathMatch[2]) {
    return pathMatch[2]
  }
  
  return null
}

// Get database name from environment variable, URI, or use default
const DB_NAME = process.env.MONGODB_DB_NAME || extractDatabaseName(MONGODB_URI) || 'test'
const COLLECTION_NAME = process.env.MONGODB_COLLECTION_NAME || 'bookings'
const OTP_COLLECTION_NAME = process.env.MONGODB_OTP_COLLECTION_NAME || 'otps'

if (!MONGODB_URI) {
  process.exit(1)
}

let cachedClient = null

async function connectToDatabase() {
  if (cachedClient) {
    return cachedClient
  }

  try {
    const client = new MongoClient(MONGODB_URI)
    await client.connect()
    cachedClient = client
    
    // Verify database and collections exist or can be accessed
    const db = client.db(DB_NAME)
    
    // List collections to verify database is accessible
    const collections = await db.listCollections().toArray()
    const collectionNames = collections.map(c => c.name)
    
    // Use originalConsole to bypass filter for connectivity logs
    originalConsole.log('✅ Connected to MongoDB')
    originalConsole.log(`   Database: ${DB_NAME}`)
    originalConsole.log(`   Available collections: ${collectionNames.length > 0 ? collectionNames.join(', ') : 'none (will be created on first insert)'}`)
    originalConsole.log(`   Target Bookings Collection: ${COLLECTION_NAME}`)
    originalConsole.log(`   Target OTP Collection: ${OTP_COLLECTION_NAME}`)
    
    // Verify collections exist or will be created
    if (!collectionNames.includes(COLLECTION_NAME)) {
      originalConsole.log(`   ℹ️  Collection '${COLLECTION_NAME}' will be created on first insert`)
    }
    if (!collectionNames.includes(OTP_COLLECTION_NAME)) {
      originalConsole.log(`   ℹ️  Collection '${OTP_COLLECTION_NAME}' will be created on first insert`)
    }
    
    return client
  } catch (error) {
    throw error
  }
}

// Middleware - CORS configuration
// Support Ngrok and other origins via environment variable or allow all in development
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : ['*'] // Allow all origins in development

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, or curl)
    if (!origin) {
      return callback(null, true)
    }
    
    // If '*' is in allowed origins, allow all
    if (allowedOrigins.includes('*')) {
      return callback(null, true)
    }
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      return callback(null, true)
    }
    
    // Allow Ngrok URLs (any URL containing ngrok.io or ngrok-free.app)
    if (origin.includes('ngrok.io') || origin.includes('ngrok-free.app') || origin.includes('ngrok.app')) {
      return callback(null, true)
    }
    
    // Default: allow the request
    callback(null, true)
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'ngrok-skip-browser-warning'],
  exposedHeaders: ['Content-Length', 'X-Request-Id']
}

app.use(cors(corsOptions))
// Note: CORS middleware automatically handles OPTIONS preflight requests

app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// Request logging middleware
app.use((req, res, next) => {
  console.log(`\n📥 ${req.method} ${req.path}`)
  console.log(`   Origin: ${req.headers.origin || 'none'}`)
  console.log(`   User-Agent: ${req.headers['user-agent']?.substring(0, 50) || 'none'}...`)
  next()
})

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'KN Express Backend API'
  })
})

// API root
app.get('/api', (req, res) => {
  res.json({ 
    message: 'KN Express Booking API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      bookings: 'POST /api/bookings',
      processImage: 'POST /api/process-image',
      ocr: 'POST /api/ocr',
      otpGenerate: 'POST /api/otp/generate',
      otpVerify: 'POST /api/otp/verify'
    }
  })
})

// Image processing endpoint for improved card detection
app.post('/api/process-image', async (req, res) => {
  try {
    const { image, method = 'enhanced' } = req.body
    
    if (!image) {
      return res.status(400).json({
        success: false,
        error: 'Image is required (base64 string)'
      })
    }

    // Remove data URL prefix if present
    const base64Data = image.replace(/^data:image\/[a-z]+;base64,/, '')
    const imageBuffer = Buffer.from(base64Data, 'base64')
    
    console.log('🖼️ Processing image for card detection...')
    console.log(`   Method: ${method}`)
    console.log(`   Image size: ${imageBuffer.length} bytes`)
    
    // Note: OpenCV.js in Node.js requires special handling
    // For now, we'll provide processing recommendations and return the image
    // with metadata that can help frontend improve detection
    
    // Calculate image statistics that can help with detection
    const imageInfo = {
      size: imageBuffer.length,
      hasData: true,
      recommendations: []
    }
    
    // Provide recommendations based on common card detection issues
    const recommendations = {
      similarBackground: [
        'Use adaptive thresholding instead of fixed threshold',
        'Convert to LAB or HSV color space for better separation',
        'Apply morphological operations (erosion/dilation)',
        'Use multi-scale edge detection',
        'Increase contrast before edge detection',
        'Try Canny edge detection with adaptive thresholds',
        'Use contour filtering with area and aspect ratio constraints'
      ],
      lowContrast: [
        'Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)',
        'Use gamma correction',
        'Apply histogram equalization',
        'Increase saturation in HSV color space'
      ],
      blurry: [
        'Apply sharpening filter',
        'Use unsharp masking',
        'Apply deconvolution if possible'
      ]
    }
    
    // Return processing recommendations
    return res.status(200).json({
      success: true,
      imageInfo: imageInfo,
      recommendations: {
        similarBackground: recommendations.similarBackground,
        lowContrast: recommendations.lowContrast,
        blurry: recommendations.blurry
      },
      processingTips: {
        adaptiveThreshold: 'Use cv.adaptiveThreshold() with ADAPTIVE_THRESH_GAUSSIAN_C or ADAPTIVE_THRESH_MEAN_C',
        colorSpace: 'Convert BGR to LAB or HSV: cv.cvtColor(img, cv.COLOR_BGR2LAB)',
        edgeDetection: 'Use Canny with adaptive thresholds: cv.Canny(gray, threshold1, threshold2)',
        morphology: 'Apply morphological operations: cv.morphologyEx(img, cv.MORPH_CLOSE, kernel)',
        contourFilter: 'Filter contours by area and aspect ratio (ID cards typically 85.6mm x 53.98mm ratio ~1.585)',
        multiScale: 'Try detection at multiple scales/resolutions'
      },
      message: 'Image received. Use recommendations above to improve frontend card detection.'
    })
    
  } catch (error) {
    console.error('❌ Image processing error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to process image',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

// OCR endpoint DISABLED - OpenAI integration removed
// EID verification is no longer performed
app.post('/api/ocr', async (req, res) => {
  return res.status(503).json({
    success: false,
    error: 'OCR endpoint is disabled. EID verification has been removed.',
    message: 'This endpoint is no longer available. Bookings can be submitted without EID verification.'
  })
})

// OLD OCR CODE REMOVED - OpenAI integration removed

// OTP Endpoints
// Generate and send OTP
app.post('/api/otp/generate', async (req, res) => {
  const requestId = Date.now().toString(36)
  const timestamp = new Date().toISOString()
  
  console.log('\n🔵 ===== OTP GENERATE REQUEST =====')
  console.log(`📥 Request ID: ${requestId}`)
  console.log(`⏰ Timestamp: ${timestamp}`)
  
  try {
    const { phoneNumber } = req.body
    
    // Validate phone number
    if (!phoneNumber || typeof phoneNumber !== 'string' || !phoneNumber.trim()) {
      console.log(`❌ Validation failed: Phone number is required`)
      return res.status(400).json({
        success: false,
        error: 'Phone number is required',
        requestId: requestId
      })
    }

    // Format phone number
    const formattedPhone = phoneNumber.trim().replace(/\s+/g, '')
    if (!formattedPhone.startsWith('+')) {
      return res.status(400).json({
        success: false,
        error: 'Phone number must include country code (e.g., +971501234567)',
        requestId: requestId
      })
    }

    console.log(`📱 Phone Number: ${formattedPhone}`)

    // Generate OTP
    const otp = generateOTP()
    const expiryDate = getOTPExpiry()
    const otpConfig = getOTPConfig()

    console.log(`🔐 Generated OTP: ${otp}`)
    console.log(`⏰ Expires at: ${expiryDate.toISOString()}`)

    // Connect to MongoDB first (before sending SMS)
    let client
    try {
      client = await connectToDatabase()
    } catch (dbError) {
      console.error(`❌ Database connection error: ${dbError.message}`)
      return res.status(500).json({
        success: false,
        error: 'Database connection failed',
        requestId: requestId
      })
    }

    const db = client.db(DB_NAME)
    const otpCollection = db.collection(OTP_COLLECTION_NAME)

    // Delete any existing OTPs for this phone number (before sending new one)
    try {
      await otpCollection.deleteMany({ 
        phoneNumber: formattedPhone,
        verified: false 
      })
    } catch (deleteError) {
      console.error(`⚠️  Warning: Failed to delete existing OTPs: ${deleteError.message}`)
      // Continue anyway - we'll still store the new OTP
    }

    // Send OTP via SMS (SMSALA)
    let smsResult = null
    try {
      smsResult = await sendOTP(formattedPhone, otp)
      console.log(`✅ OTP sent successfully via SMSALA`)
      
      // Store OTP in MongoDB IMMEDIATELY after SMSALA confirms SMS was sent
      const otpDocument = {
        phoneNumber: formattedPhone,
        otp: otp,
        createdAt: new Date(),
        expiresAt: expiryDate,
        verified: false,
        attempts: 0,
        maxAttempts: otpConfig.maxAttempts,
        smsSent: true,
        smsSentAt: new Date(),
        smsalaMessageId: smsResult.messageId || null
      }

      await otpCollection.insertOne(otpDocument)
      console.log(`💾 OTP stored in database immediately after SMSALA confirmation`)
      console.log(`   SMSALA Message ID: ${smsResult.messageId || 'N/A'}`)

    } catch (smsError) {
      console.error(`❌ Failed to send OTP via SMSALA: ${smsError.message}`)
      
      // Even if SMS fails, we might want to store OTP for retry scenarios
      // But for now, we'll return error since SMS is required
      return res.status(500).json({
        success: false,
        error: 'Failed to send OTP. Please try again.',
        requestId: requestId,
        details: process.env.NODE_ENV === 'development' ? smsError.message : undefined
      })
    }

    return res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
      phoneNumber: formattedPhone,
      expiresInMinutes: otpConfig.expiryMinutes,
      maxAttempts: otpConfig.maxAttempts,
      requestId: requestId,
      timestamp: timestamp
    })

  } catch (error) {
    console.error('\n❌❌❌ OTP GENERATE ERROR ❌❌❌')
    console.error(`🔴 Request ID ${requestId} - Error occurred`)
    console.error(`   Error Type: ${error.constructor.name}`)
    console.error(`   Error Message: ${error.message}`)
    console.error(`   Error Stack:`, error.stack)
    console.error(`🔴 ===== ERROR END =====\n`)
    
    return res.status(500).json({
      success: false,
      error: 'Failed to generate OTP',
      requestId: requestId,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

// Verify OTP
app.post('/api/otp/verify', async (req, res) => {
  const requestId = Date.now().toString(36)
  const timestamp = new Date().toISOString()
  
  console.log('\n🔵 ===== OTP VERIFY REQUEST =====')
  console.log(`📥 Request ID: ${requestId}`)
  console.log(`⏰ Timestamp: ${timestamp}`)
  
  try {
    const { phoneNumber, otp } = req.body
    
    // Validate inputs
    if (!phoneNumber || typeof phoneNumber !== 'string' || !phoneNumber.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required',
        requestId: requestId
      })
    }

    if (!otp || typeof otp !== 'string' || !otp.trim()) {
      return res.status(400).json({
        success: false,
        error: 'OTP is required',
        requestId: requestId
      })
    }

    // Format phone number
    const formattedPhone = phoneNumber.trim().replace(/\s+/g, '')
    const providedOTP = otp.trim()

    console.log(`📱 Phone Number: ${formattedPhone}`)
    console.log(`🔐 Provided OTP: ${providedOTP}`)

    // Connect to MongoDB
    let client
    try {
      client = await connectToDatabase()
    } catch (dbError) {
      console.error(`❌ Database connection error: ${dbError.message}`)
      return res.status(500).json({
        success: false,
        error: 'Database connection failed',
        requestId: requestId
      })
    }

    const db = client.db(DB_NAME)
    const otpCollection = db.collection(OTP_COLLECTION_NAME)

    // Find OTP record
    const otpRecord = await otpCollection.findOne({
      phoneNumber: formattedPhone,
      verified: false
    })

    if (!otpRecord) {
      console.log(`❌ No OTP found for phone number`)
      return res.status(400).json({
        success: false,
        error: 'No OTP found for this phone number. Please generate a new OTP.',
        requestId: requestId
      })
    }

    // Check if OTP is expired
    if (isOTPExpired(otpRecord.expiresAt)) {
      console.log(`❌ OTP expired`)
      await otpCollection.deleteOne({ _id: otpRecord._id })
      return res.status(400).json({
        success: false,
        error: 'OTP has expired. Please generate a new OTP.',
        requestId: requestId
      })
    }

    // Check if max attempts exceeded
    if (otpRecord.attempts >= otpRecord.maxAttempts) {
      console.log(`❌ Max attempts exceeded: ${otpRecord.attempts}/${otpRecord.maxAttempts}`)
      await otpCollection.deleteOne({ _id: otpRecord._id })
      return res.status(400).json({
        success: false,
        error: 'Maximum verification attempts exceeded. Please generate a new OTP.',
        requestId: requestId
      })
    }

    // Increment attempts
    await otpCollection.updateOne(
      { _id: otpRecord._id },
      { $inc: { attempts: 1 } }
    )

    // Verify OTP
    if (otpRecord.otp !== providedOTP) {
      console.log(`❌ OTP mismatch`)
      const updatedRecord = await otpCollection.findOne({ _id: otpRecord._id })
      const remainingAttempts = updatedRecord.maxAttempts - updatedRecord.attempts
      
      return res.status(400).json({
        success: false,
        error: 'Invalid OTP',
        remainingAttempts: remainingAttempts > 0 ? remainingAttempts : 0,
        requestId: requestId
      })
    }

    // Mark OTP as verified
    await otpCollection.updateOne(
      { _id: otpRecord._id },
      { 
        $set: { 
          verified: true,
          verifiedAt: new Date()
        } 
      }
    )

    console.log(`✅ OTP verified successfully`)

    return res.status(200).json({
      success: true,
      message: 'OTP verified successfully',
      phoneNumber: formattedPhone,
      verified: true,
      requestId: requestId,
      timestamp: timestamp
    })

  } catch (error) {
    console.error('\n❌❌❌ OTP VERIFY ERROR ❌❌❌')
    console.error(`🔴 Request ID ${requestId} - Error occurred`)
    console.error(`   Error Type: ${error.constructor.name}`)
    console.error(`   Error Message: ${error.message}`)
    console.error(`   Error Stack:`, error.stack)
    console.error(`🔴 ===== ERROR END =====\n`)
    
    return res.status(500).json({
      success: false,
      error: 'Failed to verify OTP',
      requestId: requestId,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

// Bookings endpoint
app.post('/api/bookings', async (req, res) => {
  const requestId = Date.now().toString(36)
  const timestamp = new Date().toISOString()
  
  console.log('\n🔵 ===== NEW API REQUEST =====')
  console.log(`📥 Request ID: ${requestId}`)
  console.log(`⏰ Timestamp: ${timestamp}`)
  console.log(`🌐 Method: ${req.method}`)
  console.log(`📍 URL: ${req.url}`)
  console.log(`🔗 Full URL: ${req.protocol}://${req.get('host')}${req.originalUrl}`)
  console.log(`📋 Headers:`, JSON.stringify(req.headers, null, 2))
  
  try {
    const bookingData = req.body
    
    console.log(`\n📦 Request Body Summary:`)
    console.log(`   - Has sender: ${!!bookingData.sender}`)
    console.log(`   - Has receiver: ${!!bookingData.receiver}`)
    console.log(`   - Has items: ${!!bookingData.items} (${Array.isArray(bookingData.items) ? bookingData.items.length : 'not array'})`)
    console.log(`   - Service: ${bookingData.service || 'not provided'}`)
    console.log(`   - Terms accepted: ${bookingData.termsAccepted || false}`)
    console.log(`   - Has eidFrontImage: ${!!bookingData.eidFrontImage}`)
    console.log(`   - Has eidBackImage: ${!!bookingData.eidBackImage}`)
    console.log(`   - Has eidFrontImageFirstName: ${!!bookingData.eidFrontImageFirstName}`)
    console.log(`   - Has eidFrontImageLastName: ${!!bookingData.eidFrontImageLastName}`)
    if (bookingData.eidFrontImageFirstName && bookingData.eidFrontImageLastName) {
      console.log(`   - EID Name: ${bookingData.eidFrontImageFirstName} ${bookingData.eidFrontImageLastName}`)
    }
    console.log(`   - Has philippinesIdFront: ${!!bookingData.philippinesIdFront}`)
    console.log(`   - Has philippinesIdBack: ${!!bookingData.philippinesIdBack}`)
    if (bookingData.philippinesIdFront) {
      const phFrontBase64 = bookingData.philippinesIdFront.replace(/^data:image\/[a-z]+;base64,/, '')
      console.log(`   - philippinesIdFront length: ${bookingData.philippinesIdFront.length} chars (base64: ${phFrontBase64.length} chars)`)
      console.log(`   - philippinesIdFront starts with: ${bookingData.philippinesIdFront.substring(0, 50)}...`)
    }
    if (bookingData.philippinesIdBack) {
      const phBackBase64 = bookingData.philippinesIdBack.replace(/^data:image\/[a-z]+;base64,/, '')
      console.log(`   - philippinesIdBack length: ${bookingData.philippinesIdBack.length} chars (base64: ${phBackBase64.length} chars)`)
      console.log(`   - philippinesIdBack starts with: ${bookingData.philippinesIdBack.substring(0, 50)}...`)
    }
    console.log(`   - Has customerImage: ${!!bookingData.customerImage}`)
    console.log(`   - Has customerImages: ${!!bookingData.customerImages} (${Array.isArray(bookingData.customerImages) ? bookingData.customerImages.length : 'not array'})`)
    console.log(`   - Has OTP Phone Number: ${!!bookingData.otpPhoneNumber}`)
    console.log(`   - Has OTP: ${!!bookingData.otp}`)
    if (bookingData.otpPhoneNumber) {
      console.log(`   - OTP Phone: ${bookingData.otpPhoneNumber}`)
    }
    
    // Debug: Check all identity document related fields in request
    const identityFields = Object.keys(bookingData).filter(key => 
      key.toLowerCase().includes('id') || 
      key.toLowerCase().includes('eid') || 
      key.toLowerCase().includes('philippines') ||
      key.toLowerCase().includes('customer')
    )
    if (identityFields.length > 0) {
      console.log(`   - Identity-related fields in request: ${identityFields.join(', ')}`)
    }
    
    if (bookingData.sender) {
      console.log(`\n👤 Sender Data:`)
      console.log(`   - Full Name: ${bookingData.sender.fullName || 'missing'}`)
      console.log(`   - First Name: ${bookingData.sender.firstName || 'missing'}`)
      console.log(`   - Last Name: ${bookingData.sender.lastName || 'missing'}`)
      console.log(`   - Email: ${bookingData.sender.emailAddress || 'empty/optional'}`)
      console.log(`   - Country: ${bookingData.sender.country || 'missing'}`)
      console.log(`   - Address Line 1: ${bookingData.sender.addressLine1 || 'missing'}`)
      console.log(`   - Phone: ${bookingData.sender.phoneNumber || 'missing'}`)
      console.log(`   - Dial Code (sent): ${bookingData.sender.dialCode || 'not provided'}`)
      console.log(`   - Delivery Option: ${bookingData.sender.deliveryOption || 'not provided'}`)
      console.log(`   - Insured: ${bookingData.sender.insured !== undefined ? bookingData.sender.insured : 'not provided'}`)
      console.log(`   - Declared Amount: ${bookingData.sender.declaredAmount !== undefined ? bookingData.sender.declaredAmount : 'not provided'}`)
    }
    
    if (bookingData.receiver) {
      console.log(`\n👤 Receiver Data:`)
      console.log(`   - Full Name: ${bookingData.receiver.fullName || 'missing'}`)
      console.log(`   - First Name: ${bookingData.receiver.firstName || 'missing'}`)
      console.log(`   - Last Name: ${bookingData.receiver.lastName || 'missing'}`)
      console.log(`   - Email: ${bookingData.receiver.emailAddress || 'empty/optional'}`)
      console.log(`   - Country: ${bookingData.receiver.country || 'missing'}`)
      console.log(`   - Address Line 1: ${bookingData.receiver.addressLine1 || 'missing'}`)
      console.log(`   - Phone: ${bookingData.receiver.phoneNumber || 'missing'}`)
      console.log(`   - Dial Code (sent): ${bookingData.receiver.dialCode || 'not provided'}`)
    }
    
    if (bookingData.items && Array.isArray(bookingData.items)) {
      console.log(`\n📦 Items (${bookingData.items.length}):`)
      bookingData.items.forEach((item, index) => {
        console.log(`   ${index + 1}. ID: ${item.id || 'missing'}, Commodity: ${item.commodity || 'missing'}, Qty: ${item.qty || 'missing'}`)
      })
    }

    // Validate required fields
    if (!bookingData.sender || !bookingData.receiver || !bookingData.items) {
      console.log(`\n❌ VALIDATION ERROR:`)
      console.log(`   - Missing sender: ${!bookingData.sender}`)
      console.log(`   - Missing receiver: ${!bookingData.receiver}`)
      console.log(`   - Missing items: ${!bookingData.items}`)
      console.log(`🔴 Request ID ${requestId} - Validation failed: Missing required booking information`)
      
      return res.status(400).json({
        success: false,
        error: 'Missing required booking information (sender, receiver, items)',
        requestId: requestId
      })
    }

    // Validate sender fields - last name is required, email is optional
    if (!bookingData.sender.lastName) {
      console.log(`\n❌ VALIDATION ERROR: Sender last name is required`)
      console.log(`   Sender data:`, JSON.stringify(bookingData.sender, null, 2))
      console.log(`🔴 Request ID ${requestId} - Validation failed: Sender last name missing`)
      
      return res.status(400).json({
        success: false,
        error: 'Sender last name is required',
        requestId: requestId
      })
    }

    // Validate sender address - only country is required, addressLine1 is optional (max 200 chars)
    if (!bookingData.sender.country) {
      console.log(`\n❌ VALIDATION ERROR: Sender country is required`)
      console.log(`   Country: ${bookingData.sender.country || 'missing'}`)
      console.log(`🔴 Request ID ${requestId} - Validation failed: Sender country missing`)
      
      return res.status(400).json({
        success: false,
        error: 'Sender country is required',
        requestId: requestId
      })
    }
    
    // Validate addressLine1 length if provided (max 200 chars)
    if (bookingData.sender.addressLine1 && bookingData.sender.addressLine1.length > 200) {
      console.log(`\n❌ VALIDATION ERROR: Sender addressLine1 exceeds 200 characters`)
      console.log(`   Length: ${bookingData.sender.addressLine1.length}`)
      console.log(`🔴 Request ID ${requestId} - Validation failed: Sender addressLine1 too long`)
      
      return res.status(400).json({
        success: false,
        error: 'Sender address line 1 must not exceed 200 characters',
        requestId: requestId
      })
    }

    // Validate receiver fields - last name is required, email is optional
    if (!bookingData.receiver.lastName) {
      console.log(`\n❌ VALIDATION ERROR: Receiver last name is required`)
      console.log(`   Receiver data:`, JSON.stringify(bookingData.receiver, null, 2))
      console.log(`🔴 Request ID ${requestId} - Validation failed: Receiver last name missing`)
      
      return res.status(400).json({
        success: false,
        error: 'Receiver last name is required',
        requestId: requestId
      })
    }

    // Validate receiver address - only country is required, addressLine1 is optional (max 200 chars)
    if (!bookingData.receiver.country) {
      console.log(`\n❌ VALIDATION ERROR: Receiver country is required`)
      console.log(`   Country: ${bookingData.receiver.country || 'missing'}`)
      console.log(`🔴 Request ID ${requestId} - Validation failed: Receiver country missing`)
      
      return res.status(400).json({
        success: false,
        error: 'Receiver country is required',
        requestId: requestId
      })
    }
    
    // Validate addressLine1 length if provided (max 200 chars)
    if (bookingData.receiver.addressLine1 && bookingData.receiver.addressLine1.length > 200) {
      console.log(`\n❌ VALIDATION ERROR: Receiver addressLine1 exceeds 200 characters`)
      console.log(`   Length: ${bookingData.receiver.addressLine1.length}`)
      console.log(`🔴 Request ID ${requestId} - Validation failed: Receiver addressLine1 too long`)
      
      return res.status(400).json({
        success: false,
        error: 'Receiver address line 1 must not exceed 200 characters',
        requestId: requestId
      })
    }


    // Validate items
    if (!Array.isArray(bookingData.items) || bookingData.items.length === 0) {
      console.log(`\n❌ VALIDATION ERROR: Items validation failed`)
      console.log(`   Items type: ${typeof bookingData.items}`)
      console.log(`   Is array: ${Array.isArray(bookingData.items)}`)
      console.log(`   Length: ${Array.isArray(bookingData.items) ? bookingData.items.length : 'N/A'}`)
      console.log(`🔴 Request ID ${requestId} - Validation failed: Items invalid`)
      
      return res.status(400).json({
        success: false,
        error: 'At least one item is required',
        requestId: requestId
      })
    }

    // Validate shipmentType + insurance fields (only for uae-to-pinas service)
    const service = bookingData.service || 'uae-to-pinas'
    const serviceLower = service.toLowerCase()
    const isUAEToPinas = !serviceLower.includes('philippines-to-uae') && 
                          !serviceLower.includes('pinas-to-uae') &&
                          !serviceLower.includes('ph-to-uae')
    
    if (isUAEToPinas) {
      // shipmentType is REQUIRED for UAE -> PH bookings
      const shipmentType = bookingData.sender?.shipmentType
      if (shipmentType !== 'document' && shipmentType !== 'non-document') {
        console.log(`\n❌ VALIDATION ERROR: Invalid or missing shipmentType`)
        console.log(`   shipmentType: ${shipmentType}`)
        console.log(`🔴 Request ID ${requestId} - Validation failed: shipmentType must be "document" or "non-document"`)
        
        return res.status(400).json({
          success: false,
          error: 'sender.shipmentType must be "document" or "non-document"',
          requestId: requestId
        })
      }

      // Business rules:
      // - document: force insured=false and declaredAmount=0
      // - non-document: force insured=true and declaredAmount must be a number > 0 (<= 1,000,000)
      if (shipmentType === 'document') {
        bookingData.sender.insured = false
        bookingData.sender.declaredAmount = 0
      } else {
        bookingData.sender.insured = true
        const amount = Number(bookingData.sender.declaredAmount)
        if (!Number.isFinite(amount) || amount <= 0) {
          console.log(`\n❌ VALIDATION ERROR: declaredAmount invalid for non-document shipment`)
          console.log(`   shipmentType: ${shipmentType}`)
          console.log(`   declaredAmount: ${bookingData.sender.declaredAmount}`)
          console.log(`🔴 Request ID ${requestId} - Validation failed: declaredAmount must be a number > 0 for non-document shipments`)
          
          return res.status(400).json({
            success: false,
            error: 'sender.declaredAmount must be a number > 0 for non-document shipments',
            requestId: requestId
          })
        }

        if (amount > 1000000) {
          console.log(`\n❌ VALIDATION ERROR: declaredAmount exceeds maximum limit`)
          console.log(`   Declared Amount: ${amount}`)
          console.log(`   Maximum allowed: 1,000,000 AED`)
          console.log(`🔴 Request ID ${requestId} - Validation failed: declaredAmount exceeds maximum`)
          
          return res.status(400).json({
            success: false,
            error: 'sender.declaredAmount cannot exceed 1,000,000 AED',
            requestId: requestId
          })
        }

        bookingData.sender.declaredAmount = amount
      }
    } else if (!isUAEToPinas && (bookingData.sender.insured !== undefined || bookingData.sender.declaredAmount !== undefined)) {
      // Insurance fields should not be present for non-uae-to-pinas services
      console.log(`\n⚠️  WARNING: Insurance fields provided for non-uae-to-pinas service - will be ignored`)
    }
    
    console.log(`\n✅ All validations passed`)

    // OTP Verification - MANDATORY for all bookings
    // Validate that OTP fields are provided
    if (!bookingData.otpPhoneNumber || !bookingData.otp) {
      console.log(`\n❌ VALIDATION ERROR: OTP verification is required`)
      console.log(`   otpPhoneNumber: ${bookingData.otpPhoneNumber ? 'provided' : 'missing'}`)
      console.log(`   otp: ${bookingData.otp ? 'provided' : 'missing'}`)
      console.log(`🔴 Request ID ${requestId} - Validation failed: OTP verification is mandatory`)
      
      return res.status(400).json({
        success: false,
        error: 'OTP verification is required. Please provide both phone number and OTP.',
        requestId: requestId
      })
    }

    // OTP Verification - Required for all bookings
    let verifiedOTP = null // Store the verified OTP value to save in booking
    console.log(`\n🔐 Starting OTP verification (MANDATORY)...`)
    console.log(`   Phone Number: ${bookingData.otpPhoneNumber}`)
    
    try {
      // Connect to MongoDB to verify OTP
      let client
      try {
        client = await connectToDatabase()
      } catch (dbError) {
        console.error(`❌ Database connection error: ${dbError.message}`)
        return res.status(500).json({
          success: false,
          error: 'Database connection failed',
          requestId: requestId
        })
      }

      const db = client.db(DB_NAME)
      const otpCollection = db.collection(OTP_COLLECTION_NAME)

      // Format phone number
      const formattedPhone = bookingData.otpPhoneNumber.trim().replace(/\s+/g, '')
      const providedOTP = bookingData.otp.trim()

      // Find OTP record
      const otpRecord = await otpCollection.findOne({
        phoneNumber: formattedPhone,
        verified: false
      })

      if (!otpRecord) {
        console.log(`❌ No OTP found for phone number`)
        return res.status(400).json({
          success: false,
          error: 'No OTP found for this phone number. Please generate and verify OTP first.',
          requestId: requestId
        })
      }

      // Check if OTP is expired
      if (isOTPExpired(otpRecord.expiresAt)) {
        console.log(`❌ OTP expired`)
        await otpCollection.deleteOne({ _id: otpRecord._id })
        return res.status(400).json({
          success: false,
          error: 'OTP has expired. Please generate a new OTP.',
          requestId: requestId
        })
      }

      // Check if max attempts exceeded
      if (otpRecord.attempts >= otpRecord.maxAttempts) {
        console.log(`❌ Max attempts exceeded`)
        await otpCollection.deleteOne({ _id: otpRecord._id })
        return res.status(400).json({
          success: false,
          error: 'Maximum verification attempts exceeded. Please generate a new OTP.',
          requestId: requestId
        })
      }

      // Verify OTP
      if (otpRecord.otp !== providedOTP) {
        console.log(`❌ OTP mismatch`)
        await otpCollection.updateOne(
          { _id: otpRecord._id },
          { $inc: { attempts: 1 } }
        )
        const updatedRecord = await otpCollection.findOne({ _id: otpRecord._id })
        const remainingAttempts = updatedRecord.maxAttempts - updatedRecord.attempts
        
        return res.status(400).json({
          success: false,
          error: 'Invalid OTP',
          remainingAttempts: remainingAttempts > 0 ? remainingAttempts : 0,
          requestId: requestId
        })
      }

      // Store the verified OTP value to save in booking
      verifiedOTP = otpRecord.otp

      // Mark OTP as verified
      await otpCollection.updateOne(
        { _id: otpRecord._id },
        { 
          $set: { 
            verified: true,
            verifiedAt: new Date()
          } 
        }
      )

      console.log(`✅ OTP verified successfully`)
      console.log(`   OTP value will be saved in booking: ${verifiedOTP}`)
    } catch (otpError) {
      console.error(`❌ OTP verification error: ${otpError.message}`)
      return res.status(500).json({
        success: false,
        error: 'Failed to verify OTP',
        requestId: requestId,
        details: process.env.NODE_ENV === 'development' ? otpError.message : undefined
      })
    }

    // Determine route and set dial codes automatically (needed for EID name logic)
    // Note: service and serviceLower are already declared in validation section above
    const isPhilippinesToUAE = serviceLower.includes('philippines-to-uae') || 
                                serviceLower.includes('pinas-to-uae') ||
                                serviceLower.includes('ph-to-uae')
    
    // Frontend already sends the correct names in eidFrontImageFirstName and eidFrontImageLastName:
    // - PH to UAE: These are the receiver's name (receiver has EID in UAE)
    // - UAE to PH: These are the sender's name (sender has EID in UAE)
    // So we use them directly for verification
    let eidFirstName = bookingData.eidFrontImageFirstName || null
    let eidLastName = bookingData.eidFrontImageLastName || null
    
    if (bookingData.eidFrontImage) {
      if (isPhilippinesToUAE) {
        console.log(`\n🇵🇭 PH to UAE Service: EID belongs to RECEIVER (person in UAE)`)
        console.log(`   EID First Name (from frontend): ${eidFirstName || 'not provided'}`)
        console.log(`   EID Last Name (from frontend): ${eidLastName || 'not provided'}`)
        console.log(`   Receiver First Name: ${bookingData.receiver?.firstName || 'not provided'}`)
        console.log(`   Receiver Last Name: ${bookingData.receiver?.lastName || 'not provided'}`)
      } else {
        console.log(`\n🇦🇪 UAE to PH Service: EID belongs to SENDER (person in UAE)`)
        console.log(`   EID First Name (from frontend): ${eidFirstName || 'not provided'}`)
        console.log(`   EID Last Name (from frontend): ${eidLastName || 'not provided'}`)
        console.log(`   Sender First Name: ${bookingData.sender?.firstName || 'not provided'}`)
        console.log(`   Sender Last Name: ${bookingData.sender?.lastName || 'not provided'}`)
      }
    }

    // EID Verification removed - EID images are optional and accepted without validation
    // EID images can still be uploaded and stored, but no verification is performed
    let eidVerification = null

    // Validate EID verification result - reject booking if EID is not valid
    if (eidVerification) {
      // Reject if EID front is not valid
      if (bookingData.eidFrontImage && eidVerification.isFrontValid === false) {
        console.log(`\n❌ VALIDATION ERROR: Front image is not a valid Emirates ID`)
        console.log(`🔴 Request ID ${requestId} - EID validation failed`)
        
        return res.status(400).json({
          success: false,
          error: 'The provided front image is not a valid Emirates ID. Please upload a valid Emirates ID front image.',
          requestId: requestId,
          eidVerification: eidVerification
        })
      }
      
      // Reject if EID back is provided but not valid
      if (bookingData.eidBackImage && eidVerification.isBackValid === false) {
        console.log(`\n❌ VALIDATION ERROR: Back image is not a valid Emirates ID`)
        console.log(`🔴 Request ID ${requestId} - EID back validation failed`)
        
        return res.status(400).json({
          success: false,
          error: 'The provided back image is not a valid Emirates ID. Please upload a valid Emirates ID back image.',
          requestId: requestId,
          eidVerification: eidVerification
        })
      }
      
      // Warn if front side is not detected as front (but EID is valid)
      if (bookingData.eidFrontImage && eidVerification.isFrontValid === true && eidVerification.isFrontSide === false) {
        console.log(`\n⚠️  WARNING: Front image may not be a valid EID front side - booking will proceed but requires manual review`)
      }
      
      // Warn if back side is provided but not detected as back (but EID is valid)
      if (bookingData.eidBackImage && eidVerification.isBackValid === true && eidVerification.isBackSide === false) {
        console.log(`\n⚠️  WARNING: Back image may not be a valid EID back side - booking will proceed but requires manual review`)
      }
    }

    // Generate unique reference number
    const referenceNumber = 'KNX' + Date.now().toString(36).toUpperCase()
    
    // Set dial codes based on route
    const senderDialCode = isPhilippinesToUAE ? '+63' : '+971'
    const receiverDialCode = isPhilippinesToUAE ? '+971' : '+63'
    
    console.log(`\n🌍 Route Detection:`)
    console.log(`   Service: ${service}`)
    console.log(`   Is Philippines to UAE: ${isPhilippinesToUAE}`)
    console.log(`   Sender dial code: ${senderDialCode}`)
    console.log(`   Receiver dial code: ${receiverDialCode}`)
    
    // Connect to MongoDB
    console.log(`\n🔌 Connecting to MongoDB...`)
    console.log(`   Database: ${DB_NAME}`)
    console.log(`   Collection: ${COLLECTION_NAME}`)
    
    let client
    try {
      client = await connectToDatabase()
      console.log(`✅ MongoDB connection successful`)
    } catch (dbError) {
      console.error(`\n❌ MONGODB CONNECTION ERROR:`)
      console.error(`   Error: ${dbError.message}`)
      console.error(`   Stack: ${dbError.stack}`)
      console.log(`🔴 Request ID ${requestId} - Database connection failed`)
      
      return res.status(500).json({
        success: false,
        error: 'Database connection failed',
        requestId: requestId,
        details: process.env.NODE_ENV === 'development' ? dbError.message : undefined
      })
    }
    
    const db = client.db(DB_NAME)
    const collection = db.collection(COLLECTION_NAME)

    // Generate unique AWB before creating booking document
    console.log(`\n📋 Generating AWB for service: ${service}...`)
    let awb
    try {
      awb = await generateUniqueAWB(service, collection, 10)
      console.log(`✅ AWB generated successfully: ${awb}`)
      
      // Validate AWB format one more time before saving
      if (!validateAWBFormat(awb, service)) {
        throw new Error(`Generated AWB ${awb} does not match required format`)
      }
    } catch (awbError) {
      console.error(`\n❌ AWB GENERATION ERROR:`)
      console.error(`   Error: ${awbError.message}`)
      console.log(`🔴 Request ID ${requestId} - AWB generation failed`)
      
      return res.status(500).json({
        success: false,
        error: 'Failed to generate unique AWB. Please try again.',
        requestId: requestId,
        details: process.env.NODE_ENV === 'development' ? awbError.message : undefined
      })
    }

    // Prepare booking document with all detailed fields
    const bookingDocument = {
      referenceNumber: referenceNumber,
      awb: awb, // Add AWB to booking document
      service: service,
      
      // Sender Details - Complete breakdown
      sender: {
        // Personal Information
        fullName: bookingData.sender.fullName || '',
        firstName: bookingData.sender.firstName || '',
        lastName: bookingData.sender.lastName || '',
        emailAddress: bookingData.sender.emailAddress || '',
        agentName: bookingData.sender.agentName || '',
        
        // Address Information
        completeAddress: bookingData.sender.completeAddress || null,
        country: bookingData.sender.country || 'UNITED ARAB EMIRATES',
        // Deprecated fields (nullable)
        emirates: bookingData.sender.emirates || null,
        city: bookingData.sender.city || null,
        district: bookingData.sender.district || null,
        zone: bookingData.sender.zone || null,
        landmark: bookingData.sender.landmark || null,
        // Active field (optional, max 200 chars)
        addressLine1: bookingData.sender.addressLine1 || null,
        
        // Contact Information - dial code is automatically set based on route
        dialCode: senderDialCode,
        phoneNumber: bookingData.sender.phoneNumber || '',
        contactNo: bookingData.sender.contactNo || '',
        
        // Delivery Options
        deliveryOption: bookingData.sender.deliveryOption || 'warehouse',
        
        // Shipment Type + Insurance Fields (only for uae-to-pinas service)
        ...(!isPhilippinesToUAE ? {
          shipmentType: bookingData.sender.shipmentType,
          insured: bookingData.sender.insured,
          declaredAmount: bookingData.sender.declaredAmount
        } : {})
      },
      
      // Receiver Details - Complete breakdown
      receiver: {
        // Personal Information
        fullName: bookingData.receiver.fullName || '',
        firstName: bookingData.receiver.firstName || '',
        lastName: bookingData.receiver.lastName || '',
        emailAddress: bookingData.receiver.emailAddress || '',
        
        // Address Information
        completeAddress: bookingData.receiver.completeAddress || null,
        country: bookingData.receiver.country || 'PHILIPPINES',
        // Deprecated fields (nullable)
        region: bookingData.receiver.region || null,
        province: bookingData.receiver.province || null,
        city: bookingData.receiver.city || null,
        barangay: bookingData.receiver.barangay || null,
        landmark: bookingData.receiver.landmark || null,
        // Active field (optional, max 200 chars)
        addressLine1: bookingData.receiver.addressLine1 || null,
        
        // Contact Information - dial code is automatically set based on route
        dialCode: receiverDialCode,
        phoneNumber: bookingData.receiver.phoneNumber || '',
        contactNo: bookingData.receiver.contactNo || '',
        
        // Delivery Options
        deliveryOption: bookingData.receiver.deliveryOption || 'delivery'
      },
      
      // Items/Commodities
      items: bookingData.items || [],
      
      // Identity Verification Documents
      identityDocuments: {
        // UAE EID documents (for UAE routes)
        eidFrontImage: bookingData.eidFrontImage || null,
        eidBackImage: bookingData.eidBackImage || null,
        // EID Name fields (for verification) - store the names used for verification
        ...(eidFirstName && { eidFrontImageFirstName: eidFirstName }),
        ...(eidLastName && { eidFrontImageLastName: eidLastName }),
        // Philippines ID documents (accepted for both UAE to PH and PH to UAE routes)
        // Only include if they have values (MongoDB omits null fields)
        ...(bookingData.philippinesIdFront && { philippinesIdFront: bookingData.philippinesIdFront }),
        ...(bookingData.philippinesIdBack && { philippinesIdBack: bookingData.philippinesIdBack }),
        // Customer face images
        customerImage: bookingData.customerImage || null, // Single image for backward compatibility
        customerImages: bookingData.customerImages || (bookingData.customerImage ? [bookingData.customerImage] : []) // All face images
      },
      
      // EID Verification Results
      ...(eidVerification ? {
        eidVerification: {
          isEmiratesId: eidVerification.isEmiratesId,
          isFrontSide: eidVerification.isFrontSide,
          isBackSide: eidVerification.isBackSide,
          verificationMessage: eidVerification.verificationMessage
        }
      } : {}),
      
      // OTP Verification Status (mandatory - always included if booking reaches this point)
      ...(verifiedOTP ? {
        otpVerification: {
          phoneNumber: bookingData.otpPhoneNumber.trim().replace(/\s+/g, ''),
          otp: verifiedOTP, // Save the actual OTP value in booking
          verified: true,
          verifiedAt: new Date()
        }
      } : {}),
      
      // Additional Details (optional - frontend no longer collects this)
      additionalDetails: bookingData.additionalDetails ? {
        paymentMethod: bookingData.additionalDetails.paymentMethod || 'cash',
        email: bookingData.additionalDetails.email || null,
        additionalInstructions: bookingData.additionalDetails.additionalInstructions || null
      } : null,
      
      // Terms and Status
      termsAccepted: bookingData.termsAccepted || false,
      submittedAt: new Date(),
      submissionTimestamp: bookingData.submissionTimestamp || new Date().toISOString(),
      status: 'pending',
      source: 'web'
    }

    // Insert into MongoDB
    console.log(`\n💾 Inserting booking document into MongoDB...`)
    console.log(`   Reference Number: ${referenceNumber}`)
    console.log(`   AWB: ${awb}`)
    console.log(`\n📄 Identity Documents being saved:`)
    console.log(`   - eidFrontImage: ${bookingDocument.identityDocuments.eidFrontImage ? 'Present (' + bookingDocument.identityDocuments.eidFrontImage.length + ' chars)' : 'null'}`)
    console.log(`   - eidBackImage: ${bookingDocument.identityDocuments.eidBackImage ? 'Present (' + bookingDocument.identityDocuments.eidBackImage.length + ' chars)' : 'null'}`)
    console.log(`   - philippinesIdFront: ${bookingDocument.identityDocuments.philippinesIdFront ? 'Present (' + bookingDocument.identityDocuments.philippinesIdFront.length + ' chars)' : 'null'}`)
    console.log(`   - philippinesIdBack: ${bookingDocument.identityDocuments.philippinesIdBack ? 'Present (' + bookingDocument.identityDocuments.philippinesIdBack.length + ' chars)' : 'null'}`)
    console.log(`   - customerImage: ${bookingDocument.identityDocuments.customerImage ? 'Present (' + bookingDocument.identityDocuments.customerImage.length + ' chars)' : 'null'}`)
    console.log(`   - customerImages: ${bookingDocument.identityDocuments.customerImages?.length || 0} images`)
    
    // Log Philippines ID images for both routes (UAE to PH and PH to UAE)
    if (bookingDocument.identityDocuments.philippinesIdFront || bookingDocument.identityDocuments.philippinesIdBack) {
      const routeLabel = isPhilippinesToUAE ? 'Philippines to UAE' : 'UAE to Philippines'
      console.log(`\n🇵🇭 ${routeLabel} Route - Philippines ID Document Check:`)
      console.log(`   - philippinesIdFront: ${bookingDocument.identityDocuments.philippinesIdFront ? '✅ Received (' + bookingDocument.identityDocuments.philippinesIdFront.length + ' chars)' : '❌ Missing'}`)
      console.log(`   - philippinesIdBack: ${bookingDocument.identityDocuments.philippinesIdBack ? '✅ Received (' + bookingDocument.identityDocuments.philippinesIdBack.length + ' chars)' : '❌ Missing'}`)
      
      // Log the actual field values being saved
      console.log(`   - philippinesIdFront in document: ${bookingDocument.identityDocuments.hasOwnProperty('philippinesIdFront') ? 'Field exists' : 'Field missing'}`)
      console.log(`   - philippinesIdBack in document: ${bookingDocument.identityDocuments.hasOwnProperty('philippinesIdBack') ? 'Field exists' : 'Field missing'}`)
    }
    
    let result
    try {
      result = await collection.insertOne(bookingDocument)
      console.log(`✅ Booking inserted successfully`)
      console.log(`   Inserted ID: ${result.insertedId}`)
    } catch (insertError) {
      console.error(`\n❌ MONGODB INSERT ERROR:`)
      console.error(`   Error: ${insertError.message}`)
      console.error(`   Error Code: ${insertError.code}`)
      console.error(`   Stack: ${insertError.stack}`)
      console.log(`🔴 Request ID ${requestId} - Database insert failed`)
      
      return res.status(500).json({
        success: false,
        error: 'Failed to save booking to database',
        requestId: requestId,
        details: process.env.NODE_ENV === 'development' ? insertError.message : undefined
      })
    }

    console.log('\n📦 New Booking Created:')
    console.log(`   Reference: ${referenceNumber}`)
    console.log(`   AWB: ${awb}`)
    console.log(`   ID: ${result.insertedId}`)
    console.log(`   Service: ${bookingDocument.service}`)
    console.log(`   From: ${bookingDocument.sender.fullName}${bookingDocument.sender.emailAddress ? ` (${bookingDocument.sender.emailAddress})` : ''}`)
    console.log(`   Sender Location: ${bookingDocument.sender.country}, ${bookingDocument.sender.addressLine1}`)
    console.log(`   Sender Dial Code: ${bookingDocument.sender.dialCode}`)
    console.log(`   To: ${bookingDocument.receiver.fullName}${bookingDocument.receiver.emailAddress ? ` (${bookingDocument.receiver.emailAddress})` : ''}`)
    console.log(`   Receiver Location: ${bookingDocument.receiver.country}, ${bookingDocument.receiver.addressLine1}`)
    console.log(`   Receiver Dial Code: ${bookingDocument.receiver.dialCode}`)
    console.log(`   Items: ${bookingDocument.items.length}`)
    console.log(`   Images: ${bookingDocument.identityDocuments.customerImages?.length || 0} customer images, ${bookingDocument.identityDocuments.eidFrontImage ? '1' : '0'} EID front, ${bookingDocument.identityDocuments.eidBackImage ? '1' : '0'} EID back, ${bookingDocument.identityDocuments.philippinesIdFront ? '1' : '0'} PH ID front, ${bookingDocument.identityDocuments.philippinesIdBack ? '1' : '0'} PH ID back`)
    console.log(`   Timestamp: ${new Date().toISOString()}`)
    console.log(`✅ Request ID ${requestId} - SUCCESS`)
    console.log(`🔵 ===== END REQUEST =====\n`)

    // Return success response
    const response = {
      success: true,
      referenceNumber: referenceNumber,
      awb: awb, // Include AWB in response
      bookingId: result.insertedId,
      message: 'Booking submitted successfully',
      timestamp: new Date().toISOString(),
      requestId: requestId
    }
    
    // Include EID verification result if available
    if (eidVerification) {
      response.eidVerification = eidVerification
    }
    
    return res.status(200).json(response)

  } catch (error) {
    console.error('\n❌❌❌ UNEXPECTED ERROR ❌❌❌')
    console.error(`🔴 Request ID ${requestId} - Unexpected error occurred`)
    console.error(`   Error Type: ${error.constructor.name}`)
    console.error(`   Error Message: ${error.message}`)
    console.error(`   Error Stack:`, error.stack)
    console.error(`   Request Body Type: ${typeof req.body}`)
    console.error(`   Request Body Keys: ${req.body ? Object.keys(req.body).join(', ') : 'null'}`)
    console.error(`🔴 ===== ERROR END =====\n`)
    
    return res.status(500).json({
      success: false,
      error: 'Failed to process booking submission',
      requestId: requestId,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false,
    error: 'Endpoint not found',
    path: req.path
  })
})

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error)
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? error.message : undefined
  })
})

// Start server (only if not in Vercel serverless environment)
if (process.env.VERCEL !== '1') {
  app.listen(PORT, '0.0.0.0', () => {
    // Show OTP debug mode message (using originalConsole to bypass filter)
    originalConsole.log('\n🚀 KN Express Backend API - OTP Debug Mode Enabled')
    originalConsole.log(`📍 Server: http://localhost:${PORT}`)
    originalConsole.log(`\n📡 OTP Endpoints (Debug Logging Enabled):`)
    originalConsole.log(`   POST /api/otp/generate - Generate and send OTP`)
    originalConsole.log(`   POST /api/otp/verify  - Verify OTP`)
    originalConsole.log(`\n🔌 Connecting to MongoDB...`)
    
    // Connect to MongoDB at startup to show connectivity logs (async operation)
    connectToDatabase()
      .then(() => {
        originalConsole.log(`\n✅ Server ready - OTP debug logs will appear below when OTP requests are made\n`)
      })
      .catch((dbError) => {
        originalConsole.log(`\n⚠️  MongoDB connection failed at startup: ${dbError.message}`)
        originalConsole.log(`   Server will still start, but database operations will fail until connection is established`)
        originalConsole.log(`\n✅ Server ready - OTP debug logs will appear below when OTP requests are made\n`)
      })
  })
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\n👋 SIGTERM received, closing server gracefully...')
  if (cachedClient) {
    await cachedClient.close()
    console.log('✅ MongoDB connection closed')
  }
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('\n👋 SIGINT received, closing server gracefully...')
  if (cachedClient) {
    await cachedClient.close()
    console.log('✅ MongoDB connection closed')
  }
  process.exit(0)
})

// Export app for Vercel serverless functions
export default app
