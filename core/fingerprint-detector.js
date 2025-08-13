'use strict';

/**
 * Core Fingerprint Detector Module
 * Detects and reports fingerprinting attempts with categorization
 */

/**
 * Fingerprinting detection categories
 */
export const FingerprintCategories = Object.freeze({
  CANVAS: 'canvas',
  WEBGL: 'webgl',
  AUDIO: 'audio',
  FONTS: 'fonts',
  HARDWARE: 'hardware',
  NAVIGATOR: 'navigator',
  SCREEN: 'screen',
  TIMING: 'timing',
  STORAGE: 'storage',
  NETWORK: 'network'
});

/**
 * Detection severity levels
 */
export const DetectionSeverity = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
});

/**
 * Core fingerprint detector class
 */
export class FingerprintDetector {
  constructor() {
    this.detections = new Map(); // Track detections by category
    this.callbacks = new Set(); // Detection callbacks
  }

  /**
   * Register a detection callback
   * @param {Function} callback - Function to call when fingerprinting is detected
   */
  onDetection(callback) {
    if (typeof callback === 'function') {
      this.callbacks.add(callback);
    }
  }

  /**
   * Remove a detection callback
   * @param {Function} callback - Callback to remove
   */
  offDetection(callback) {
    this.callbacks.delete(callback);
  }

  /**
   * Report a fingerprinting detection
   * @param {Object} detection - Detection details
   * @param {string} detection.category - Category from FingerprintCategories
   * @param {string} detection.method - Specific method detected
   * @param {string} detection.severity - Severity from DetectionSeverity
   * @param {string} [detection.property] - Property being accessed
   * @param {string} [detection.value] - Value being read
   * @param {Error} [detection.stack] - Stack trace for debugging
   */
  reportDetection(detection) {
    if (!detection || !detection.category || !detection.method) {
      console.warn('Invalid detection report:', detection);
      return;
    }

    // Validate category
    if (!Object.values(FingerprintCategories).includes(detection.category)) {
      console.warn('Unknown fingerprint category:', detection.category);
      detection.category = FingerprintCategories.NAVIGATOR; // fallback
    }

    // Validate severity
    if (!Object.values(DetectionSeverity).includes(detection.severity)) {
      detection.severity = DetectionSeverity.MEDIUM; // default
    }

    // Add timestamp and URL
    const enrichedDetection = {
      ...detection,
      timestamp: Date.now(),
      url: typeof location !== 'undefined' ? location.href : 'unknown',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
    };

    // Track detection count by category
    const categoryKey = detection.category;
    const currentCount = this.detections.get(categoryKey) || 0;
    this.detections.set(categoryKey, currentCount + 1);

    // Add detection count to the report
    enrichedDetection.detectionCount = this.detections.get(categoryKey);
    enrichedDetection.totalDetections = Array.from(this.detections.values()).reduce((a, b) => a + b, 0);

    // Notify all callbacks
    this.callbacks.forEach(callback => {
      try {
        callback(enrichedDetection);
      } catch (error) {
        console.error('Error in detection callback:', error);
      }
    });

    // Log for debugging
    console.log('Fingerprint detection:', enrichedDetection);
  }

  /**
   * Get detection statistics
   * @returns {Object} Detection stats by category
   */
  getStats() {
    const stats = {
      totalDetections: 0,
      categories: {}
    };

    for (const [category, count] of this.detections.entries()) {
      stats.categories[category] = count;
      stats.totalDetections += count;
    }

    return stats;
  }

  /**
   * Clear all detection statistics
   */
  clearStats() {
    this.detections.clear();
  }

  /**
   * Helper method to detect canvas fingerprinting
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {string} method - Method being called
   */
  detectCanvasFingerprinting(ctx, method) {
    // Basic heuristics for canvas fingerprinting detection
    const suspiciousMethods = [
      'getImageData',
      'toDataURL',
      'toBlob'
    ];

    if (suspiciousMethods.includes(method)) {
      this.reportDetection({
        category: FingerprintCategories.CANVAS,
        method: method,
        severity: DetectionSeverity.HIGH,
        property: 'canvas.' + method
      });
    }
  }

  /**
   * Helper method to detect WebGL fingerprinting
   * @param {WebGLRenderingContext} gl - WebGL context
   * @param {string} parameter - Parameter being queried
   */
  detectWebGLFingerprinting(gl, parameter) {
    const suspiciousParameters = [
      'VENDOR',
      'RENDERER',
      'VERSION',
      'SHADING_LANGUAGE_VERSION',
      'UNMASKED_VENDOR_WEBGL',
      'UNMASKED_RENDERER_WEBGL'
    ];

    const paramName = typeof parameter === 'number' ? 
      Object.keys(gl).find(key => gl[key] === parameter) || parameter.toString() : 
      parameter;

    if (suspiciousParameters.includes(paramName)) {
      this.reportDetection({
        category: FingerprintCategories.WEBGL,
        method: 'getParameter',
        severity: DetectionSeverity.HIGH,
        property: 'webgl.' + paramName
      });
    }
  }

  /**
   * Helper method to detect navigator property access
   * @param {string} property - Property being accessed
   */
  detectNavigatorAccess(property) {
    const suspiciousProperties = [
      'hardwareConcurrency',
      'deviceMemory',
      'platform',
      'userAgent',
      'languages',
      'plugins',
      'mimeTypes'
    ];

    if (suspiciousProperties.includes(property)) {
      const severity = ['hardwareConcurrency', 'deviceMemory'].includes(property) ? 
        DetectionSeverity.CRITICAL : DetectionSeverity.MEDIUM;

      this.reportDetection({
        category: FingerprintCategories.NAVIGATOR,
        method: 'propertyAccess',
        severity: severity,
        property: 'navigator.' + property
      });
    }
  }

  /**
   * Helper method to detect screen property access
   * @param {string} property - Property being accessed
   */
  detectScreenAccess(property) {
    const suspiciousProperties = [
      'width',
      'height',
      'availWidth',
      'availHeight',
      'colorDepth',
      'pixelDepth'
    ];

    if (suspiciousProperties.includes(property)) {
      this.reportDetection({
        category: FingerprintCategories.SCREEN,
        method: 'propertyAccess',
        severity: DetectionSeverity.MEDIUM,
        property: 'screen.' + property
      });
    }
  }
}

// Export singleton instance
export const fingerprintDetector = new FingerprintDetector();