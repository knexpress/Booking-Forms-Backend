/**
 * Card Detection Helpers for Improved Edge Detection
 * Use these functions in your frontend to improve card detection
 * when background is similar to the card
 */

/**
 * Enhanced card detection with adaptive thresholding
 * This helps when background color is similar to card
 */
export function enhancedCardDetection(src, cv) {
  // Convert to grayscale
  let gray = new cv.Mat();
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
  
  // Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)
  // This improves contrast in different regions
  let clahe = new cv.CLAHE(2.0, new cv.Size(8, 8));
  let enhanced = new cv.Mat();
  clahe.apply(gray, enhanced);
  
  // Use adaptive thresholding instead of fixed threshold
  // This adapts to local image characteristics
  let adaptive = new cv.Mat();
  cv.adaptiveThreshold(
    enhanced,
    adaptive,
    255,
    cv.ADAPTIVE_THRESH_GAUSSIAN_C,
    cv.THRESH_BINARY,
    11,  // block size
    2    // C constant subtracted from mean
  );
  
  // Apply morphological operations to close gaps
  let kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
  let morphed = new cv.Mat();
  cv.morphologyEx(adaptive, morphed, cv.MORPH_CLOSE, kernel);
  
  // Find contours
  let contours = new cv.MatVector();
  let hierarchy = new cv.Mat();
  cv.findContours(morphed, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
  
  // Clean up
  gray.delete();
  enhanced.delete();
  adaptive.delete();
  morphed.delete();
  kernel.delete();
  hierarchy.delete();
  
  return contours;
}

/**
 * Card detection using LAB color space
 * Better separation when background is similar
 */
export function labColorSpaceDetection(src, cv) {
  // Convert to LAB color space
  let lab = new cv.Mat();
  cv.cvtColor(src, lab, cv.COLOR_RGBA2BGR);
  cv.cvtColor(lab, lab, cv.COLOR_BGR2LAB);
  
  // Extract L channel (lightness) - usually has best contrast
  let channels = new cv.MatVector();
  cv.split(lab, channels);
  let lChannel = channels.get(0);
  
  // Apply adaptive threshold on L channel
  let adaptive = new cv.Mat();
  cv.adaptiveThreshold(
    lChannel,
    adaptive,
    255,
    cv.ADAPTIVE_THRESH_GAUSSIAN_C,
    cv.THRESH_BINARY,
    15,
    10
  );
  
  // Find contours
  let contours = new cv.MatVector();
  let hierarchy = new cv.Mat();
  cv.findContours(adaptive, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
  
  // Clean up
  lab.delete();
  channels.delete();
  lChannel.delete();
  adaptive.delete();
  hierarchy.delete();
  
  return contours;
}

/**
 * Multi-scale edge detection
 * Tries detection at different scales for better results
 */
export function multiScaleCardDetection(src, cv) {
  let allContours = new cv.MatVector();
  let scales = [0.5, 1.0, 1.5]; // Try different scales
  
  for (let scale of scales) {
    // Resize image
    let resized = new cv.Mat();
    let newSize = new cv.Size(src.cols * scale, src.rows * scale);
    cv.resize(src, resized, newSize, 0, 0, cv.INTER_LINEAR);
    
    // Convert to grayscale
    let gray = new cv.Mat();
    cv.cvtColor(resized, gray, cv.COLOR_RGBA2GRAY);
    
    // Apply Gaussian blur
    let blurred = new cv.Mat();
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
    
    // Canny edge detection with adaptive thresholds
    let edges = new cv.Mat();
    let mean = cv.mean(blurred);
    let threshold1 = mean[0] * 0.5;
    let threshold2 = mean[0] * 1.5;
    cv.Canny(blurred, edges, threshold1, threshold2);
    
    // Find contours
    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();
    cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    
    // Scale contours back to original size
    for (let i = 0; i < contours.size(); i++) {
      let contour = contours.get(i);
      let scaledContour = new cv.Mat(contour.rows, contour.cols, cv.CV_32SC2);
      for (let j = 0; j < contour.rows; j++) {
        let point = contour.intPtr(j);
        scaledContour.intPtr(j)[0] = Math.round(point[0] / scale);
        scaledContour.intPtr(j)[1] = Math.round(point[1] / scale);
      }
      allContours.push_back(scaledContour);
      contour.delete();
      scaledContour.delete();
    }
    
    // Clean up
    resized.delete();
    gray.delete();
    blurred.delete();
    edges.delete();
    hierarchy.delete();
    contours.delete();
  }
  
  return allContours;
}

/**
 * Filter contours to find card-like shapes
 * ID cards typically have aspect ratio ~1.585 (85.6mm x 53.98mm)
 */
export function filterCardContours(contours, cv, minArea = 5000, maxArea = 500000) {
  let cardContours = new cv.MatVector();
  
  for (let i = 0; i < contours.size(); i++) {
    let contour = contours.get(i);
    let area = cv.contourArea(contour);
    
    // Filter by area
    if (area < minArea || area > maxArea) {
      contour.delete();
      continue;
    }
    
    // Get bounding rectangle
    let rect = cv.boundingRect(contour);
    let aspectRatio = rect.width / rect.height;
    
    // ID card aspect ratio is approximately 1.585 (with some tolerance)
    // Also accept portrait orientation (inverse ratio)
    let cardRatio = 1.585;
    let tolerance = 0.3;
    
    if ((aspectRatio >= cardRatio - tolerance && aspectRatio <= cardRatio + tolerance) ||
        (aspectRatio >= 1/cardRatio - tolerance && aspectRatio <= 1/cardRatio + tolerance)) {
      cardContours.push_back(contour);
    } else {
      contour.delete();
    }
  }
  
  return cardContours;
}

/**
 * Get the best card contour (largest valid card-like shape)
 */
export function getBestCardContour(contours, cv) {
  let bestContour = null;
  let maxArea = 0;
  
  for (let i = 0; i < contours.size(); i++) {
    let contour = contours.get(i);
    let area = cv.contourArea(contour);
    
    if (area > maxArea) {
      maxArea = area;
      if (bestContour) bestContour.delete();
      bestContour = contour.clone();
    } else {
      contour.delete();
    }
  }
  
  return bestContour;
}

/**
 * Complete enhanced card detection pipeline
 * Combines multiple techniques for best results
 */
export function detectCardEnhanced(src, cv) {
  // Try multiple detection methods
  let results = [];
  
  // Method 1: Enhanced adaptive thresholding
  try {
    let contours1 = enhancedCardDetection(src, cv);
    let filtered1 = filterCardContours(contours1, cv);
    if (filtered1.size() > 0) {
      results.push({
        method: 'adaptive',
        contours: filtered1
      });
    } else {
      contours1.delete();
      filtered1.delete();
    }
  } catch (e) {
    console.warn('Adaptive threshold method failed:', e);
  }
  
  // Method 2: LAB color space
  try {
    let contours2 = labColorSpaceDetection(src, cv);
    let filtered2 = filterCardContours(contours2, cv);
    if (filtered2.size() > 0) {
      results.push({
        method: 'lab',
        contours: filtered2
      });
    } else {
      contours2.delete();
      filtered2.delete();
    }
  } catch (e) {
    console.warn('LAB color space method failed:', e);
  }
  
  // Method 3: Multi-scale
  try {
    let contours3 = multiScaleCardDetection(src, cv);
    let filtered3 = filterCardContours(contours3, cv);
    if (filtered3.size() > 0) {
      results.push({
        method: 'multiscale',
        contours: filtered3
      });
    } else {
      contours3.delete();
      filtered3.delete();
    }
  } catch (e) {
    console.warn('Multi-scale method failed:', e);
  }
  
  // Return the method with most/best contours
  if (results.length === 0) {
    return null;
  }
  
  // Sort by number of valid contours
  results.sort((a, b) => b.contours.size() - a.contours.size());
  
  // Get best contour from best method
  let bestMethod = results[0];
  let bestContour = getBestCardContour(bestMethod.contours, cv);
  
  // Clean up other results
  for (let i = 1; i < results.length; i++) {
    let contours = results[i].contours;
    for (let j = 0; j < contours.size(); j++) {
      contours.get(j).delete();
    }
    contours.delete();
  }
  
  return {
    contour: bestContour,
    method: bestMethod.method
  };
}

