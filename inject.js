/**
 * Privacy Shield - Main World Injection Script
 * This script runs in the main world context to properly intercept page APIs
 */

(function() {
  'use strict';

  // Prevent multiple initializations
  if (window.__psPatched__) return;
  window.__psPatched__ = true;

  // Deterministic PRNG implementation (mulberry32)
  function mulberry32(seed) {
    return function() {
      let t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // FNV1a hash for seed generation
  function fnv1a(str) {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  // Get deterministic origin-scoped seed
  function getOriginSeed() {
    try {
      return fnv1a(window.location.origin);
    } catch {
      return fnv1a('fallback-seed');
    }
  }

  const originSeed = getOriginSeed();
  const prng = mulberry32(originSeed);

  /**
   * WebGL Fingerprint Surface Hardening
   */
  function patchWebGL() {
    if (window.__psWebGLPatched__) return;
    window.__psWebGLPatched__ = true;

    const spoofedVendor = 'Google Inc. (Intel)';
    const spoofedRenderer = 'ANGLE (Intel, Intel(R) HD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)';

    // Store original methods
    const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
    const originalGetExtension = WebGLRenderingContext.prototype.getExtension;
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    
    // Patch WebGL2 if available
    let originalGetParameter2, originalGetExtension2;
    if (window.WebGL2RenderingContext) {
      originalGetParameter2 = WebGL2RenderingContext.prototype.getParameter;
      originalGetExtension2 = WebGL2RenderingContext.prototype.getExtension;
    }

    // Patch OffscreenCanvas if available
    let originalOffscreenGetContext;
    if (window.OffscreenCanvas) {
      originalOffscreenGetContext = OffscreenCanvas.prototype.getContext;
    }

    // Enhanced getParameter with deterministic spoofing
    function patchedGetParameter(parameter) {
      const result = originalGetParameter.call(this, parameter);
      
      // Handle UNMASKED_VENDOR_WEBGL and UNMASKED_RENDERER_WEBGL
      const ext = this.getExtension('WEBGL_debug_renderer_info');
      if (ext) {
        if (parameter === ext.UNMASKED_VENDOR_WEBGL) {
          return spoofedVendor;
        }
        if (parameter === ext.UNMASKED_RENDERER_WEBGL) {
          return spoofedRenderer;
        }
      }

      // Handle standard parameters
      switch (parameter) {
        case this.VENDOR:
          return spoofedVendor;
        case this.RENDERER:
          return spoofedRenderer;
        default:
          return result;
      }
    }

    // Enhanced getExtension to block debug renderer info
    function patchedGetExtension(name) {
      if (name === 'WEBGL_debug_renderer_info') {
        return null; // Block the extension entirely
      }
      return originalGetExtension.call(this, name);
    }

    // Apply patches to WebGL contexts
    WebGLRenderingContext.prototype.getParameter = patchedGetParameter;
    WebGLRenderingContext.prototype.getExtension = patchedGetExtension;

    if (window.WebGL2RenderingContext) {
      WebGL2RenderingContext.prototype.getParameter = function(parameter) {
        const result = originalGetParameter2.call(this, parameter);
        return patchedGetParameter.call(this, parameter) || result;
      };
      WebGL2RenderingContext.prototype.getExtension = patchedGetExtension;
    }

    // Patch getContext to catch WebGL contexts as they're created
    function patchedGetContext(contextType, contextAttributes) {
      const context = originalGetContext.call(this, contextType, contextAttributes);
      
      if (context && (contextType.includes('webgl') || contextType === 'experimental-webgl')) {
        // Apply patches to newly created contexts
        if (context.getParameter && !context.__psWebGLPatched__) {
          context.getParameter = patchedGetParameter.bind(context);
          context.getExtension = patchedGetExtension.bind(context);
          context.__psWebGLPatched__ = true;
        }
      }
      
      return context;
    }

    HTMLCanvasElement.prototype.getContext = patchedGetContext;

    // Patch OffscreenCanvas contexts
    if (window.OffscreenCanvas) {
      OffscreenCanvas.prototype.getContext = function(contextType, contextAttributes) {
        const context = originalOffscreenGetContext.call(this, contextType, contextAttributes);
        
        if (context && (contextType.includes('webgl') || contextType === 'experimental-webgl')) {
          if (context.getParameter && !context.__psWebGLPatched__) {
            context.getParameter = patchedGetParameter.bind(context);
            context.getExtension = patchedGetExtension.bind(context);
            context.__psWebGLPatched__ = true;
          }
        }
        
        return context;
      };
    }

    // Patch transferControlToOffscreen for late context creation
    if (HTMLCanvasElement.prototype.transferControlToOffscreen) {
      const originalTransfer = HTMLCanvasElement.prototype.transferControlToOffscreen;
      HTMLCanvasElement.prototype.transferControlToOffscreen = function() {
        const offscreen = originalTransfer.call(this);
        
        // Patch the offscreen canvas immediately
        if (offscreen && offscreen.getContext) {
          const originalOffscreenMethod = offscreen.getContext;
          offscreen.getContext = function(contextType, contextAttributes) {
            const context = originalOffscreenMethod.call(this, contextType, contextAttributes);
            
            if (context && (contextType.includes('webgl') || contextType === 'experimental-webgl')) {
              if (context.getParameter && !context.__psWebGLPatched__) {
                context.getParameter = patchedGetParameter.bind(context);
                context.getExtension = patchedGetExtension.bind(context);
                context.__psWebGLPatched__ = true;
              }
            }
            
            return context;
          };
        }
        
        return offscreen;
      };
    }
  }

  /**
   * Canvas Fingerprint Surface Hardening
   */
  function patchCanvas() {
    if (window.__psCanvasPatched__) return;
    window.__psCanvasPatched__ = true;

    // Store original methods
    const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
    const originalToBlob = HTMLCanvasElement.prototype.toBlob;
    const originalMeasureText = CanvasRenderingContext2D.prototype.measureText;

    // OffscreenCanvas methods if available
    let originalOffscreenConvertToBlob;
    if (window.OffscreenCanvas) {
      originalOffscreenConvertToBlob = OffscreenCanvas.prototype.convertToBlob;
    }

    // Add deterministic noise to canvas data
    function addCanvasNoise(imageData) {
      const data = imageData.data;
      const localPrng = mulberry32(originSeed + data.length);
      
      // Noise rate ~0.005% of pixels, capped at 200 for performance
      const pixelCount = data.length / 4;
      const noiseCount = Math.min(200, Math.max(1, Math.floor(pixelCount * 0.00005)));
      
      for (let i = 0; i < noiseCount; i++) {
        const pixelIndex = Math.floor(localPrng() * pixelCount) * 4;
        const channel = Math.floor(localPrng() * 3); // R, G, or B
        const noise = Math.floor(localPrng() * 3) - 1; // -1, 0, or 1
        
        data[pixelIndex + channel] = Math.max(0, Math.min(255, data[pixelIndex + channel] + noise));
      }
      
      return imageData;
    }

    // Patched getImageData with noise injection
    CanvasRenderingContext2D.prototype.getImageData = function(sx, sy, sw, sh) {
      const imageData = originalGetImageData.call(this, sx, sy, sw, sh);
      return addCanvasNoise(imageData);
    };

    // Patched toDataURL with off-screen noise injection
    HTMLCanvasElement.prototype.toDataURL = function(type, quality) {
      // Create offscreen copy to avoid visual flicker
      const offscreen = document.createElement('canvas');
      offscreen.width = this.width;
      offscreen.height = this.height;
      const offscreenCtx = offscreen.getContext('2d');
      
      offscreenCtx.drawImage(this, 0, 0);
      
      // Add noise to offscreen copy
      try {
        const imageData = offscreenCtx.getImageData(0, 0, offscreen.width, offscreen.height);
        addCanvasNoise(imageData);
        offscreenCtx.putImageData(imageData, 0, 0);
        return offscreen.toDataURL(type, quality);
      } catch {
        // Fallback if noise injection fails
        return originalToDataURL.call(this, type, quality);
      }
    };

    // Patched toBlob with off-screen noise injection
    HTMLCanvasElement.prototype.toBlob = function(callback, type, quality) {
      const offscreen = document.createElement('canvas');
      offscreen.width = this.width;
      offscreen.height = this.height;
      const offscreenCtx = offscreen.getContext('2d');
      
      offscreenCtx.drawImage(this, 0, 0);
      
      try {
        const imageData = offscreenCtx.getImageData(0, 0, offscreen.width, offscreen.height);
        addCanvasNoise(imageData);
        offscreenCtx.putImageData(imageData, 0, 0);
        offscreen.toBlob(callback, type, quality);
      } catch {
        // Fallback if noise injection fails
        originalToBlob.call(this, callback, type, quality);
      }
    };

    // Patch OffscreenCanvas.convertToBlob if available
    if (window.OffscreenCanvas && originalOffscreenConvertToBlob) {
      OffscreenCanvas.prototype.convertToBlob = function(options) {
        // For OffscreenCanvas, we need to work with the existing context
        const ctx = this.getContext('2d');
        if (ctx) {
          try {
            const imageData = ctx.getImageData(0, 0, this.width, this.height);
            addCanvasNoise(imageData);
            ctx.putImageData(imageData, 0, 0);
          } catch {
            // Ignore errors and proceed with original method
          }
        }
        return originalOffscreenConvertToBlob.call(this, options);
      };
    }

    // Patched measureText with deterministic jitter and rounding
    CanvasRenderingContext2D.prototype.measureText = function(text) {
      const metrics = originalMeasureText.call(this, text);
      
      // Add deterministic jitter (±0.01 px) then quantize to 0.5 px
      const textSeed = fnv1a(text + this.font);
      const localPrng = mulberry32(originSeed + textSeed);
      
      const jitter = (localPrng() - 0.5) * 0.02; // ±0.01 px
      const newWidth = metrics.width + jitter;
      
      // Quantize to 0.5 px increments
      const quantizedWidth = Math.round(newWidth * 2) / 2;
      
      // Create new metrics object with modified width
      return {
        ...metrics,
        width: quantizedWidth
      };
    };
  }

  /**
   * Audio Fingerprint Mitigation
   */
  function patchAudio() {
    if (window.__psAudioPatched__) return;
    window.__psAudioPatched__ = true;

    if (!window.AudioBuffer) return;

    const originalGetChannelData = AudioBuffer.prototype.getChannelData;

    AudioBuffer.prototype.getChannelData = function(channel) {
      const channelData = originalGetChannelData.call(this, channel);
      
      // Add tiny deterministic jitter to break exact reproducibility
      const bufferSeed = originSeed + this.length + this.sampleRate + channel;
      const localPrng = mulberry32(bufferSeed);
      
      // Modify at most 20 samples with amplitude ~1e-7 (inaudible)
      const sampleCount = Math.min(20, channelData.length);
      
      for (let i = 0; i < sampleCount; i++) {
        const sampleIndex = Math.floor(localPrng() * channelData.length);
        const jitter = (localPrng() - 0.5) * 2e-7; // ±1e-7
        channelData[sampleIndex] += jitter;
      }
      
      return channelData;
    };
  }

  /**
   * DOM Geometry Entropy Reduction
   */
  function patchDOMGeometry() {
    if (window.__psDOMGeometryPatched__) return;
    window.__psDOMGeometryPatched__ = true;

    const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
    const originalGetClientRects = Element.prototype.getClientRects;

    // Round values to 0.5 px increments for consistent, non-random reduction
    function roundTo05(value) {
      return Math.round(value * 2) / 2;
    }

    Element.prototype.getBoundingClientRect = function() {
      const rect = originalGetBoundingClientRect.call(this);
      
      return {
        x: roundTo05(rect.x),
        y: roundTo05(rect.y),
        width: roundTo05(rect.width),
        height: roundTo05(rect.height),
        top: roundTo05(rect.top),
        right: roundTo05(rect.right),
        bottom: roundTo05(rect.bottom),
        left: roundTo05(rect.left)
      };
    };

    Element.prototype.getClientRects = function() {
      const rects = originalGetClientRects.call(this);
      
      // Convert DOMRectList to array and round values
      const roundedRects = Array.from(rects).map(rect => ({
        x: roundTo05(rect.x),
        y: roundTo05(rect.y),
        width: roundTo05(rect.width),
        height: roundTo05(rect.height),
        top: roundTo05(rect.top),
        right: roundTo05(rect.right),
        bottom: roundTo05(rect.bottom),
        left: roundTo05(rect.left)
      }));
      
      // Return array-like object with DOMRectList interface
      roundedRects.item = function(index) {
        return this[index] || null;
      };
      
      return roundedRects;
    };
  }

  /**
   * Timing Fingerprint Protection (bucket + jitter)
   */
  function patchTiming() {
    if (window.__psTimingPatched__) return;
    window.__psTimingPatched__ = true;

    const RES_MS = 100; // granularidad gruesa estilo RFP
    const originalNow = performance.now.bind(performance);
    const originalRAF = window.requestAnimationFrame.bind(window);
    const originalGetEntriesByType = performance.getEntriesByType.bind(performance);

    // Cache the bucket start time to ensure consistency
    let cachedBucketStart = null;
    let cachedJitter = null;
    
    const getBucketizedTime = (rawTime, salt = 0) => {
      const currentBucket = Math.floor(rawTime / RES_MS) * RES_MS;
      
      // Reset cache if we've moved to a new bucket
      if (cachedBucketStart !== currentBucket) {
        cachedBucketStart = currentBucket;
        const local = mulberry32((currentBucket ^ originSeed ^ salt) >>> 0);
        cachedJitter = Math.floor(local() * RES_MS);
      }
      
      return cachedBucketStart + cachedJitter;
    };

    performance.now = function() {
      const original = originalNow();
      return getBucketizedTime(original, 0xA11CE);
    };

    window.requestAnimationFrame = function(cb) {
      return originalRAF(ts => {
        const bucketized = getBucketizedTime(ts, 0xBEEF);
        cb(bucketized);
      });
    };

    performance.getEntriesByType = function(type) {
      const entries = originalGetEntriesByType(type);
      return entries.map(e => new Proxy(e, {
        get(target, prop, recv) {
          if (prop === 'startTime' || prop === 'duration') {
            const raw = Reflect.get(target, prop, recv);
            return getBucketizedTime(raw, prop === 'duration' ? 0xD00D : 0xC0DE);
          }
          return Reflect.get(target, prop, recv);
        }
      }));
    };

    // Mask functions to prevent detection
    maskFunction(performance.now, originalNow);
    maskFunction(window.requestAnimationFrame, originalRAF);
    maskFunction(performance.getEntriesByType, originalGetEntriesByType);
  }

  /**
   * Media Queries and Device Pixel Ratio Protection
   */
  function patchMatchMedia() {
    if (!window.matchMedia || window.__psMMPatched__) return;
    window.__psMMPatched__ = true;
    const orig = window.matchMedia.bind(window);

    const wrap = (mql, forcedMatches) => new Proxy(mql, {
      get(t, p, r) {
        if (p === 'matches' && forcedMatches != null) return forcedMatches;
        return Reflect.get(t, p, r);
      }
    });

    window.matchMedia = function(q) {
      const mql = orig(q);
      if (/prefers-color-scheme/i.test(q)) return wrap(mql, false);
      if (/prefers-reduced-motion/i.test(q)) return wrap(mql, false);
      return mql;
    };

    maskFunction(window.matchMedia, orig);
  }

  function patchDPRAndVisualViewport() {
    if (window.__psDPRPatched__) return;
    window.__psDPRPatched__ = true;

    const quantize = v => Math.round(v * 2) / 2; // pasos de 0.5

    try {
      const origDPR = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');
      const getter = () => quantize((origDPR?.get ? origDPR.get.call(window) : window.devicePixelRatio));
      Object.defineProperty(window, 'devicePixelRatio', { get: getter, configurable: true });
    } catch {}

    if (window.visualViewport && window.VisualViewport) {
      const scaleDesc = Object.getOwnPropertyDescriptor(VisualViewport.prototype, 'scale');
      if (scaleDesc?.get) {
        Object.defineProperty(VisualViewport.prototype, 'scale', {
          get() { return quantize(scaleDesc.get.call(this)); }
        });
      }
    }
  }

  /**
   * Font Fingerprinting Protection (preserving object shape)
   */
  function patchFonts() {
    if (window.__psFontsPatched__) return;
    window.__psFontsPatched__ = true;

    // document.fonts.check -> responde solo a genéricos
    if (document.fonts && document.fonts.check) {
      const origCheck = document.fonts.check.bind(document.fonts);
      document.fonts.check = function(fontSpec, text) {
        try {
          const spec = String(fontSpec || '');
          const isGeneric = /\b(monospace|serif|sans-serif)\b/i.test(spec);
          return isGeneric ? true : false; // no permite enumerar instaladas
        } catch { return false; }
      };
      
      maskFunction(document.fonts.check, origCheck);
    }

    // Canvas text metrics: conserva el prototipo usando Proxy
    if (CanvasRenderingContext2D.prototype.measureText) {
      const origMeasure = CanvasRenderingContext2D.prototype.measureText;
      CanvasRenderingContext2D.prototype.measureText = function(txt) {
        const m = origMeasure.call(this, txt);
        const q = v => Math.round(v * 2) / 2;
        return new Proxy(m, {
          get(t, p, r) {
            if (p === 'width') return q(Reflect.get(t, p, r));
            return Reflect.get(t, p, r);
          }
        });
      };
      
      maskFunction(CanvasRenderingContext2D.prototype.measureText, origMeasure);
    }
  }

  /**
   * Enhanced Audio Fingerprinting Protection (AnalyserNode)
   */
  function patchAudioAnalyser() {
    if (!window.AnalyserNode || window.__psAnalyserPatched__) return;
    window.__psAnalyserPatched__ = true;

    const jitter = (arr, salt) => {
      const local = mulberry32((originSeed ^ salt) >>> 0);
      for (let i = 0; i < arr.length; i += Math.max(1, (arr.length/32|0))) {
        arr[i] += (local() - 0.5) * 1e-3;
      }
    };

    const A = AnalyserNode.prototype;
    const gf = A.getFloatFrequencyData;
    if (gf) {
      A.getFloatFrequencyData = function(a){ gf.call(this, a); jitter(a, 0xF00D); };
      maskFunction(A.getFloatFrequencyData, gf);
    }
    const gb = A.getByteFrequencyData;
    if (gb) {
      A.getByteFrequencyData = function(a){ gb.call(this, a); jitter(a, 0xFACE); };
      maskFunction(A.getByteFrequencyData, gb);
    }
    const gt = A.getFloatTimeDomainData;
    if (gt) {
      A.getFloatTimeDomainData = function(a){ gt.call(this, a); jitter(a, 0xCAFE); };
      maskFunction(A.getFloatTimeDomainData, gt);
    }
  }

  /**
   * Battery API Protection
   */
  function patchBattery() {
    if (window.__psBatteryPatched__) return;
    window.__psBatteryPatched__ = true;

    // Remove getBattery from Navigator prototype
    try {
      delete Navigator.prototype.getBattery;
      Object.defineProperty(Navigator.prototype, 'getBattery', { 
        value: undefined, 
        configurable: false,
        writable: false
      });
    } catch {}
    
    // Remove battery property from Navigator prototype  
    try {
      delete Navigator.prototype.battery;
      Object.defineProperty(Navigator.prototype, 'battery', { 
        get: () => undefined,
        configurable: false
      });
    } catch {}
    
    // Also remove from navigator instance if they exist
    try {
      delete navigator.getBattery;
      delete navigator.battery;
    } catch {}
  }

  /**
   * WebRTC Protection (page-world)
   */
  function patchWebRTC(mode = 'block') { // 'block' | 'relay'
    if (!window.RTCPeerConnection || window.__psWrtcPatched__) return;
    window.__psWrtcPatched__ = true;

    const ORTC = window.RTCPeerConnection;

    if (mode === 'block') {
      const Blocked = function() { throw new DOMException('NotAllowedError'); };
      Blocked.prototype = ORTC.prototype;
      window.RTCPeerConnection = Blocked;

      if (navigator.mediaDevices?.getUserMedia) {
        const gum = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
        navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('NotAllowedError'));
      }
      return;
    }

    // relay-only: filtra candidates host/srflx
    const P = ORTC.prototype;
    const origCreateOffer = P.createOffer;
    P.createOffer = async function(...args) {
      const desc = await origCreateOffer.apply(this, args);
      desc.sdp = desc.sdp.split('\r\n').filter(l => !/^a=candidate:.* (host|srflx) /i.test(l)).join('\r\n');
      return desc;
    };
    const origAddIce = P.addIceCandidate;
    P.addIceCandidate = function(cand, ...rest) {
      const s = (cand && (cand.candidate || cand)) || '';
      if (/ typ (host|srflx) /i.test(s)) return Promise.resolve();
      return origAddIce.call(this, cand, ...rest);
    };

    maskFunction(P.createOffer, origCreateOffer);
    maskFunction(P.addIceCandidate, origAddIce);
  }

  /**
   * Function Masking to Prevent Detection
   */
  const nativeToString = Function.prototype.toString;
  function maskFunction(patched, original) {
    if (!original || !patched) return;
    try {
      Object.defineProperty(patched, 'name', { value: original.name, configurable: true });
      Object.defineProperty(patched, 'length', { value: original.length, configurable: true });
      patched.toString = nativeToString.bind(original);
    } catch {}
  }

  /**
   * Initialize fingerprint protection
   * Called by the content script injection system
   */
  function initializeProtection(settings, whitelist, blacklist, msgId) {
    try {
      // Check if protection should be applied
      if (!settings.enabled) {
        console.log('[Privacy Shield] Protection disabled in settings');
        return;
      }

      // Apply patches based on settings
      if (settings.spoofWebGL) {
        patchWebGL();
      }
      
      if (settings.spoofCanvas) {
        patchCanvas();
      }
      
      if (settings.spoofAudio) {
        patchAudio();
      }
      
      // New enhanced protections
      if (settings.timingProtection) {
        patchTiming();
      }
      
      if (settings.cssFingerprint) {
        patchMatchMedia();
        patchDPRAndVisualViewport();
      }
      
      if (settings.fontEnumeration) {
        patchFonts();
      }
      
      if (settings.audioFingerprint) {
        patchAudioAnalyser();
      }
      
      if (settings.batteryAPI) {
        patchBattery();
      }
      
      if (settings.blockWebRTC) {
        patchWebRTC(settings.webrtcMode || 'block');
      }
      
      // DOM geometry is always protected when enabled
      patchDOMGeometry();
      
      console.log('[Privacy Shield] Fingerprint surface hardening applied');
      
      // Send ACK back to content script
      if (msgId) {
        window.postMessage({
          type: 'PS_ACK',
          id: msgId,
          __psToken: 'content-script-token' // This should match the token system
        }, location.origin);
      }
      
    } catch (error) {
      console.error('[Privacy Shield] Error applying patches:', error);
    }
  }

  // Export initialization function for content script
  window.initializeProtection = initializeProtection;

  // If called directly (not through content script), apply all patches
  if (!window.chrome || !window.chrome.runtime) {
    // Direct execution, apply all patches for testing
    patchWebGL();
    patchCanvas();
    patchAudio();
    patchDOMGeometry();
    patchTiming();
    patchMatchMedia();
    patchDPRAndVisualViewport();
    patchFonts();
    patchAudioAnalyser();
    patchBattery();
    patchWebRTC('block');
    console.log('[Privacy Shield] Direct fingerprint surface hardening applied');
  }
})();