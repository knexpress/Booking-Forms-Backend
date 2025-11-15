/**
 * Vercel Serverless Function
 * Handles booking submissions and saves to MongoDB
 */

import { MongoClient } from 'mongodb'

// MongoDB connection string from environment variable
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://evolutionaiexpert:DinxxfOoqTXN7oh5@aya.uixtazr.mongodb.net/?retryWrites=true&w=majority&appName=AYA'
const DB_NAME = 'finance'
const COLLECTION_NAME = 'bookings'

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
  const requestId = Date.now().toString(36)
  const timestamp = new Date().toISOString()
  
  console.log('\n🔵 ===== NEW API REQUEST (Vercel) =====')
  console.log(`📥 Request ID: ${requestId}`)
  console.log(`⏰ Timestamp: ${timestamp}`)
  console.log(`🌐 Method: ${req.method}`)
  console.log(`📍 URL: ${req.url || 'N/A'}`)
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    console.log(`✅ OPTIONS preflight request - returning 200`)
    console.log(`🔵 ===== END REQUEST =====\n`)
    res.status(200).end()
    return
  }

  // Only allow POST method
  if (req.method !== 'POST') {
    console.log(`❌ Invalid method: ${req.method}`)
    console.log(`🔴 Request ID ${requestId} - Method not allowed`)
    console.log(`🔵 ===== END REQUEST =====\n`)
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed',
      requestId: requestId
    })
  }

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

    // Validate booking data
    if (!bookingData.sender || !bookingData.receiver || !bookingData.items) {
      console.log(`\n❌ VALIDATION ERROR:`)
      console.log(`   - Missing sender: ${!bookingData.sender}`)
      console.log(`   - Missing receiver: ${!bookingData.receiver}`)
      console.log(`   - Missing items: ${!bookingData.items}`)
      console.log(`🔴 Request ID ${requestId} - Validation failed: Missing required booking information`)
      console.log(`🔵 ===== END REQUEST =====\n`)
      
      return res.status(400).json({
        success: false,
        error: 'Missing required booking information',
        requestId: requestId
      })
    }

    // Validate sender fields - last name is required, email is optional
    if (!bookingData.sender.lastName) {
      console.log(`\n❌ VALIDATION ERROR: Sender last name is required`)
      console.log(`   Sender data:`, JSON.stringify(bookingData.sender, null, 2))
      console.log(`🔴 Request ID ${requestId} - Validation failed: Sender last name missing`)
      console.log(`🔵 ===== END REQUEST =====\n`)
      
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
      console.log(`🔵 ===== END REQUEST =====\n`)
      
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
      console.log(`🔵 ===== END REQUEST =====\n`)
      
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
      console.log(`🔵 ===== END REQUEST =====\n`)
      
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
      console.log(`🔵 ===== END REQUEST =====\n`)
      
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
      console.log(`🔵 ===== END REQUEST =====\n`)
      
      return res.status(400).json({
        success: false,
        error: 'Receiver address line 1 must not exceed 200 characters',
        requestId: requestId
      })
    }
    
    console.log(`\n✅ All validations passed`)

    // Generate unique reference number
    const referenceNumber = 'KNX' + Date.now().toString(36).toUpperCase()
    
    // Determine route and set dial codes automatically
    const service = bookingData.service || 'uae-to-pinas'
    const serviceLower = service.toLowerCase()
    const isPhilippinesToUAE = serviceLower.includes('philippines-to-uae') || 
                                serviceLower.includes('pinas-to-uae') ||
                                serviceLower.includes('ph-to-uae')
    
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
      console.log(`🔵 ===== END REQUEST =====\n`)
      
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
        fullName: bookingData.sender?.fullName || '',
        firstName: bookingData.sender?.firstName || '',
        lastName: bookingData.sender?.lastName || '',
        emailAddress: bookingData.sender?.emailAddress || '',
        agentName: bookingData.sender?.agentName || '',
        
        // Address Information
        completeAddress: bookingData.sender?.completeAddress || null,
        country: bookingData.sender?.country || 'UNITED ARAB EMIRATES',
        // Deprecated fields (nullable)
        emirates: bookingData.sender?.emirates || null,
        city: bookingData.sender?.city || null,
        district: bookingData.sender?.district || null,
        zone: bookingData.sender?.zone || null,
        landmark: bookingData.sender?.landmark || null,
        // Active field (optional, max 200 chars)
        addressLine1: bookingData.sender?.addressLine1 || null,
        
        // Contact Information - dial code is automatically set based on route
        dialCode: senderDialCode,
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
        completeAddress: bookingData.receiver?.completeAddress || null,
        country: bookingData.receiver?.country || 'PHILIPPINES',
        // Deprecated fields (nullable)
        region: bookingData.receiver?.region || null,
        province: bookingData.receiver?.province || null,
        city: bookingData.receiver?.city || null,
        barangay: bookingData.receiver?.barangay || null,
        landmark: bookingData.receiver?.landmark || null,
        // Active field (optional, max 200 chars)
        addressLine1: bookingData.receiver?.addressLine1 || null,
        
        // Contact Information - dial code is automatically set based on route
        dialCode: receiverDialCode,
        phoneNumber: bookingData.receiver?.phoneNumber || '',
        contactNo: bookingData.receiver?.contactNo || '',
        
        // Delivery Options
        deliveryOption: bookingData.receiver?.deliveryOption || 'delivery'
      },
      
      // Items/Commodities
      items: bookingData.items || [],
      
      // Identity Verification Documents
      identityDocuments: {
        // UAE EID documents (for UAE routes)
        eidFrontImage: bookingData.eidFrontImage || null,
        eidBackImage: bookingData.eidBackImage || null,
        // Philippines ID documents (for Philippines to UAE route)
        // Only include if they have values (MongoDB omits null fields)
        ...(bookingData.philippinesIdFront && { philippinesIdFront: bookingData.philippinesIdFront }),
        ...(bookingData.philippinesIdBack && { philippinesIdBack: bookingData.philippinesIdBack }),
        // Customer face images
        customerImage: bookingData.customerImage || null,
        customerImages: bookingData.customerImages || (bookingData.customerImage ? [bookingData.customerImage] : [])
      },
      
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
      console.log(`🔵 ===== END REQUEST =====\n`)
      
      return res.status(500).json({
        success: false,
        error: 'Failed to save booking to database',
        requestId: requestId,
        details: process.env.NODE_ENV === 'development' ? insertError.message : undefined
      })
    }

    console.log('\n📦 Booking saved to MongoDB')
    console.log('   Reference:', referenceNumber)
    console.log('   ID:', result.insertedId)
    console.log('   Service:', bookingDocument.service)
    console.log('   Sender:', bookingDocument.sender.fullName)
    console.log('   Sender Location:', `${bookingDocument.sender.country}, ${bookingDocument.sender.addressLine1}`)
    console.log('   Sender Dial Code:', bookingDocument.sender.dialCode)
    console.log('   Receiver:', bookingDocument.receiver.fullName)
    console.log('   Receiver Location:', `${bookingDocument.receiver.country}, ${bookingDocument.receiver.addressLine1}`)
    console.log('   Receiver Dial Code:', bookingDocument.receiver.dialCode)
    console.log('   Items:', bookingDocument.items.length)
    console.log(`   Images: ${bookingDocument.identityDocuments.customerImages?.length || 0} customer images, ${bookingDocument.identityDocuments.eidFrontImage ? '1' : '0'} EID front, ${bookingDocument.identityDocuments.eidBackImage ? '1' : '0'} EID back, ${bookingDocument.identityDocuments.philippinesIdFront ? '1' : '0'} PH ID front, ${bookingDocument.identityDocuments.philippinesIdBack ? '1' : '0'} PH ID back`)
    console.log(`✅ Request ID ${requestId} - SUCCESS`)
    console.log(`🔵 ===== END REQUEST =====\n`)

    // Return success response
    return res.status(200).json({
      success: true,
      referenceNumber: referenceNumber,
      bookingId: result.insertedId,
      message: 'Booking submitted successfully',
      timestamp: new Date().toISOString(),
      requestId: requestId
    })

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
}

