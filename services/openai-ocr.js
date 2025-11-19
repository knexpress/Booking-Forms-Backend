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
4. Provide your confidence level (0-1)

For Emirates ID identification, look for:
- Front side indicators: "EMIRATES ID", "UNITED ARAB EMIRATES", "IDENTITY CARD", "Name of Holder", "Nationality", "ID Number", "Card Number", Arabic text
- Back side indicators: "Date of Birth", "Date of Expiry", "Holder's Signature", "Card ID", "Place of Birth", "Valid Until"

Respond in this exact JSON format:
{
  "extractedText": "all text from the image",
  "isEmiratesID": true/false,
  "side": "front" or "back" or "unknown",
  "confidence": 0.0-1.0,
  "reason": "brief explanation of your identification"
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
    
    console.log(`✅ Analysis completed:`)
    console.log(`   - Is Emirates ID: ${isEmiratesID}`)
    console.log(`   - Side: ${side}`)
    console.log(`   - Confidence: ${(confidence * 100).toFixed(0)}%`)
    console.log(`   - Reason: ${reason}`)
    console.log(`   - Text length: ${extractedText.length} characters`)
    
    return {
      text: extractedText,
      isEmiratesID,
      side,
      confidence,
      reason
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
  
  return {
    extractedText: text,
    isEmiratesID,
    side,
    confidence: isEmiratesID ? 0.7 : 0.3,
    reason: 'Extracted from text response'
  }
}

