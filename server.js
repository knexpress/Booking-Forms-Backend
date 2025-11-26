/**
 * KN Express Backend API
 * Express server with MongoDB integration
 * Deploy to: Render.com, Railway.app, Heroku, etc.
 */

import express from 'express'
import cors from 'cors'
import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'
import { processEmiratesID } from './services/longcat-ocr.js'
import { extractNameFromText, normalizeName, compareNames } from './services/openai-ocr.js'

// Load environment variables
dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

// MongoDB configuration
const MONGODB_URI = process.env.MONGODB_URI
const DB_NAME = 'finance'
const COLLECTION_NAME = 'bookings'

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI environment variable is not set')
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
    
    console.log('✅ Connected to MongoDB')
    console.log(`   Database: ${DB_NAME}`)
    console.log(`   Collection: ${COLLECTION_NAME}`)
    
    return client
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message)
    throw error
  }
}

// Middleware - CORS configuration
app.use(cors({
  origin: '*', // Allow all origins (for development)
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'X-Request-Id']
}))
// Note: CORS middleware automatically handles OPTIONS preflight requests

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

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
      ocr: 'POST /api/ocr'
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

// OCR endpoint for Emirates ID detection using OpenAI Vision API
app.post('/api/ocr', async (req, res) => {
  const requestId = Date.now().toString(36)
  const timestamp = new Date().toISOString()
  
  console.log('\n🔵 ===== OCR REQUEST =====')
  console.log(`📥 Request ID: ${requestId}`)
  console.log(`⏰ Timestamp: ${timestamp}`)
  
  try {
    const { image, firstName, lastName } = req.body
    
    if (!image) {
      console.log(`❌ Validation failed: Image is required`)
      return res.status(400).json({
        success: false,
        error: 'Image is required (base64 string)',
        requestId: requestId
      })
    }

    console.log(`📸 Image received (${image.length} characters)`)
    if (firstName && lastName) {
      console.log(`👤 Name provided for verification:`)
      console.log(`   First Name: ${firstName}`)
      console.log(`   Last Name: ${lastName}`)
    }
    
    // Process the image for Emirates ID identification
    const result = await processEmiratesID(image)
    
    if (!result.success) {
      console.log(`❌ OCR processing failed: ${result.error}`)
      return res.status(500).json({
        success: false,
        error: result.error || 'Failed to process image',
        requestId: requestId
      })
    }

    const { identification, extractedText, extractedName, requiresBackSide } = result

    console.log(`\n📝 Extracted Text Preview (first 500 chars):`)
    if (extractedText && typeof extractedText === 'string') {
      console.log(`   ${extractedText.substring(0, 500)}${extractedText.length > 500 ? '...' : ''}`)
    } else {
      console.log(`   (No text extracted)`)
    }
    
    console.log(`\n🔍 Identification Result:`)
    console.log(`   - Is Emirates ID: ${identification.isEmiratesID}`)
    console.log(`   - Side: ${identification.side}`)
    console.log(`   - Confidence: ${(identification.confidence * 100).toFixed(0)}%`)
    console.log(`   - Reason: ${identification.reason}`)
    console.log(`   - Requires Back Side: ${requiresBackSide}`)
    if (extractedName) {
      console.log(`   - Extracted Name: ${extractedName}`)
    }

    // If it's not an Emirates ID, return false
    if (!identification.isEmiratesID) {
      console.log(`❌ Not an Emirates ID - returning false`)
      return res.status(200).json({
        success: true,
        isEmiratesID: false,
        message: 'Image is not an Emirates ID',
        identification: identification,
        requestId: requestId,
        timestamp: timestamp
      })
    }

    // Name verification if firstName and lastName are provided
    let nameVerification = null
    if (firstName && lastName && typeof firstName === 'string' && typeof lastName === 'string' && firstName.trim() && lastName.trim() && extractedName) {
      console.log(`\n🔍 Starting name verification...`)
      console.log(`   Extracted Name: ${extractedName}`)
      console.log(`   Provided First Name: ${firstName}`)
      console.log(`   Provided Last Name: ${lastName}`)
      
      // Normalize names for comparison
      const normalizedExtracted = normalizeName(extractedName)
      const normalizedFirst = normalizeName(firstName)
      const normalizedLast = normalizeName(lastName)
      
      // Split extracted name into words
      const extractedWords = normalizedExtracted.split(' ').filter(w => w.length > 0)
      
      // Check if first name appears in extracted name
      const firstNameMatches = extractedWords.some(word => word === normalizedFirst)
      
      // Check if last name appears in extracted name
      const lastNameMatches = extractedWords.some(word => word === normalizedLast)
      
      const nameMatch = firstNameMatches && lastNameMatches
      
      nameVerification = {
        nameMatch: nameMatch,
        extractedName: extractedName,
        providedFirstName: firstName,
        providedLastName: lastName,
        firstNameFound: firstNameMatches,
        lastNameFound: lastNameMatches,
        message: nameMatch 
          ? 'Name matches Emirates ID' 
          : 'Name on Emirates ID does not match provided name'
      }
      
      console.log(`   ✅ Name Verification Result:`)
      console.log(`      - First Name Found: ${firstNameMatches}`)
      console.log(`      - Last Name Found: ${lastNameMatches}`)
      console.log(`      - Overall Match: ${nameMatch}`)
      console.log(`      - Message: ${nameVerification.message}`)
      
      // If names don't match, reject the request
      if (!nameMatch) {
        console.log(`❌ Name verification failed - names do not match`)
        return res.status(400).json({
          success: false,
          error: 'Name on Emirates ID does not match the provided name. Please ensure the Emirates ID belongs to the correct person.',
          requestId: requestId,
          nameVerification: nameVerification,
          identification: identification
        })
      }
    } else if (firstName && lastName && !extractedName) {
      console.log(`⚠️  Name verification requested but could not extract name from EID`)
      return res.status(400).json({
        success: false,
        error: 'Could not extract name from Emirates ID. Please ensure the image is clear and the name is visible.',
        requestId: requestId,
        identification: identification
      })
    }

    // If it's the front side, indicate that back side is required
    if (requiresBackSide) {
      console.log(`✅ Front side detected - back side required`)
      return res.status(200).json({
        success: true,
        isEmiratesID: true,
        side: 'front',
        requiresBackSide: true,
        message: 'Emirates ID front side detected. Please send the back side image.',
        identification: identification,
        extractedText: extractedText.substring(0, 500), // Return first 500 chars for debugging
        extractedName: extractedName || null,
        nameVerification: nameVerification,
        requestId: requestId,
        timestamp: timestamp
      })
    }

    // If it's the back side
    if (identification.side === 'back') {
      console.log(`✅ Back side detected`)
      return res.status(200).json({
        success: true,
        isEmiratesID: true,
        side: 'back',
        requiresBackSide: false,
        message: 'Emirates ID back side detected.',
        identification: identification,
        extractedText: extractedText.substring(0, 500), // Return first 500 chars for debugging
        extractedName: extractedName || null,
        nameVerification: nameVerification,
        requestId: requestId,
        timestamp: timestamp
      })
    }

    // Unknown side but confirmed Emirates ID
    console.log(`✅ Emirates ID detected but side unknown`)
    return res.status(200).json({
      success: true,
      isEmiratesID: true,
      side: identification.side,
      requiresBackSide: false,
      message: 'Emirates ID detected but side could not be determined.',
      identification: identification,
      extractedText: extractedText.substring(0, 500),
      extractedName: extractedName || null,
      nameVerification: nameVerification,
      requestId: requestId,
      timestamp: timestamp
    })

  } catch (error) {
    console.error('\n❌❌❌ OCR ERROR ❌❌❌')
    console.error(`🔴 Request ID ${requestId} - Error occurred`)
    console.error(`   Error Type: ${error.constructor.name}`)
    console.error(`   Error Message: ${error.message}`)
    console.error(`   Error Stack:`, error.stack)
    console.error(`🔴 ===== ERROR END =====\n`)
    
    return res.status(500).json({
      success: false,
      error: 'Failed to process OCR request',
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
      if (bookingData.sender.formFillerLatitude !== undefined && bookingData.sender.formFillerLongitude !== undefined) {
        console.log(`   - Form Filler Location: ${bookingData.sender.formFillerLatitude}, ${bookingData.sender.formFillerLongitude}`)
      } else {
        console.log(`   - Form Filler Location: not provided (user may have denied permission)`)
      }
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

    // Validate form filler location coordinates (optional, but if provided must be valid and both together)
    if (bookingData.sender.formFillerLatitude !== undefined || bookingData.sender.formFillerLongitude !== undefined) {
      // Check if both are provided together
      if (bookingData.sender.formFillerLatitude === undefined || bookingData.sender.formFillerLongitude === undefined) {
        console.log(`\n❌ VALIDATION ERROR: Form filler location coordinates must be provided together`)
        console.log(`   formFillerLatitude: ${bookingData.sender.formFillerLatitude !== undefined ? 'provided' : 'missing'}`)
        console.log(`   formFillerLongitude: ${bookingData.sender.formFillerLongitude !== undefined ? 'provided' : 'missing'}`)
        console.log(`🔴 Request ID ${requestId} - Validation failed: Both latitude and longitude must be provided together`)
        
        return res.status(400).json({
          success: false,
          error: 'Both formFillerLatitude and formFillerLongitude must be provided together',
          requestId: requestId
        })
      }

      // Validate latitude range (-90 to 90)
      if (typeof bookingData.sender.formFillerLatitude !== 'number' || 
          bookingData.sender.formFillerLatitude < -90 || 
          bookingData.sender.formFillerLatitude > 90) {
        console.log(`\n❌ VALIDATION ERROR: Invalid form filler latitude`)
        console.log(`   Latitude: ${bookingData.sender.formFillerLatitude}`)
        console.log(`   Type: ${typeof bookingData.sender.formFillerLatitude}`)
        console.log(`🔴 Request ID ${requestId} - Validation failed: Latitude must be a number between -90 and 90`)
        
        return res.status(400).json({
          success: false,
          error: 'formFillerLatitude must be a number between -90 and 90',
          requestId: requestId
        })
      }

      // Validate longitude range (-180 to 180)
      if (typeof bookingData.sender.formFillerLongitude !== 'number' || 
          bookingData.sender.formFillerLongitude < -180 || 
          bookingData.sender.formFillerLongitude > 180) {
        console.log(`\n❌ VALIDATION ERROR: Invalid form filler longitude`)
        console.log(`   Longitude: ${bookingData.sender.formFillerLongitude}`)
        console.log(`   Type: ${typeof bookingData.sender.formFillerLongitude}`)
        console.log(`🔴 Request ID ${requestId} - Validation failed: Longitude must be a number between -180 and 180`)
        
        return res.status(400).json({
          success: false,
          error: 'formFillerLongitude must be a number between -180 and 180',
          requestId: requestId
        })
      }
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
    
    console.log(`\n✅ All validations passed`)

    // Determine route and set dial codes automatically (needed for EID name logic)
    const service = bookingData.service || 'uae-to-pinas'
    const serviceLower = service.toLowerCase()
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

    // EID Name Verification (if EID front image is provided)
    let eidVerification = null
    if (bookingData.eidFrontImage && eidFirstName && eidLastName) {
      console.log(`\n🔍 Starting EID name verification...`)
      console.log(`   Using First Name: ${eidFirstName}`)
      console.log(`   Using Last Name: ${eidLastName}`)
      
      try {
        // Process Emirates ID to extract name
        const eidResult = await processEmiratesID(bookingData.eidFrontImage)
        
        if (eidResult.success && eidResult.identification.isEmiratesID) {
          // Get extracted name from OCR result or try to extract from text
          let extractedName = eidResult.extractedName
          
          // If name not extracted by OpenAI, try to extract from text
          if (!extractedName && eidResult.extractedText) {
            extractedName = extractNameFromText(eidResult.extractedText)
          }
          
          if (extractedName) {
            console.log(`   Extracted Name from EID: ${extractedName}`)
            
            // Compare names
            const matchResult = compareNames(
              extractedName,
              eidFirstName,
              eidLastName
            )
            
            eidVerification = {
              isEmiratesId: true,
              nameMatch: matchResult.matches,
              nameMatchConfidence: matchResult.confidence,
              extractedName: extractedName,
              providedFirstName: eidFirstName,
              providedLastName: eidLastName,
              verificationMessage: matchResult.message
            }
            
            console.log(`   ✅ Name Verification Result:`)
            console.log(`      - Match: ${matchResult.matches}`)
            console.log(`      - Confidence: ${(matchResult.confidence * 100).toFixed(0)}%`)
            console.log(`      - Message: ${matchResult.message}`)
          } else {
            console.log(`   ⚠️  Could not extract name from Emirates ID`)
            eidVerification = {
              isEmiratesId: true,
              nameMatch: null,
              nameMatchConfidence: null,
              extractedName: null,
              providedFirstName: eidFirstName,
              providedLastName: eidLastName,
              verificationMessage: 'Could not extract name from Emirates ID. Manual review required.'
            }
          }
        } else {
          console.log(`   ⚠️  Image is not a valid Emirates ID`)
          eidVerification = {
            isEmiratesId: false,
            nameMatch: false,
            nameMatchConfidence: 0,
            extractedName: null,
            providedFirstName: eidFirstName,
            providedLastName: eidLastName,
            verificationMessage: 'Image is not a valid Emirates ID. Manual review required.'
          }
        }
      } catch (verificationError) {
        console.error(`   ❌ EID verification error: ${verificationError.message}`)
        eidVerification = {
          isEmiratesId: null,
          nameMatch: null,
          nameMatchConfidence: null,
          extractedName: null,
          providedFirstName: eidFirstName,
          providedLastName: eidLastName,
          verificationMessage: `Error verifying Emirates ID name: ${verificationError.message}`
        }
      }
    } else if (bookingData.eidFrontImage) {
      console.log(`\n⚠️  EID front image provided but name fields missing - skipping name verification`)
      console.log(`   Service: ${service}`)
      console.log(`   Is PH to UAE: ${isPhilippinesToUAE}`)
      console.log(`   eidFrontImageFirstName: ${bookingData.eidFrontImageFirstName || 'missing'}`)
      console.log(`   eidFrontImageLastName: ${bookingData.eidFrontImageLastName || 'missing'}`)
      if (isPhilippinesToUAE) {
        console.log(`   Receiver firstName: ${bookingData.receiver?.firstName || 'missing'}`)
        console.log(`   Receiver lastName: ${bookingData.receiver?.lastName || 'missing'}`)
      } else {
        console.log(`   Sender firstName: ${bookingData.sender?.firstName || 'missing'}`)
        console.log(`   Sender lastName: ${bookingData.sender?.lastName || 'missing'}`)
      }
    }

    // Validate EID verification result - reject booking if names don't match
    if (eidVerification) {
      // Reject if EID is not valid
      if (eidVerification.isEmiratesId === false) {
        console.log(`\n❌ VALIDATION ERROR: Image is not a valid Emirates ID`)
        console.log(`🔴 Request ID ${requestId} - EID validation failed`)
        
        return res.status(400).json({
          success: false,
          error: 'The provided image is not a valid Emirates ID. Please upload a valid Emirates ID front image.',
          requestId: requestId,
          eidVerification: eidVerification
        })
      }
      
      // Reject if names don't match (with low confidence threshold)
      if (eidVerification.nameMatch === false && eidVerification.nameMatchConfidence !== null) {
        const confidenceThreshold = 0.6 // Reject if confidence below 60%
        
        if (eidVerification.nameMatchConfidence < confidenceThreshold) {
          console.log(`\n❌ VALIDATION ERROR: Name on Emirates ID does not match provided name`)
          console.log(`   Extracted Name: ${eidVerification.extractedName}`)
          console.log(`   Provided Name: ${eidVerification.providedFirstName} ${eidVerification.providedLastName}`)
          console.log(`   Confidence: ${(eidVerification.nameMatchConfidence * 100).toFixed(0)}%`)
          console.log(`🔴 Request ID ${requestId} - Name verification failed`)
          
          return res.status(400).json({
            success: false,
            error: 'Name on Emirates ID does not match the provided name. Please ensure the Emirates ID belongs to the correct person.',
            requestId: requestId,
            eidVerification: eidVerification
          })
        }
      }
      
      // Warn if name match is null (could not extract name) but allow with manual review flag
      if (eidVerification.nameMatch === null) {
        console.log(`\n⚠️  WARNING: Could not verify name from Emirates ID - booking will proceed but requires manual review`)
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

    // Prepare booking document with all detailed fields
    const bookingDocument = {
      referenceNumber: referenceNumber,
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
        
        // Form Filler Location (optional - from browser geolocation)
        ...(bookingData.sender.formFillerLatitude !== undefined && bookingData.sender.formFillerLongitude !== undefined ? {
          formFillerLatitude: bookingData.sender.formFillerLatitude,
          formFillerLongitude: bookingData.sender.formFillerLongitude
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
        // Philippines ID documents (for Philippines to UAE route)
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
          nameMatch: eidVerification.nameMatch,
          nameMatchConfidence: eidVerification.nameMatchConfidence,
          extractedName: eidVerification.extractedName,
          verificationMessage: eidVerification.verificationMessage
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
    console.log(`\n📄 Identity Documents being saved:`)
    console.log(`   - eidFrontImage: ${bookingDocument.identityDocuments.eidFrontImage ? 'Present (' + bookingDocument.identityDocuments.eidFrontImage.length + ' chars)' : 'null'}`)
    console.log(`   - eidBackImage: ${bookingDocument.identityDocuments.eidBackImage ? 'Present (' + bookingDocument.identityDocuments.eidBackImage.length + ' chars)' : 'null'}`)
    console.log(`   - philippinesIdFront: ${bookingDocument.identityDocuments.philippinesIdFront ? 'Present (' + bookingDocument.identityDocuments.philippinesIdFront.length + ' chars)' : 'null'}`)
    console.log(`   - philippinesIdBack: ${bookingDocument.identityDocuments.philippinesIdBack ? 'Present (' + bookingDocument.identityDocuments.philippinesIdBack.length + ' chars)' : 'null'}`)
    console.log(`   - customerImage: ${bookingDocument.identityDocuments.customerImage ? 'Present (' + bookingDocument.identityDocuments.customerImage.length + ' chars)' : 'null'}`)
    console.log(`   - customerImages: ${bookingDocument.identityDocuments.customerImages?.length || 0} images`)
    
    // Verify Philippines ID images for ph-to-uae route
    if (isPhilippinesToUAE) {
      console.log(`\n🇵🇭 Philippines to UAE Route - ID Document Check:`)
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
    console.log('\n🚀 KN Express Backend API')
    console.log(`📍 Server: http://localhost:${PORT}`)
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`)
    console.log(`\n📡 Endpoints:`)
    console.log(`   GET  /health          - Health check`)
    console.log(`   GET  /api             - API info`)
    console.log(`   POST /api/bookings    - Submit booking`)
    console.log(`   POST /api/ocr         - OCR for Emirates ID detection`)
    console.log(`\n✅ Server ready and listening on 0.0.0.0:${PORT}`)
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
