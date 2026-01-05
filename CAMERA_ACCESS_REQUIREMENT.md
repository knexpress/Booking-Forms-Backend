# Camera Access Requirement - Frontend Implementation

## Requirement
**If user declines camera access request, don't allow user to upload an image**

## Important Note
⚠️ **This must be implemented in the FRONTEND application**, not the backend.

The backend cannot detect if camera access was denied - this is a browser security feature that only the frontend can detect and handle.

---

## Frontend Implementation Guide

### Step 1: Request Camera Permission

```typescript
// Example: Request camera access
async function requestCameraPermission(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { facingMode: 'environment' } // Use back camera on mobile
    })
    
    // Permission granted - stop the stream (we just needed to check permission)
    stream.getTracks().forEach(track => track.stop())
    return true
  } catch (error) {
    // Permission denied or error
    console.error('Camera permission denied:', error)
    return false
  }
}
```

### Step 2: Handle Permission Denial

```typescript
// In your camera component
const [cameraPermission, setCameraPermission] = useState<'pending' | 'granted' | 'denied'>('pending')
const [showImageUpload, setShowImageUpload] = useState(false)

useEffect(() => {
  async function checkPermission() {
    const hasPermission = await requestCameraPermission()
    if (hasPermission) {
      setCameraPermission('granted')
      setShowImageUpload(false) // Only allow camera, no file upload
    } else {
      setCameraPermission('denied')
      setShowImageUpload(false) // Block all image uploads
      // Show error message to user
    }
  }
  checkPermission()
}, [])
```

### Step 3: Block Image Upload When Permission Denied

```typescript
// Disable file input when camera permission is denied
<div>
  {cameraPermission === 'denied' && (
    <div className="error-message">
      <p>❌ Camera access is required to upload images</p>
      <p>Please enable camera access in your browser settings to continue</p>
      <button onClick={() => window.location.reload()}>
        Retry After Enabling Camera
      </button>
    </div>
  )}
  
  {cameraPermission === 'granted' && (
    <CameraComponent onCapture={handleImageCapture} />
  )}
  
  {/* File input - ONLY show if camera permission is granted OR not using camera */}
  {cameraPermission === 'granted' && (
    <input
      type="file"
      accept="image/*"
      onChange={handleFileUpload}
      disabled={false}
    />
  )}
</div>
```

### Step 4: Alternative - Check Permission Before Upload

```typescript
async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
  const file = event.target.files?.[0]
  if (!file) return
  
  // Check if camera permission is available (for validation)
  try {
    await navigator.mediaDevices.getUserMedia({ video: true })
    // Permission available - proceed with upload
    processImage(file)
  } catch (error) {
    // Permission denied - block upload
    alert('Camera access is required. Please enable camera access to upload images.')
    event.target.value = '' // Clear the file input
    return
  }
}
```

### Step 5: Complete Example Component

```typescript
import React, { useState, useEffect } from 'react'

interface CameraUploadProps {
  onImageCapture: (imageData: string) => void
}

export const CameraUploadComponent: React.FC<CameraUploadProps> = ({ onImageCapture }) => {
  const [cameraPermission, setCameraPermission] = useState<'pending' | 'granted' | 'denied'>('pending')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    checkCameraPermission()
  }, [])

  async function checkCameraPermission() {
    try {
      // Request camera permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      })
      
      // Permission granted - stop stream
      stream.getTracks().forEach(track => track.stop())
      setCameraPermission('granted')
      setErrorMessage(null)
    } catch (error: any) {
      // Permission denied
      setCameraPermission('denied')
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setErrorMessage('Camera access was denied. Please enable camera access in your browser settings to upload images.')
      } else if (error.name === 'NotFoundError') {
        setErrorMessage('No camera found on this device.')
      } else {
        setErrorMessage('Unable to access camera. Please check your browser settings.')
      }
    }
  }

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    // Block file upload if camera permission was denied
    if (cameraPermission === 'denied') {
      event.preventDefault()
      event.stopPropagation()
      alert('Camera access is required. Please enable camera access to upload images.')
      return
    }

    const file = event.target.files?.[0]
    if (file) {
      // Process file (convert to base64, etc.)
      const reader = new FileReader()
      reader.onload = (e) => {
        const imageData = e.target?.result as string
        onImageCapture(imageData)
      }
      reader.readAsDataURL(file)
    }
  }

  return (
    <div className="camera-upload-container">
      {cameraPermission === 'pending' && (
        <div className="loading">Checking camera permission...</div>
      )}

      {cameraPermission === 'denied' && (
        <div className="error-container">
          <div className="error-icon">❌</div>
          <h3>Camera Access Required</h3>
          <p>{errorMessage}</p>
          <div className="instructions">
            <p><strong>To enable camera access:</strong></p>
            <ol>
              <li>Click the camera icon in your browser's address bar</li>
              <li>Select "Allow" for camera access</li>
              <li>Refresh this page</li>
            </ol>
          </div>
          <button onClick={checkCameraPermission} className="retry-button">
            Retry
          </button>
        </div>
      )}

      {cameraPermission === 'granted' && (
        <div className="upload-options">
          {/* Camera capture component */}
          <CameraCapture onCapture={onImageCapture} />
          
          {/* File upload - only enabled when permission is granted */}
          <div className="file-upload">
            <label htmlFor="image-upload" className="upload-button">
              Or Upload from Device
            </label>
            <input
              id="image-upload"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
```

---

## Browser Permission States

### Permission API (Modern Browsers)

```typescript
// Check permission status without prompting
async function checkPermissionStatus(): Promise<PermissionState> {
  if ('permissions' in navigator) {
    const result = await navigator.permissions.query({ name: 'camera' as PermissionName })
    return result.state // 'granted' | 'denied' | 'prompt'
  }
  return 'prompt' // Fallback if Permission API not supported
}
```

### Handle Different Permission States

```typescript
const permissionStatus = await checkPermissionStatus()

switch (permissionStatus) {
  case 'granted':
    // Camera access granted - allow uploads
    enableImageUpload(true)
    break
    
  case 'denied':
    // Camera access denied - block uploads
    enableImageUpload(false)
    showErrorMessage('Camera access is required. Please enable it in browser settings.')
    break
    
  case 'prompt':
    // Permission not yet requested - will prompt on getUserMedia call
    // Can allow upload but will prompt when accessing camera
    break
}
```

---

## Backend Considerations

### Current Backend Behavior

The backend **cannot** detect if camera access was denied because:
- Camera permissions are browser-level security features
- Backend only receives images after they're captured/uploaded
- No way to verify if image came from camera or file upload

### What Backend Can Do

The backend can:
- ✅ Accept images (from camera or file upload)
- ✅ Validate image format/quality
- ✅ Process images
- ❌ **Cannot** detect camera permission status
- ❌ **Cannot** differentiate camera vs file upload images

---

## Implementation Checklist

### Frontend Team Should:

- [ ] Request camera permission before showing upload options
- [ ] Block file upload input when camera permission is denied
- [ ] Show clear error message when permission is denied
- [ ] Provide instructions to enable camera access
- [ ] Handle permission state changes
- [ ] Test on multiple browsers (Chrome, Firefox, Safari, Edge)
- [ ] Test on mobile devices (iOS Safari, Android Chrome)

### User Experience Flow:

1. **User visits page** → Check camera permission
2. **Permission prompt appears** → User grants/denies
3. **If granted** → Show camera and upload options
4. **If denied** → Show error message, block all uploads
5. **User can retry** → After enabling in browser settings

---

## Testing

### Test Cases:

1. **Permission Granted**
   - ✅ Camera should work
   - ✅ File upload should work

2. **Permission Denied**
   - ✅ Camera should not work
   - ✅ File upload should be blocked/disabled
   - ✅ Error message should be shown

3. **Permission Not Yet Requested**
   - ✅ Prompt should appear
   - ✅ User grants → proceed
   - ✅ User denies → block uploads

4. **Permission Changed**
   - ✅ If user changes permission in browser settings
   - ✅ App should detect change and update UI

---

## Notes

- **Browser Security**: Camera permissions are enforced by browsers for user privacy
- **Mobile Considerations**: Mobile browsers may have different permission flows
- **Fallback Options**: Consider allowing manual file selection if camera is not available (optional, based on requirements)
- **User Guidance**: Provide clear instructions on how to enable camera access in browser settings

---

## Summary

**This requirement must be implemented in the FRONTEND application.**

The backend receives images but cannot control or detect camera permissions. The frontend must:
1. Request camera permission
2. Detect if permission was denied
3. Block image upload options when permission is denied
4. Show appropriate error messages to users

