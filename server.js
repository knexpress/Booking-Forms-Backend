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

    // Prepare booking document
    const bookingDocument = {
      referenceNumber: referenceNumber,
      service: bookingData.service || 'uae-to-pinas',
      sender: {
        fullName: bookingData.sender.fullName,
        completeAddress: bookingData.sender.completeAddress || '',
        contactNo: bookingData.sender.contactNo || '',
        emailAddress: bookingData.sender.emailAddress,
        agentName: bookingData.sender.agentName || ''
      },
      receiver: {
        fullName: bookingData.receiver.fullName,
        completeAddress: bookingData.receiver.completeAddress || '',
        contactNo: bookingData.receiver.contactNo || '',
        emailAddress: bookingData.receiver.emailAddress,
        deliveryOption: bookingData.receiver.deliveryOption || 'deliver'
      },
      items: bookingData.items,
      identityDocuments: {
        eidFrontImage: bookingData.eidFrontImage || null,
        eidBackImage: bookingData.eidBackImage || null,
        customerImage: bookingData.customerImage || null
      },
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
    console.log(`   From: ${bookingData.sender.fullName} (${bookingData.sender.emailAddress})`)
    console.log(`   To: ${bookingData.receiver.fullName} (${bookingData.receiver.emailAddress})`)
    console.log(`   Items: ${bookingData.items.length}`)
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
