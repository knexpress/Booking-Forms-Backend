/**
 * KN Express Backend API
 * Express server with MongoDB integration
 * Deploy to: Render.com, Railway.app, Heroku, etc.
 */

import express from 'express'
import cors from 'cors'
import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'

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

// Middleware
app.use(cors({
  origin: '*', // In production, replace with your frontend URL
  credentials: true
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

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
      bookings: 'POST /api/bookings'
    }
  })
})

// Bookings endpoint
app.post('/api/bookings', async (req, res) => {
  try {
    const bookingData = req.body

    // Validate required fields
    if (!bookingData.sender || !bookingData.receiver || !bookingData.items) {
      return res.status(400).json({
        success: false,
        error: 'Missing required booking information (sender, receiver, items)'
      })
    }

    // Validate sender fields
    if (!bookingData.sender.fullName || !bookingData.sender.emailAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required sender information'
      })
    }

    // Validate receiver fields
    if (!bookingData.receiver.fullName || !bookingData.receiver.emailAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required receiver information'
      })
    }

    // Validate items
    if (!Array.isArray(bookingData.items) || bookingData.items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one item is required'
      })
    }

    // Generate unique reference number
    const referenceNumber = 'KNX' + Date.now().toString(36).toUpperCase()
    
    // Connect to MongoDB
    const client = await connectToDatabase()
    const db = client.db(DB_NAME)
    const collection = db.collection(COLLECTION_NAME)

    // Prepare booking document with all detailed fields
    const bookingDocument = {
      referenceNumber: referenceNumber,
      service: bookingData.service || 'uae-to-pinas',
      
      // Sender Details - Complete breakdown
      sender: {
        // Personal Information
        fullName: bookingData.sender.fullName || '',
        firstName: bookingData.sender.firstName || '',
        lastName: bookingData.sender.lastName || '',
        emailAddress: bookingData.sender.emailAddress || '',
        agentName: bookingData.sender.agentName || '',
        
        // Address Information
        completeAddress: bookingData.sender.completeAddress || '',
        country: bookingData.sender.country || 'UNITED ARAB EMIRATES',
        emirates: bookingData.sender.emirates || '',
        city: bookingData.sender.city || '',
        district: bookingData.sender.district || '',
        zone: bookingData.sender.zone || '',
        addressLine1: bookingData.sender.addressLine1 || '',
        landmark: bookingData.sender.landmark || '',
        
        // Contact Information
        dialCode: bookingData.sender.dialCode || '+971',
        phoneNumber: bookingData.sender.phoneNumber || '',
        contactNo: bookingData.sender.contactNo || '',
        
        // Delivery Options
        deliveryOption: bookingData.sender.deliveryOption || 'warehouse'
      },
      
      // Receiver Details - Complete breakdown
      receiver: {
        // Personal Information
        fullName: bookingData.receiver.fullName || '',
        firstName: bookingData.receiver.firstName || '',
        lastName: bookingData.receiver.lastName || '',
        emailAddress: bookingData.receiver.emailAddress || '',
        
        // Address Information
        completeAddress: bookingData.receiver.completeAddress || '',
        country: bookingData.receiver.country || 'PHILIPPINES',
        region: bookingData.receiver.region || '',
        province: bookingData.receiver.province || '',
        city: bookingData.receiver.city || '',
        barangay: bookingData.receiver.barangay || '',
        addressLine1: bookingData.receiver.addressLine1 || '',
        landmark: bookingData.receiver.landmark || '',
        
        // Contact Information
        dialCode: bookingData.receiver.dialCode || '+63',
        phoneNumber: bookingData.receiver.phoneNumber || '',
        contactNo: bookingData.receiver.contactNo || '',
        
        // Delivery Options
        deliveryOption: bookingData.receiver.deliveryOption || 'delivery'
      },
      
      // Items/Commodities
      items: bookingData.items || [],
      
      // Additional Details
      additionalDetails: {
        paymentMethod: bookingData.additionalDetails?.paymentMethod || 'cash',
        email: bookingData.additionalDetails?.email || '',
        additionalInstructions: bookingData.additionalDetails?.additionalInstructions || ''
      },
      
      // Identity Verification Documents
      identityDocuments: {
        eidFrontImage: bookingData.eidFrontImage || null,
        eidBackImage: bookingData.eidBackImage || null,
        customerImage: bookingData.customerImage || null, // Single image for backward compatibility
        customerImages: bookingData.customerImages || (bookingData.customerImage ? [bookingData.customerImage] : []) // All face images
      },
      
      // Terms and Status
      termsAccepted: bookingData.termsAccepted || false,
      submittedAt: new Date(),
      submissionTimestamp: bookingData.submissionTimestamp || new Date().toISOString(),
      status: 'pending',
      source: 'web'
    }

    // Insert into MongoDB
    const result = await collection.insertOne(bookingDocument)

    console.log('📦 New Booking Created:')
    console.log(`   Reference: ${referenceNumber}`)
    console.log(`   ID: ${result.insertedId}`)
    console.log(`   Service: ${bookingDocument.service}`)
    console.log(`   From: ${bookingDocument.sender.fullName} (${bookingDocument.sender.emailAddress})`)
    console.log(`   Sender Location: ${bookingDocument.sender.emirates}, ${bookingDocument.sender.city}, ${bookingDocument.sender.district}`)
    console.log(`   To: ${bookingDocument.receiver.fullName} (${bookingDocument.receiver.emailAddress})`)
    console.log(`   Receiver Location: ${bookingDocument.receiver.region}, ${bookingDocument.receiver.province}, ${bookingDocument.receiver.city}, ${bookingDocument.receiver.barangay}`)
    console.log(`   Items: ${bookingDocument.items.length}`)
    console.log(`   Payment Method: ${bookingDocument.additionalDetails.paymentMethod}`)
    console.log(`   Timestamp: ${new Date().toISOString()}`)

    // Return success response
    return res.status(200).json({
      success: true,
      referenceNumber: referenceNumber,
      bookingId: result.insertedId,
      message: 'Booking submitted successfully',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Booking submission error:', error)
    
    return res.status(500).json({
      success: false,
      error: 'Failed to process booking submission',
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

// Start server
app.listen(PORT, () => {
  console.log('\n🚀 KN Express Backend API')
  console.log(`📍 Server: http://localhost:${PORT}`)
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`\n📡 Endpoints:`)
  console.log(`   GET  /health          - Health check`)
  console.log(`   GET  /api             - API info`)
  console.log(`   POST /api/bookings    - Submit booking`)
  console.log(`\n✅ Server ready and listening...`)
})

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

export default app
