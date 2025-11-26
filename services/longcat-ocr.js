/**
 * OCR Service
 * Handles image OCR processing using OpenAI Vision API (ChatGPT)
 * Identifies Emirates ID front/back sides
 */

import { extractTextAndIdentify as openaiExtract } from './openai-ocr.js'

// Re-export for use in processEmiratesID
export { openaiExtract }
import dotenv from 'dotenv'

dotenv.config()

console.log(`🤖 Using OpenAI Vision API for OCR and Emirates ID identification`)

/**
 * Extract text from image using OpenAI Vision
 * @param {string} imageBase64 - Base64 encoded image (with or without data URL prefix)
 * @returns {Promise<string>} - Extracted text from the image
 */
export async function extractTextFromImage(imageBase64) {
  try {
    console.log('🔍 Starting OpenAI Vision OCR extraction...')
    
    // Extract text and get identification using OpenAI
    const result = await openaiExtract(imageBase64)
    
    console.log(`✅ OCR extraction completed (${result.text.length} characters)`)
    return result.text

  } catch (error) {
    console.error('❌ OpenAI Vision OCR error:', error.message)
    console.error('\n💡 Troubleshooting:')
    console.error('   1. Ensure OPENAI_API_KEY is set in .env file')
    console.error('   2. Check your OpenAI API key is valid and has credits')
    console.error('   3. Verify you have access to GPT-4 Vision models')
    throw new Error(`OCR extraction failed: ${error.message}`)
  }
}

/**
 * Identify if the extracted text is from an Emirates ID
 * Uses OpenAI's identification if available, otherwise falls back to pattern matching
 * @param {string} extractedText - Text extracted from the image
 * @param {Object} openaiResult - Result from OpenAI if available
 * @returns {Object} - { isEmiratesID: boolean, side: 'front' | 'back' | 'unknown', confidence: number }
 */
export function identifyEmiratesID(extractedText, openaiResult = null) {
  // If OpenAI already identified it, use that result
  if (openaiResult && openaiResult.isEmiratesID !== undefined) {
    return {
      isEmiratesID: openaiResult.isEmiratesID,
      side: openaiResult.side || 'unknown',
      confidence: openaiResult.confidence || 0.8,
      reason: openaiResult.reason || 'Identified by OpenAI Vision'
    }
  }
  
  // Fallback to pattern matching if OpenAI result not available
  if (!extractedText || typeof extractedText !== 'string') {
    return {
      isEmiratesID: false,
      side: 'unknown',
      confidence: 0,
      reason: 'No text extracted'
    }
  }

  const text = extractedText.toLowerCase()
  
  // Emirates ID Front Side Indicators
  const frontIndicators = [
    'emirates id',
    'united arab emirates',
    'identity card',
    'nationality',
    'name of holder',
    'id number',
    'card number',
    'emirates',
    'uae',
    'arab emirates'
  ]

  // Emirates ID Back Side Indicators
  const backIndicators = [
    'date of birth',
    'date of expiry',
    'holder\'s signature',
    'card id',
    'place of birth',
    'expiry date',
    'valid until'
  ]

  // Check for Emirates ID specific keywords
  const hasEmiratesKeywords = frontIndicators.some(indicator => 
    text.includes(indicator)
  ) || backIndicators.some(indicator => 
    text.includes(indicator)
  )

  // Check for UAE-specific patterns (15-digit ID number)
  const hasUAEIdPattern = /\b\d{15}\b/.test(extractedText) || 
                          /\b\d{3}-\d{4}-\d{7}-\d{1}\b/.test(extractedText)

  // Check for Arabic text indicators (Emirates ID has Arabic text)
  const hasArabicIndicators = /[\u0600-\u06FF]/.test(extractedText)

  // If no Emirates ID indicators found, it's not an Emirates ID
  if (!hasEmiratesKeywords && !hasUAEIdPattern && !hasArabicIndicators) {
    return {
      isEmiratesID: false,
      side: 'unknown',
      confidence: 0,
      reason: 'No Emirates ID indicators found'
    }
  }

  // Determine if it's front or back side
  const frontMatches = frontIndicators.filter(indicator => 
    text.includes(indicator)
  ).length

  const backMatches = backIndicators.filter(indicator => 
    text.includes(indicator)
  ).length

  let side = 'unknown'
  let confidence = 0

  if (frontMatches > backMatches) {
    side = 'front'
    confidence = Math.min(0.9, 0.5 + (frontMatches * 0.1))
  } else if (backMatches > frontMatches) {
    side = 'back'
    confidence = Math.min(0.9, 0.5 + (backMatches * 0.1))
  } else if (frontMatches > 0 || backMatches > 0) {
    // If we have some matches but can't determine side, default to front
    side = 'front'
    confidence = 0.6
  }

  // Additional validation: Check for specific front side fields
  if (side === 'front' || side === 'unknown') {
    const hasNameField = text.includes('name') || text.includes('holder')
    const hasNationalityField = text.includes('nationality')
    const hasIdNumber = hasUAEIdPattern
    
    if (hasNameField && (hasNationalityField || hasIdNumber)) {
      side = 'front'
      confidence = Math.max(confidence, 0.8)
    }
  }

  // Additional validation: Check for specific back side fields
  if (side === 'back' || side === 'unknown') {
    const hasDateOfBirth = text.includes('date of birth') || text.includes('dob')
    const hasExpiryDate = text.includes('expiry') || text.includes('valid until')
    const hasSignature = text.includes('signature')
    
    if ((hasDateOfBirth || hasExpiryDate) && hasSignature) {
      side = 'back'
      confidence = Math.max(confidence, 0.8)
    }
  }

  return {
    isEmiratesID: true,
    side: side,
    confidence: confidence,
    reason: `Detected as Emirates ID ${side} side with ${(confidence * 100).toFixed(0)}% confidence`
  }
}

/**
 * Process image and identify Emirates ID using OpenAI Vision
 * @param {string} imageBase64 - Base64 encoded image
 * @returns {Promise<Object>} - OCR result with identification
 */
export async function processEmiratesID(imageBase64) {
  try {
    console.log('🔍 Processing image for Emirates ID identification...')
    
    // Extract text and identify using OpenAI Vision (does both in one call)
    const openaiResult = await openaiExtract(imageBase64)
    
    // Use OpenAI's identification result
    const identification = identifyEmiratesID(openaiResult.text, openaiResult)
    
    return {
      success: true,
      extractedText: openaiResult.text,
      extractedName: openaiResult.extractedName || null, // Pass through extracted name
      identification: identification,
      requiresBackSide: identification.isEmiratesID && identification.side === 'front'
    }
  } catch (error) {
    console.error('❌ Error processing Emirates ID:', error.message)
    return {
      success: false,
      error: error.message,
      extractedName: null,
      identification: {
        isEmiratesID: false,
        side: 'unknown',
        confidence: 0,
        reason: `Processing error: ${error.message}`
      }
    }
  }
}

