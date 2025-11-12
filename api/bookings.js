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

    // Prepare booking document with all detailed fields
    const bookingDocument = {
      referenceNumber: referenceNumber,
      service: bookingData.service || 'uae-to-pinas',
      
      // Sender Details - Complete breakdown
      sender: {
        // Personal Information
        fullName: bookingData.sender?.fullName || '',
        firstName: bookingData.sender?.firstName || '',
        lastName: bookingData.sender?.lastName || '',
        emailAddress: bookingData.sender?.emailAddress || '',
        agentName: bookingData.sender?.agentName || '',
        
        // Address Information
        completeAddress: bookingData.sender?.completeAddress || '',
        country: bookingData.sender?.country || 'UNITED ARAB EMIRATES',
        emirates: bookingData.sender?.emirates || '',
        city: bookingData.sender?.city || '',
        district: bookingData.sender?.district || '',
        zone: bookingData.sender?.zone || '',
        addressLine1: bookingData.sender?.addressLine1 || '',
        landmark: bookingData.sender?.landmark || '',
        
        // Contact Information
        dialCode: bookingData.sender?.dialCode || '+971',
        phoneNumber: bookingData.sender?.phoneNumber || '',
        contactNo: bookingData.sender?.contactNo || '',
        
        // Delivery Options
        deliveryOption: bookingData.sender?.deliveryOption || 'warehouse'
      },
      
      // Receiver Details - Complete breakdown
      receiver: {
        // Personal Information
        fullName: bookingData.receiver?.fullName || '',
        firstName: bookingData.receiver?.firstName || '',
        lastName: bookingData.receiver?.lastName || '',
        emailAddress: bookingData.receiver?.emailAddress || '',
        
        // Address Information
        completeAddress: bookingData.receiver?.completeAddress || '',
        country: bookingData.receiver?.country || 'PHILIPPINES',
        region: bookingData.receiver?.region || '',
        province: bookingData.receiver?.province || '',
        city: bookingData.receiver?.city || '',
        barangay: bookingData.receiver?.barangay || '',
        addressLine1: bookingData.receiver?.addressLine1 || '',
        landmark: bookingData.receiver?.landmark || '',
        
        // Contact Information
        dialCode: bookingData.receiver?.dialCode || '+63',
        phoneNumber: bookingData.receiver?.phoneNumber || '',
        contactNo: bookingData.receiver?.contactNo || '',
        
        // Delivery Options
        deliveryOption: bookingData.receiver?.deliveryOption || 'delivery'
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
        customerImage: bookingData.customerImage || null,
        customerImages: bookingData.customerImages || (bookingData.customerImage ? [bookingData.customerImage] : [])
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

    console.log('📦 Booking saved to MongoDB')
    console.log('   Reference:', referenceNumber)
    console.log('   ID:', result.insertedId)
    console.log('   Service:', bookingDocument.service)
    console.log('   Sender:', bookingDocument.sender.fullName)
    console.log('   Sender Location:', `${bookingDocument.sender.emirates}, ${bookingDocument.sender.city}, ${bookingDocument.sender.district}`)
    console.log('   Receiver:', bookingDocument.receiver.fullName)
    console.log('   Receiver Location:', `${bookingDocument.receiver.region}, ${bookingDocument.receiver.province}, ${bookingDocument.receiver.city}, ${bookingDocument.receiver.barangay}`)
    console.log('   Items:', bookingDocument.items.length)
    console.log('   Payment Method:', bookingDocument.additionalDetails.paymentMethod)

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

