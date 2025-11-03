/**
 * Vercel Serverless Function
 * Handles booking submissions and saves to MongoDB
 */

import { MongoClient } from 'mongodb'

// MongoDB connection string from environment variable
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://evolutionaiexpert:DinxxfOoqTXN7oh5@aya.uixtazr.mongodb.net/?retryWrites=true&w=majority&appName=AYA'
const DB_NAME = 'AYA'
const COLLECTION_NAME = 'BOOKING-DATA'

let cachedClient = null

async function connectToDatabase() {
  if (cachedClient) {
    return cachedClient
  }

  const client = new MongoClient(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })

  await client.connect()
  cachedClient = client
  
  console.log('✅ Connected to MongoDB')
  return client
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  // Only allow POST method
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    })
  }

  try {
    const bookingData = req.body

    // Validate booking data
    if (!bookingData.sender || !bookingData.receiver || !bookingData.items) {
      return res.status(400).json({
        success: false,
        error: 'Missing required booking information'
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
      sender: bookingData.sender,
      receiver: bookingData.receiver,
      items: bookingData.items,
      termsAccepted: bookingData.termsAccepted || false,
      submittedAt: new Date(),
      submissionTimestamp: bookingData.submissionTimestamp || new Date().toISOString(),
      status: 'pending',
      source: 'web'
    }

    // Insert into MongoDB
    const result = await collection.insertOne(bookingDocument)

    console.log('📦 Booking saved to MongoDB')
    console.log('   Reference:', referenceNumber)
    console.log('   ID:', result.insertedId)
    console.log('   Sender:', bookingData.sender.fullName)
    console.log('   Receiver:', bookingData.receiver.fullName)
    console.log('   Items:', bookingData.items.length)

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
}

