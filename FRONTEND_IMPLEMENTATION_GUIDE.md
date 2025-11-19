# Frontend Implementation Guide - Camera & OCR Flow

## Required Behavior

When an image is captured and sent for OCR validation:
1. **Camera screen disappears** immediately
2. **Loading screen appears** during processing
3. **Toast message shows result** when processing completes

## Implementation Example

### Step 1: Update State Management

```typescript
// In your Step2EmiratesIDScan component or similar
const [showCamera, setShowCamera] = useState(true)
const [isProcessing, setIsProcessing] = useState(false)
const [toastMessage, setToastMessage] = useState<{type: 'success' | 'error' | 'info', message: string} | null>(null)
```

### Step 2: Handle Image Capture and Validation

```typescript
const handleImageCapture = async (capturedImage: string) => {
  try {
    // 1. Hide camera immediately
    setShowCamera(false)
    
    // 2. Show loading screen
    setIsProcessing(true)
    
    // 3. Send to backend for validation
    const response = await fetch(`${API_BASE_URL}/api/ocr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: capturedImage
      })
    })
    
    const result = await response.json()
    
    // 4. Hide loading screen
    setIsProcessing(false)
    
    // 5. Show toast message with result
    if (result.success) {
      if (result.isEmiratesID) {
        if (result.requiresBackSide) {
          // Front side detected - need back side
          setToastMessage({
            type: 'info',
            message: '✅ Front side detected. Please capture the back side.'
          })
          // Show camera again for back side
          setShowCamera(true)
        } else {
          // Both sides complete
          setToastMessage({
            type: 'success',
            message: '✅ Emirates ID validated successfully!'
          })
          // Proceed to next step
          proceedToNextStep()
        }
      } else {
        // Not an Emirates ID
        setToastMessage({
          type: 'error',
          message: '❌ Please provide a valid Emirates ID'
        })
        // Show camera again
        setShowCamera(true)
      }
    } else {
      // Error from backend
      setToastMessage({
        type: 'error',
        message: `❌ ${result.error || 'Validation failed. Please try again.'}`
      })
      // Show camera again
      setShowCamera(true)
    }
    
    // Auto-hide toast after 5 seconds
    setTimeout(() => {
      setToastMessage(null)
    }, 5000)
    
  } catch (error) {
    // Hide loading on error
    setIsProcessing(false)
    
    // Show error toast
    setToastMessage({
      type: 'error',
      message: '❌ Failed to validate image. Please try again.'
    })
    
    // Show camera again
    setShowCamera(true)
    
    // Auto-hide toast
    setTimeout(() => {
      setToastMessage(null)
    }, 5000)
  }
}
```

### Step 3: Component Structure

```tsx
return (
  <div className="emirates-id-scan-container">
    {/* Camera View - Only show when showCamera is true */}
    {showCamera && !isProcessing && (
      <CameraComponent
        onCapture={handleImageCapture}
        onClose={() => setShowCamera(false)}
      />
    )}
    
    {/* Loading Screen - Show when processing */}
    {isProcessing && (
      <div className="loading-overlay">
        <div className="loading-spinner">
          <Spinner /> {/* Your spinner component */}
        </div>
        <p>Validating Emirates ID...</p>
        <p className="loading-subtitle">This may take 10-30 seconds</p>
      </div>
    )}
    
    {/* Toast Message */}
    {toastMessage && (
      <Toast
        type={toastMessage.type}
        message={toastMessage.message}
        onClose={() => setToastMessage(null)}
        duration={5000}
      />
    )}
  </div>
)
```

### Step 4: Toast Component Example

```tsx
interface ToastProps {
  type: 'success' | 'error' | 'info'
  message: string
  onClose: () => void
  duration?: number
}

const Toast: React.FC<ToastProps> = ({ type, message, onClose, duration = 5000 }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose()
    }, duration)
    
    return () => clearTimeout(timer)
  }, [duration, onClose])
  
  const bgColor = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    info: 'bg-blue-500'
  }[type]
  
  return (
    <div className={`fixed top-4 right-4 ${bgColor} text-white px-6 py-4 rounded-lg shadow-lg z-50 flex items-center gap-3`}>
      <span>{message}</span>
      <button onClick={onClose} className="ml-4 text-white hover:text-gray-200">
        ×
      </button>
    </div>
  )
}
```

### Step 5: Loading Screen Styles

```css
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  color: white;
}

.loading-spinner {
  margin-bottom: 1rem;
}

.loading-subtitle {
  margin-top: 0.5rem;
  font-size: 0.875rem;
  opacity: 0.8;
}
```

## Complete Flow

1. **User captures image** → `handleImageCapture()` called
2. **Camera hides** → `setShowCamera(false)`
3. **Loading shows** → `setIsProcessing(true)`
4. **API call** → `POST /api/ocr`
5. **Loading hides** → `setIsProcessing(false)`
6. **Toast shows** → `setToastMessage({...})`
7. **Toast auto-hides** → After 5 seconds

## API Response Handling

The backend returns these responses:

### Success - Front Side Detected
```json
{
  "success": true,
  "isEmiratesID": true,
  "side": "front",
  "requiresBackSide": true,
  "message": "Emirates ID front side detected. Please send the back side image."
}
```

### Success - Back Side Detected
```json
{
  "success": true,
  "isEmiratesID": true,
  "side": "back",
  "requiresBackSide": false,
  "message": "Emirates ID back side detected."
}
```

### Not an Emirates ID
```json
{
  "success": true,
  "isEmiratesID": false,
  "message": "Image is not an Emirates ID"
}
```

### Error
```json
{
  "success": false,
  "error": "Error message here"
}
```

## Notes

- **Timeout**: Set fetch timeout to 90 seconds (OpenAI may take 10-30 seconds)
- **Error Handling**: Always show camera again on error
- **User Experience**: Provide clear feedback at each step
- **Accessibility**: Ensure loading screen and toast are accessible

