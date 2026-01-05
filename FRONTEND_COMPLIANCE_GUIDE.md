# Frontend Compliance Guide - Backend Changes

## ⚠️ IMPORTANT: Do NOT Change Any Other Functionality

This guide outlines the backend changes that the frontend must comply with. **Only make the changes specified below. Do not modify any other existing functionality.**

---

## 1. EID Upload Mandatory - Validation Removed

### Backend Change
- ✅ EID **verification/validation** has been completely removed from the backend
- ✅ EID images are **still mandatory** (must be uploaded)
- ✅ No validation will be performed on EID images (any image will be accepted)
- ✅ Bookings will be accepted regardless of EID image content/validity
- ✅ EID images will still be stored in the database

### Frontend Action Required
**NO CHANGES NEEDED** - The frontend should continue to:
- ✅ **Keep EID image upload as MANDATORY** (users must upload EID images)
- ✅ Keep requiring `eidFrontImage` and `eidBackImage` in the UI
- ✅ Keep sending `eidFrontImage` and `eidBackImage` in booking requests (required)
- ✅ Keep sending `eidFrontImageFirstName` and `eidFrontImageLastName` (optional but recommended)
- ✅ **Remove any OCR validation UI/flow** (no need to wait for validation)
- ✅ **Remove any validation error messages** related to EID verification
- ✅ Allow booking submission immediately after EID upload (no validation wait)

### What Changed
- ❌ **No OCR validation** - EID images are accepted without checking if they're valid Emirates IDs
- ❌ **No validation errors** - Backend won't reject bookings based on EID image content
- ✅ **Faster booking flow** - No need to wait for OCR validation

### What to Keep
- ✅ **Keep EID upload as MANDATORY** (required field)
- ✅ Keep EID image upload UI/functionality
- ✅ Keep sending EID images in booking requests
- ✅ Keep all other booking form fields

### What NOT to Change
- ❌ Do NOT make EID upload optional
- ❌ Do NOT remove EID image upload UI
- ❌ Do NOT change any other booking form fields
- ❌ Do NOT modify OTP functionality
- ❌ Do NOT change any other API calls

---

## 2. OTP Verification - MANDATORY (Already Implemented)

### Backend Change
- ✅ OTP verification is **mandatory** for all bookings
- ✅ Both `otpPhoneNumber` and `otp` must be provided
- ✅ Booking will be rejected if OTP is missing or invalid

### Frontend Action Required
**VERIFY THIS IS WORKING** - Ensure:
- ✅ OTP generation is called before booking submission
- ✅ OTP verification is performed before booking submission
- ✅ Both `otpPhoneNumber` and `otp` are included in booking request
- ✅ Booking request is blocked if OTP is not verified

### What NOT to Change
- ❌ Do NOT make OTP optional
- ❌ Do NOT remove OTP verification flow
- ❌ Do NOT change OTP API endpoints usage

---

## 3. Declared Amount - Auto-Default (Already Implemented)

### Backend Change
- ✅ When `insured: true`, `declaredAmount` defaults to `0` if not provided
- ✅ `declaredAmount` is optional in the request body
- ✅ Frontend no longer needs to send `declaredAmount` when insured is true

### Frontend Action Required
**OPTIONAL IMPROVEMENT** - You can:
- ✅ Remove `declaredAmount` input field from the UI (optional)
- ✅ Or keep it but make it optional (backend will default to 0)

### What NOT to Change
- ❌ Do NOT remove the `insured` field
- ❌ Do NOT change insurance-related functionality
- ❌ Do NOT modify other booking fields

---

## 4. OCR Endpoint Disabled - Remove OCR Validation Flow

### Backend Change
- ✅ `/api/ocr` endpoint is now disabled (returns 503)
- ✅ EID verification/validation no longer uses OCR
- ✅ EID images are accepted without validation

### Frontend Action Required
**REQUIRED CHANGES:**
- ❌ **Remove or disable calls to `/api/ocr` endpoint**
- ❌ **Remove any OCR validation UI/flow** (loading screens, validation messages)
- ❌ **Remove validation error messages** for invalid EID images
- ✅ **Allow immediate booking submission** after EID upload (no validation wait)
- ✅ EID images can be uploaded directly and submitted immediately

### What NOT to Change
- ❌ Do NOT try to fix or re-enable OCR endpoint
- ❌ Do NOT modify other API endpoints
- ❌ Do NOT remove EID upload requirement

---

## 5. Console Logging Disabled (No Frontend Impact)

### Backend Change
- ✅ All console logging disabled for security (ISO 27001/27002 compliance)
- ✅ No sensitive data logged

### Frontend Action Required
**NO CHANGES NEEDED** - This is a backend-only security change.

---

## Summary of Required Frontend Changes

### ✅ Required Actions:
1. **Keep EID upload MANDATORY** - EID images are still required, but no validation is performed
2. **Remove OCR validation flow** - Remove calls to `/api/ocr` endpoint and validation UI
3. **Remove validation error messages** - No need to show EID validation errors
4. **Allow immediate submission** - Users can submit booking immediately after EID upload (no validation wait)
5. **Verify OTP is mandatory** - Ensure OTP verification happens before booking submission
6. **Optional: Remove declaredAmount input** - Can remove the input field since backend defaults to 0

### ❌ Do NOT Change:
- ❌ Do NOT make EID upload optional (it's still mandatory)
- ❌ Do NOT remove EID image upload UI (keep it mandatory)
- ❌ Do NOT modify any other booking form fields
- ❌ Do NOT change OTP flow (keep it mandatory)
- ❌ Do NOT modify any other API endpoints
- ❌ Do NOT change any other existing functionality

---

## API Request Examples

### Booking Request (with OTP - REQUIRED)
```json
{
  "sender": {
    "firstName": "John",
    "lastName": "Doe",
    "emailAddress": "john@example.com",
    "phoneNumber": "+971501234567",
    "country": "UNITED ARAB EMIRATES",
    "addressLine1": "123 Main St",
    "insured": true,
    "declaredAmount": 0  // Optional - backend defaults to 0 if insured is true
  },
  "receiver": {
    "firstName": "Jane",
    "lastName": "Smith",
    "emailAddress": "jane@example.com",
    "phoneNumber": "+639123456789",
    "country": "PHILIPPINES",
    "addressLine1": "456 Oak Ave"
  },
  "items": [...],
  "service": "uae-to-pinas",
  "termsAccepted": true,
  "otpPhoneNumber": "+971501234567",  // REQUIRED
  "otp": "123456",                    // REQUIRED
  "eidFrontImage": "...",            // OPTIONAL - no validation
  "eidBackImage": "...",              // OPTIONAL - no validation
  "eidFrontImageFirstName": "John",  // OPTIONAL
  "eidFrontImageLastName": "Doe"     // OPTIONAL
}
```

### Booking Request (EID Images Required)
```json
{
  "sender": {...},
  "receiver": {...},
  "items": [...],
  "service": "uae-to-pinas",
  "termsAccepted": true,
  "otpPhoneNumber": "+971501234567",  // REQUIRED
  "otp": "123456",                     // REQUIRED
  "eidFrontImage": "...",             // REQUIRED (but no validation)
  "eidBackImage": "...",               // REQUIRED (but no validation)
  "eidFrontImageFirstName": "John",   // Optional but recommended
  "eidFrontImageLastName": "Doe"      // Optional but recommended
}
```

**Note:** EID images are still required, but the backend won't validate them. Any image will be accepted.

---

## Testing Checklist

Before deploying frontend changes, verify:

- [ ] EID upload is still mandatory (required field)
- [ ] EID images are accepted without validation (no OCR check)
- [ ] Booking submission works immediately after EID upload (no validation wait)
- [ ] No OCR validation errors are shown
- [ ] OTP verification is mandatory and working
- [ ] Booking submission works with OTP
- [ ] Insurance with `declaredAmount: 0` works
- [ ] Insurance without `declaredAmount` works (defaults to 0)
- [ ] All other existing functionality still works

---

## Questions?

If you have questions about these changes, please refer to:
- Backend API documentation
- This compliance guide
- Backend team for clarification

**Remember: Only make the changes specified above. Do not modify any other functionality.**

