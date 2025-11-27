/**
 * OTP Service
 * Handles OTP generation, SMS sending via SMSALA, and verification
 */

import axios from 'axios'
import dotenv from 'dotenv'

dotenv.config()

// SMSALA Configuration
const SMSALA_API_TOKEN = process.env.SMSALA_API_TOKEN
const SMSALA_SOURCE_ADDRESS = process.env.SMSALA_SOURCE_ADDRESS || 'KN EXPRESS'
const SMSALA_API_URL = 'https://api2.smsala.com/SendSmsV2'

// OTP Configuration
const OTP_LENGTH = 6
const OTP_EXPIRY_MINUTES = 5
const OTP_MAX_ATTEMPTS = 3

if (!SMSALA_API_TOKEN) {
  console.warn('⚠️  SMSALA_API_TOKEN not found in environment variables')
  console.warn('   Please set SMSALA_API_TOKEN in your .env file')
}

/**
 * Generate a random OTP
 * @param {number} length - Length of OTP (default: 6)
 * @returns {string} - Generated OTP
 */
export function generateOTP(length = OTP_LENGTH) {
  const digits = '0123456789'
  let otp = ''
  for (let i = 0; i < length; i++) {
    otp += digits.charAt(Math.floor(Math.random() * digits.length))
  }
  return otp
}

/**
 * Send OTP via SMSALA
 * @param {string} phoneNumber - Phone number with country code (e.g., +971501234567)
 * @param {string} otp - OTP to send
 * @returns {Promise<Object>} - SMS sending result
 */
export async function sendOTP(phoneNumber, otp) {
  try {
    if (!SMSALA_API_TOKEN) {
      throw new Error('SMSALA_API_TOKEN is not configured')
    }

    // Format phone number (remove + and spaces for SMSALA - they use format without +)
    let formattedPhone = phoneNumber.trim().replace(/\s+/g, '').replace(/^\+/, '')
    
    // Validate phone number has country code
    if (formattedPhone.length < 10) {
      throw new Error('Invalid phone number format')
    }

    // OTP message
    const message = `Your OTP is ${otp}. Valid for ${OTP_EXPIRY_MINUTES} minutes.`

    console.log(`📤 Sending OTP via SMSALA...`)
    console.log(`   Phone: ${formattedPhone}`)
    console.log(`   Source: ${SMSALA_SOURCE_ADDRESS}`)
    console.log(`   Message Type: 3 (OTP)`)

    // SMSALA API Request - POST requires an array of objects
    const requestData = [{
      apiToken: SMSALA_API_TOKEN,
      messageType: "3", // OTP type (as string)
      messageEncoding: "1", // ASCII encoding
      destinationAddress: formattedPhone, // Without + prefix
      sourceAddress: SMSALA_SOURCE_ADDRESS,
      messageText: message
    }]

    console.log(`📤 Request Payload:`, JSON.stringify(requestData, null, 2))

    const response = await axios.post(SMSALA_API_URL, requestData, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10 second timeout
    })

    console.log(`✅ SMSALA Response:`, JSON.stringify(response.data, null, 2))

    // SMSALA returns an array of responses
    if (Array.isArray(response.data) && response.data.length > 0) {
      const smsResult = response.data[0]
      
      // Check if SMS was sent successfully
      if (smsResult.Status === 'Success' || smsResult.OperationCode === 0) {
        return {
          success: true,
          messageId: smsResult.MessageId || null,
          message: 'OTP sent successfully',
          smsalaResponse: smsResult
        }
      } else {
        throw new Error(smsResult.Remarks || 'Failed to send OTP via SMSALA')
      }
    } else {
      throw new Error('Invalid response format from SMSALA')
    }

  } catch (error) {
    console.error('❌ SMSALA Error:', error.message)
    if (error.response) {
      console.error('   Status:', error.response.status)
      console.error('   Data:', error.response.data)
    }
    throw new Error(`Failed to send OTP: ${error.message}`)
  }
}

/**
 * Calculate OTP expiry timestamp
 * @returns {Date} - Expiry date
 */
export function getOTPExpiry() {
  const expiry = new Date()
  expiry.setMinutes(expiry.getMinutes() + OTP_EXPIRY_MINUTES)
  return expiry
}

/**
 * Check if OTP is expired
 * @param {Date} expiryDate - Expiry date
 * @returns {boolean} - True if expired
 */
export function isOTPExpired(expiryDate) {
  return new Date() > new Date(expiryDate)
}

/**
 * Get OTP configuration constants
 */
export function getOTPConfig() {
  return {
    length: OTP_LENGTH,
    expiryMinutes: OTP_EXPIRY_MINUTES,
    maxAttempts: OTP_MAX_ATTEMPTS
  }
}

