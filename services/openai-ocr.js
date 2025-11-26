/**
 * OpenAI Vision OCR Service
 * Uses ChatGPT (GPT-4 Vision) for OCR extraction and Emirates ID identification
 */

import OpenAI from 'openai'
import dotenv from 'dotenv'

dotenv.config()

const OPENAI_API_KEY = process.env.OPENAI_API_KEY

if (!OPENAI_API_KEY) {
  console.warn('⚠️  OPENAI_API_KEY not found in environment variables')
  console.warn('   Please set OPENAI_API_KEY in your .env file')
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY
})

console.log(`🤖 Using OpenAI Vision API for OCR and Emirates ID identification`)
console.log(`🔑 API Key configured: ${OPENAI_API_KEY ? 'Yes' : 'No'}`)

/**
 * Extract text and identify Emirates ID using OpenAI Vision
 * @param {string} imageBase64 - Base64 encoded image (with or without data URL prefix)
 * @returns {Promise<{text: string, isEmiratesID: boolean, side: string, confidence: number, reason: string}>}
 */
export async function extractTextAndIdentify(imageBase64) {
  try {
    console.log('🔍 Processing image with OpenAI Vision API...')
    
    // Remove data URL prefix if present
    let base64Data = imageBase64
    let imageFormat = 'jpeg'
    if (imageBase64.includes(',')) {
      const parts = imageBase64.split(',')
      base64Data = parts[1]
      // Extract format from data URL
      const formatMatch = parts[0].match(/data:image\/([^;]+)/)
      if (formatMatch) {
        imageFormat = formatMatch[1]
      }
    }
    
    // Prepare the image URL for OpenAI
    const imageUrl = `data:image/${imageFormat};base64,${base64Data}`
    
    // Create a comprehensive prompt for OCR and identification
    const prompt = `Analyze this image and:

1. Extract ALL visible text exactly as it appears (including numbers, labels, and any text)
2. Identify if this is an Emirates ID (United Arab Emirates identity card)
3. If it's an Emirates ID, determine which side it is (front or back)
4. If it's the FRONT side of an Emirates ID, extract the NAME OF HOLDER (the person's full name in English)
5. Provide your confidence level (0-1)

For Emirates ID identification, look for:
- Front side indicators: "EMIRATES ID", "UNITED ARAB EMIRATES", "IDENTITY CARD", "Name of Holder", "Nationality", "ID Number", "Card Number", Arabic text
- Back side indicators: "Date of Birth", "Date of Expiry", "Holder's Signature", "Card ID", "Place of Birth", "Valid Until"

For name extraction (FRONT SIDE ONLY):
- Look for the "Name of Holder" field or the English name field
- Extract the full name (e.g., "AHMED MOHAMMED ALI" or "JOHN DOE")
- Return the name in UPPERCASE format
- If name cannot be found, return null for extractedName

Respond in this exact JSON format:
{
  "extractedText": "all text from the image",
  "isEmiratesID": true/false,
  "side": "front" or "back" or "unknown",
  "confidence": 0.0-1.0,
  "reason": "brief explanation of your identification",
  "extractedName": "FULL NAME IN UPPERCASE" or null
}`

    console.log('📤 Sending request to OpenAI Vision API...')
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // or "gpt-4-vision-preview" if gpt-4o not available
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt
            },
            {
              type: "image_url",
              image_url: {
                url: imageUrl
              }
            }
          ]
        }
      ],
      max_tokens: 2000,
      temperature: 0.1
    })
    
    // Extract response
    const content = response.choices[0].message.content
    
    console.log(`\n📝 ===== OPENAI RESPONSE =====`)
    console.log(content)
    console.log(`=============================\n`)
    
    // Parse JSON response
    let result
    try {
      // Try to extract JSON from response (might be wrapped in markdown)
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0])
      } else {
        result = JSON.parse(content)
      }
    } catch (parseError) {
      // If JSON parsing fails, try to extract information from text
      console.warn('⚠️  Could not parse JSON response, extracting from text...')
      result = extractFromTextResponse(content)
    }
    
    // Validate and return result
    const extractedText = result.extractedText || content
    const isEmiratesID = result.isEmiratesID === true || result.isEmiratesID === 'true'
    const side = result.side || 'unknown'
    const confidence = parseFloat(result.confidence) || 0.5
    const reason = result.reason || 'Analysis completed'
    const extractedName = result.extractedName || null
    
    console.log(`✅ Analysis completed:`)
    console.log(`   - Is Emirates ID: ${isEmiratesID}`)
    console.log(`   - Side: ${side}`)
    console.log(`   - Confidence: ${(confidence * 100).toFixed(0)}%`)
    console.log(`   - Reason: ${reason}`)
    console.log(`   - Text length: ${extractedText.length} characters`)
    if (extractedName) {
      console.log(`   - Extracted Name: ${extractedName}`)
    }
    
    return {
      text: extractedText,
      isEmiratesID,
      side,
      confidence,
      reason,
      extractedName: extractedName
    }
    
  } catch (error) {
    console.error('❌ OpenAI Vision API error:', error.message)
    if (error.response) {
      console.error('   Status:', error.response.status)
      console.error('   Data:', error.response.data)
    }
    throw new Error(`OCR extraction failed: ${error.message}`)
  }
}

/**
 * Extract information from text response if JSON parsing fails
 */
function extractFromTextResponse(text) {
  const lowerText = text.toLowerCase()
  
  // Try to determine if it's Emirates ID
  const emiratesIndicators = [
    'emirates id', 'united arab emirates', 'identity card',
    'name of holder', 'nationality', 'id number'
  ]
  const isEmiratesID = emiratesIndicators.some(indicator => lowerText.includes(indicator))
  
  // Determine side
  let side = 'unknown'
  if (lowerText.includes('date of birth') || lowerText.includes('date of expiry') || lowerText.includes('signature')) {
    side = 'back'
  } else if (lowerText.includes('name of holder') || lowerText.includes('nationality')) {
    side = 'front'
  }
  
  // Try to extract name from text if it's front side
  let extractedName = null
  if (side === 'front') {
    // Look for name patterns in the text
    const namePatterns = [
      /name\s+of\s+holder[:\s]+([A-Z\s]+)/i,
      /name[:\s]+([A-Z\s]+)/i,
      /holder[:\s]+([A-Z\s]+)/i
    ]
    for (const pattern of namePatterns) {
      const match = text.match(pattern)
      if (match && match[1]) {
        extractedName = match[1].trim().toUpperCase()
        break
      }
    }
  }
  
  return {
    extractedText: text,
    isEmiratesID,
    side,
    confidence: isEmiratesID ? 0.7 : 0.3,
    reason: 'Extracted from text response',
    extractedName: extractedName
  }
}

/**
 * Normalize name for comparison
 * @param {string} name - Name to normalize
 * @returns {string} - Normalized name
 */
export function normalizeName(name) {
  if (!name || typeof name !== 'string') return ''
  return name
    .toUpperCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '') // Remove special characters
}

/**
 * Extract name from OCR text if not already extracted
 * @param {string} extractedText - Full OCR text
 * @returns {string|null} - Extracted name or null
 */
export function extractNameFromText(extractedText) {
  if (!extractedText || typeof extractedText !== 'string') return null
  
  // Look for name patterns
  const namePatterns = [
    /name\s+of\s+holder[:\s]+([A-Z][A-Z\s]+)/i,
    /name[:\s]+([A-Z][A-Z\s]+)/i,
    /holder[:\s]+([A-Z][A-Z\s]+)/i,
    /(?:^|\n)([A-Z]{2,}(?:\s+[A-Z]{2,}){1,3})(?:\n|$)/ // Standalone name lines
  ]
  
  for (const pattern of namePatterns) {
    const match = extractedText.match(pattern)
    if (match && match[1]) {
      const name = match[1].trim().toUpperCase()
      // Validate it looks like a name (at least 2 words, reasonable length)
      const parts = name.split(/\s+/).filter(p => p.length > 1)
      if (parts.length >= 2 && name.length >= 4 && name.length <= 100) {
        return name
      }
    }
  }
  
  return null
}

/**
 * Compare extracted name with provided first and last name
 * @param {string} extractedName - Name extracted from OCR
 * @param {string} providedFirstName - Provided first name
 * @param {string} providedLastName - Provided last name
 * @returns {Object} - Match result with confidence and message
 */
export function compareNames(extractedName, providedFirstName, providedLastName) {
  if (!extractedName || !providedFirstName || !providedLastName) {
    return {
      matches: false,
      confidence: 0,
      message: 'Missing name information for comparison'
    }
  }
  
  // Normalize names
  const normalizedExtracted = normalizeName(extractedName)
  const normalizedProvidedFirst = normalizeName(providedFirstName)
  const normalizedProvidedLast = normalizeName(providedLastName)
  const normalizedProvidedFull = normalizeName(`${providedFirstName} ${providedLastName}`)
  
  // Split extracted name into parts
  const extractedParts = normalizedExtracted.split(' ').filter(p => p.length > 0)
  
  if (extractedParts.length === 0) {
    return {
      matches: false,
      confidence: 0,
      message: 'Could not parse extracted name'
    }
  }
  
  // Check for exact match
  if (normalizedExtracted === normalizedProvidedFull) {
    return {
      matches: true,
      confidence: 1.0,
      message: 'Name matches Emirates ID exactly'
    }
  }
  
  // Check first name match (first part)
  const firstNameMatches = extractedParts[0] === normalizedProvidedFirst
  
  // Check last name match (last part is always the primary check)
  // For names with multiple parts, the last part is typically the family name
  const lastNameMatches = extractedParts[extractedParts.length - 1] === normalizedProvidedLast
  
  // Calculate confidence
  let confidence = 0
  let matches = false
  let message = ''
  
  if (firstNameMatches && lastNameMatches) {
    matches = true
    confidence = 0.95 // High confidence - both first and last match
    message = 'Name matches Emirates ID'
  } else if (firstNameMatches) {
    matches = false
    confidence = 0.65 // Medium confidence - only first name matches
    message = 'First name matches but last name differs. Manual review recommended.'
  } else if (lastNameMatches) {
    matches = false
    confidence = 0.65 // Medium confidence - only last name matches
    message = 'Last name matches but first name differs. Manual review recommended.'
  } else {
    // Check for partial matches (e.g., "AHMED MOHAMMED ALI" vs "AHMED ALI")
    // This handles cases where the extracted name has middle names
    const extractedFirst = extractedParts[0]
    const extractedLast = extractedParts[extractedParts.length - 1]
    
    // Check if provided first name matches the first part
    const firstInExtracted = extractedParts[0] === normalizedProvidedFirst
    
    // Check if provided last name matches the last part (most common case)
    // OR appears anywhere in the extracted name (for edge cases)
    const lastInExtracted = 
      extractedParts[extractedParts.length - 1] === normalizedProvidedLast ||
      extractedParts.some(part => part === normalizedProvidedLast)
    
    if (firstInExtracted && lastInExtracted) {
      // First name matches first part AND last name matches last part or appears in name
      matches = true
      confidence = 0.85 // High confidence - first and last match, middle names present
      message = 'Name matches Emirates ID (with middle names)'
    } else if (firstInExtracted) {
      // Only first name matches
      matches = false
      confidence = 0.65 // Medium confidence - first matches but last differs
      message = 'First name matches but last name differs. Manual review recommended.'
    } else if (lastInExtracted) {
      // Only last name matches
      matches = false
      confidence = 0.65 // Medium confidence - last matches but first differs
      message = 'Last name matches but first name differs. Manual review recommended.'
    } else {
      // No match at all
      matches = false
      confidence = 0.2 // Low confidence - no match
      message = 'Name on Emirates ID does not match provided name. Manual review required.'
    }
  }
  
  return {
    matches,
    confidence,
    message
  }
}

