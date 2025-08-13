(function() {
  const DEFAULTS = {
    enabled: true,
    spoofUserAgent: false,   // desactivado por defecto para reducir inconsistencias
    // OLD: spoofScreen: false, // (reintroducido como opción controlada)
    spoofTimezone: false,    // desactivado por defecto (difícil alinear con offset real)
    spoofWebGL: true,        // eficaz y seguro
    spoofCanvas: true,       // eficaz con ruido mínimo
    preserveAuth: true,
    whitelistPatterns: [],
    blacklistPatterns: [],
    // NEW: Opciones avanzadas (desactivadas por defecto)
    spoofScreen: false,      // falsear Screen + devicePixelRatio (opcional)
    spoofHardware: false,    // falsear navigator.hardwareConcurrency (opcional)
    // AGGRESSIVE: Nuevas protecciones agresivas
    blockBattery: true,      // bloquear Battery API
    blockGamepad: true,      // bloquear Gamepad API  
    blockWebRTC: true,       // proteger WebRTC IP leaks
    blockFonts: true,        // bloquear enumeración de fuentes
    detectFingerprinting: true // detectar intentos de fingerprinting
  };

  const BUILTIN_TRUSTED = [
    "accounts.google.com",
    "login.microsoftonline.com",
    "auth0.com",
    "okta.com",
    "login.yahoo.com",
    "secure.bankofamerica.com",
    "chase.com",
    "wellsfargo.com",
    "paypal.com",
    "amazon.com"
  ];

  // Robust injection function with multiple attempts
  function injectProtections(settings, safeWhitelist, safeBlacklist) {
    const injection = `
    (function(pageSettings, WL, BL){
      'use strict';

      // Self-protection marker
      if (window.__PRIVACY_SHIELD_INJECTED__) return;
      window.__PRIVACY_SHIELD_INJECTED__ = true;

      // NEW: Persona-based protection system
      let currentPersona = null;
      let personaFetchAttempted = false;

      // Fetch persona for coherent spoofing values
      async function fetchPersonaData() {
        if (personaFetchAttempted) return currentPersona;
        personaFetchAttempted = true;

        try {
          if (window.__PRIVACY_SHIELD_PERSONA_API__ && window.__PRIVACY_SHIELD_PERSONA_API__.requestPersona) {
            currentPersona = await window.__PRIVACY_SHIELD_PERSONA_API__.requestPersona();
            console.log('Privacy Shield: Using persona', currentPersona.id, 'for domain');
          }
        } catch (error) {
          console.warn('Privacy Shield: Failed to fetch persona, using fallback values:', error);
        }

        // Fallback to default values if persona fetch failed
        if (!currentPersona) {
          currentPersona = {
            id: 'fallback-windows-chrome',
            name: 'Fallback Windows Chrome',
            os: 'windows',
            browser: 'chrome',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            screen: {
              width: 1920,
              height: 1080,
              availWidth: 1920,
              availHeight: 1040,
              colorDepth: 24,
              pixelDepth: 24
            },
            devicePixelRatio: 1,
            timezone: 'America/New_York',
            language: 'en-US',
            languages: ['en-US', 'en'],
            webgl: {
              vendor: 'Google Inc.',
              renderer: 'ANGLE (Intel, Intel(R) HD Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)'
            },
            hardwareConcurrency: 4,
            platform: 'Win32'
          };
        }

        return currentPersona;
      }

      // Initialize persona data immediately
      fetchPersonaData();

      function getHostname() {
        try { return (new URL(location.href)).hostname.toLowerCase(); } catch(_) {}
        return (location.hostname || '').toLowerCase();
      }
      function hostMatchesPattern(host, pat) {
        if (!host || !pat) return false;
        if (pat.startsWith('*.')) {
          var base = pat.slice(2);
          return host === base || host.endsWith('.' + base);
        }
        return host === pat;
      }
      function matchesAny(host, list) {
        for (var i=0; i<list.length; i++) {
          if (hostMatchesPattern(host, list[i])) return true;
        }
        return false;
      }

      var host = getHostname();
      var inBlacklist = matchesAny(host, BL);
      var inWhitelist = matchesAny(host, WL);

      // trusted = preserva autenticación; blacklist fuerza protección
      // OLD: var onSecure = !!(pageSettings.preserveAuth && isSecureDomain());
      var trustedMode = !!(pageSettings.preserveAuth && inWhitelist && !inBlacklist);
      var forcedProtect = !!inBlacklist;
      var applyProtection = forcedProtect || !trustedMode;

      function safeDefine(obj, prop, descriptor) {
        try {
          var orig = Object.getOwnPropertyDescriptor(obj, prop);
          if (orig && orig.configurable === false) return false;
          Object.defineProperty(obj, prop, descriptor);
          return true;
        } catch(_) { return false; }
      }

      // Canvas: ruido mínimo en exportación y lectura, sin mutar el canvas original
      if (pageSettings.spoofCanvas && applyProtection) {
        var seed = 2166136261;
        for (var i=0;i<host.length;i++){ seed ^= host.charCodeAt(i); seed = Math.imul(seed, 16777619); }
        function xorshift32(a){ return function(){ a ^= (a<<13); a^=(a>>>17); a^=(a<<5); return ((a>>>0)/4294967296);} }
        var rand = xorshift32(seed>>>0);
        var addNoise = function(imageData) {
          var d = imageData.data;
          for (var i = 0; i < d.length; i += 4) {
            var n = (rand() - 0.5) * 2; // -1..1
            d[i] = Math.max(0, Math.min(255, d[i] + n));
          }
          return imageData;
        };

        var origToDataURL = HTMLCanvasElement.prototype.toDataURL;
        HTMLCanvasElement.prototype.toDataURL = function(type, quality) {
          try {
            var w = this.width, h = this.height;
            var off = document.createElement('canvas');
            off.width = w; off.height = h;
            var ctx = off.getContext('2d');
            ctx.drawImage(this, 0, 0);
            var img = ctx.getImageData(0, 0, w, h);
            ctx.putImageData(addNoise(img), 0, 0);
            return origToDataURL.call(off, type, quality);
          } catch(e) {
            return origToDataURL.call(this, type, quality);
          }
        };

        var origToBlob = HTMLCanvasElement.prototype.toBlob;
        if (origToBlob) {
          HTMLCanvasElement.prototype.toBlob = function(callback, type, quality) {
            try {
              var w = this.width, h = this.height;
              var off = document.createElement('canvas');
              off.width = w; off.height = h;
              var ctx = off.getContext('2d');
              ctx.drawImage(this, 0, 0);
              var img = ctx.getImageData(0, 0, w, h);
              ctx.putImageData(addNoise(img), 0, 0);
              return origToBlob.call(off, callback, type, quality);
            } catch(e) {
              return origToBlob.call(this, callback, type, quality);
            }
          };
        }

        var origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
        CanvasRenderingContext2D.prototype.getImageData = function(sx, sy, sw, sh) {
          var img = origGetImageData.call(this, sx, sy, sw, sh);
          return addNoise(img);
        };
      }

      // WebGL: Use persona-based VENDOR/RENDERER values for coherent spoofing
      if (pageSettings.spoofWebGL && applyProtection) {
        var patchGL = function(proto) {
          if (!proto || !proto.getParameter) return;
          var origGetParameter = proto.getParameter;
          proto.getParameter = function(param) {
            try {
              // Wait for persona data and use persona values
              if (currentPersona && currentPersona.webgl) {
                if (param === this.RENDERER)  return currentPersona.webgl.renderer;
                if (param === this.VENDOR)    return currentPersona.webgl.vendor;
                if (param === 37446) return currentPersona.webgl.renderer; // UNMASKED_RENDERER_WEBGL
                if (param === 37445) return currentPersona.webgl.vendor;   // UNMASKED_VENDOR_WEBGL
              } else {
                // OLD: Fallback to static values if persona not available
                if (param === this.RENDERER)  return 'Intel(R) HD Graphics 4000';
                if (param === this.VENDOR)    return 'Intel Inc.';
                if (param === 37446) return 'Intel(R) HD Graphics 4000'; // UNMASKED_RENDERER_WEBGL
                if (param === 37445) return 'Intel Inc.';               // UNMASKED_VENDOR_WEBGL
              }
            } catch(_) {}
            return origGetParameter.call(this, param);
          };
          var origGetExtension = proto.getExtension;
          proto.getExtension = function(name) {
            if (name && String(name).toLowerCase() === 'webgl_debug_renderer_info') {
              return null;
            }
            return origGetExtension.call(this, name);
          };
        };
        try { if (typeof WebGLRenderingContext !== 'undefined') patchGL(WebGLRenderingContext.prototype); } catch(_){}  
        try { if (typeof WebGL2RenderingContext !== 'undefined') patchGL(WebGL2RenderingContext.prototype); } catch(_){}  
      }

      // UA: Use persona-based User Agent and platform for coherent spoofing
      if (pageSettings.spoofUserAgent && applyProtection) {
        // Use persona values for coherent spoofing
        var ua = currentPersona ? currentPersona.userAgent : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        var platform = currentPersona ? currentPersona.platform : 'Win32';
        
        safeDefine(Navigator.prototype, 'userAgent', { get: function(){ return ua; } });
        safeDefine(Navigator.prototype, 'platform',  { get: function(){ return platform; } });
        
        // NEW: Also spoof language to match persona
        if (currentPersona && currentPersona.language) {
          safeDefine(Navigator.prototype, 'language', { get: function(){ return currentPersona.language; } });
        }
        if (currentPersona && currentPersona.languages) {
          safeDefine(Navigator.prototype, 'languages', { get: function(){ return currentPersona.languages.slice(); } });
        }
      }

      // Timezone: Use persona-based timezone for coherent spoofing
      if (pageSettings.spoofTimezone && applyProtection) {
        var personaTimezone = currentPersona && currentPersona.timezone ? currentPersona.timezone : 'UTC';
        
        var origResolved = Intl.DateTimeFormat.prototype.resolvedOptions;
        Object.defineProperty(Intl.DateTimeFormat.prototype, 'resolvedOptions', {
          value: function() {
            var o = origResolved.call(this);
            return Object.assign({}, o, { timeZone: personaTimezone });
          }
        });
      }

      // NEW: Screen + devicePixelRatio spoof (opcional, desactivado por defecto)
      // OLD: El bloque siguiente ha sido desactivado y reemplazado por un proxy de window.screen sin modificar Screen.prototype ni devicePixelRatio.
      /* OLD:
      if (pageSettings.spoofScreen && applyProtection) {
        try {
          var fake = {
            width: 1920,
            height: 1080,
            availWidth: 1920,
            availHeight: 1040,
            colorDepth: 24,
            pixelDepth: 24,
            devicePixelRatio: 1
          };

          // Intento 1: Parchear en el prototipo Screen
          try {
            if (typeof Screen !== 'undefined') {
              var sp = Screen.prototype;
              var props = ['width','height','availWidth','availHeight','colorDepth','pixelDepth'];
              for (var si=0; si<props.length; si++) {
                (function(k){
                  var ok = safeDefine(sp, k, { configurable: true, enumerable: true, get: function(){ return fake[k]; } });
                })(props[si]);
              }
            }
          } catch(_) {}

          // Intento 2: Sobrescribir window.screen con un Proxy (si es posible)
          try {
            var originalScreen = window.screen;
            var proxied = new Proxy(originalScreen, {
              get: function(target, prop) {
                if (prop in fake) return fake[prop];
                var val = target[prop];
                return (typeof val === 'function') ? val.bind(target) : val;
              },
              has: function(target, prop) {
                if (prop in fake) return true;
                return prop in target;
              }
            });
            safeDefine(window, 'screen', { get: function(){ return proxied; } });
          } catch(_) {}

          // Alinear devicePixelRatio
          safeDefine(window, 'devicePixelRatio', { get: function(){ return fake.devicePixelRatio; } });
        } catch(_) {}
      }
      */

      // NEW: Screen spoof using persona data for coherent values
      if (pageSettings.spoofScreen && applyProtection) {
        try {
          // Use persona screen values if available, otherwise fallback to static
          var screenData = currentPersona && currentPersona.screen ? currentPersona.screen : {
            width: 1920,
            height: 1080,
            availWidth: 1920,
            availHeight: 1040,
            colorDepth: 24,
            pixelDepth: 24
          };

          const _origScreen = window.screen;

          const proxiedScreen = new Proxy(_origScreen, {
            get(target, prop) {
              if (prop === 'width')       return screenData.width;
              if (prop === 'height')      return screenData.height;
              if (prop === 'availWidth')  return screenData.availWidth;
              if (prop === 'availHeight') return screenData.availHeight;
              if (prop === 'availLeft')   return 0;
              if (prop === 'availTop')    return 0;
              if (prop === 'colorDepth')  return screenData.colorDepth;
              if (prop === 'pixelDepth')  return screenData.pixelDepth;
              const v = target[prop];
              return (typeof v === 'function') ? v.bind(target) : v;
            },
            has(target, prop) {
              if (['width','height','availWidth','availHeight','availLeft','availTop','colorDepth','pixelDepth'].includes(prop)) return true;
              return prop in target;
            }
          });

          // Usa helper seguro
          safeDefine(window, 'screen', { get() { return proxiedScreen; } });

          // NEW: Also spoof devicePixelRatio if provided in persona
          if (currentPersona && currentPersona.devicePixelRatio) {
            safeDefine(window, 'devicePixelRatio', { get() { return currentPersona.devicePixelRatio; } });
          }
          // OLD: Importante: NO tocar window.devicePixelRatio (mantener real) - now conditional based on persona
        } catch(_) {}
      }

      // NEW: matchMedia patch using persona screen dimensions
      if (pageSettings.spoofScreen && applyProtection) {
        try {
          // Use persona screen dimensions if available
          var screenData = currentPersona && currentPersona.screen ? currentPersona.screen : {
            width: 1920,
            height: 1080
          };

          const _nativeMM = window.matchMedia;
          const DEVICE_RE = /(min|max)?-?device-(width|height)\s*: \s*(\d+(\.\d+)?)px/i;

          function evalDeviceQuery(q) {
            const m = q.match(DEVICE_RE);
            if (!m) return null; // no es device-* 
            const bound = (m[1] || '').toLowerCase();   // '', 'min', 'max'
            const side  = m[2].toLowerCase();           // 'width' | 'height'
            const px    = parseFloat(m[3]);
            const val   = (side === 'width') ? screenData.width : screenData.height;
            if (!bound)         return val === px;
            if (bound === 'min') return val >= px;
            if (bound === 'max') return val <= px;
            return false;
          }

          window.matchMedia = function(query) {
            const q = String(query || '');
            const res = evalDeviceQuery(q);
            if (res === null) return _nativeMM.call(this, q);

            // Clonar forma de MediaQueryList nativa
            const mql = _nativeMM.call(this, 'all');
            try {
              Object.defineProperty(mql, 'media',   { value: q, configurable: true });
              Object.defineProperty(mql, 'matches', { get() { return !!res; }, configurable: true });
            } catch(_) {}
            return mql;
          };

          // Opcional: disimular toString() para reducir heurísticas simples
          try {
            const _toString = Function.prototype.toString;
            Function.prototype.toString = new Proxy(_toString, {
              apply(target, thisArg, args) {
                try { if (thisArg === window.matchMedia) return 'function matchMedia() { [native code] }'; } catch(_) {}
                return target.apply(thisArg, args);
              }
            });
          } catch(_) {}
        } catch(e) {}
      }

      /* Opcional: visualViewport proxy (solo si querés máxima coherencia)
      if ('visualViewport' in window && pageSettings.spoofScreen && applyProtection) {
        try {
          var _vv = window.visualViewport;
          var _vvProxy = new Proxy(_vv, {
            get: function(target, prop) {
              if (prop === 'width')  return Math.min(window.screen.width,  window.innerWidth  || target.width);
              if (prop === 'height') return Math.min(window.screen.height, window.innerHeight || target.height);
              var v = target[prop];
              return (typeof v === 'function') ? v.bind(target) : v;
            }
          });
          safeDefine(window, 'visualViewport', { get: function(){ return _vvProxy; } });
        } catch(_) {}
      }
      */

      // NEW: hardwareConcurrency spoof using persona data
      if (pageSettings.spoofHardware && applyProtection) {
        try {
          var cores = currentPersona && currentPersona.hardwareConcurrency ? currentPersona.hardwareConcurrency : 4;
          safeDefine(Navigator.prototype, 'hardwareConcurrency', { get: function(){ return cores; } });
        } catch(_) {}
      }

      // AGGRESSIVE: Battery API blocking
      if (pageSettings.blockBattery && applyProtection) {
        try {
          if ('getBattery' in navigator) {
            navigator.getBattery = function() {
              return Promise.reject(new DOMException('Battery API disabled for privacy', 'NotAllowedError'));
            };
          }
          // Block battery events
          safeDefine(Navigator.prototype, 'getBattery', { 
            value: function() { 
              return Promise.reject(new DOMException('Battery API disabled for privacy', 'NotAllowedError')); 
            } 
          });
        } catch(_) {}
      }

      // AGGRESSIVE: Gamepad API blocking  
      if (pageSettings.blockGamepad && applyProtection) {
        try {
          safeDefine(Navigator.prototype, 'getGamepads', { 
            value: function() { return []; } 
          });
          // Prevent gamepad events
          var origAddEventListener = EventTarget.prototype.addEventListener;
          EventTarget.prototype.addEventListener = function(type, listener, options) {
            if (type && typeof type === 'string' && type.toLowerCase().includes('gamepad')) {
              return; // silently ignore gamepad event listeners
            }
            return origAddEventListener.call(this, type, listener, options);
          };
        } catch(_) {}
      }

      // AGGRESSIVE: WebRTC IP leak protection
      if (pageSettings.blockWebRTC && applyProtection) {
        try {
          var rtcBlocked = function() { 
            throw new DOMException('WebRTC disabled for privacy', 'NotSupportedError'); 
          };
          if ('RTCPeerConnection' in window) window.RTCPeerConnection = rtcBlocked;
          if ('webkitRTCPeerConnection' in window) window.webkitRTCPeerConnection = rtcBlocked;
          if ('mozRTCPeerConnection' in window) window.mozRTCPeerConnection = rtcBlocked;
          
          // Block getUserMedia for additional privacy
          if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia = function() {
              return Promise.reject(new DOMException('Media access disabled for privacy', 'NotAllowedError'));
            };
          }
        } catch(_) {}
      }

      // AGGRESSIVE: Font enumeration blocking
      if (pageSettings.blockFonts && applyProtection) {
        try {
          // Block document.fonts if available
          if ('fonts' in document && document.fonts) {
            var emptyFontFaceSet = {
              size: 0,
              add: function() { return this; },
              clear: function() {},
              delete: function() { return false; },
              entries: function() { return [][Symbol.iterator](); },
              forEach: function() {},
              has: function() { return false; },
              keys: function() { return [][Symbol.iterator](); },
              values: function() { return [][Symbol.iterator](); },
              [Symbol.iterator]: function() { return [][Symbol.iterator](); }
            };
            try {
              Object.defineProperty(document, 'fonts', {
                get: function() { return emptyFontFaceSet; },
                configurable: true
              });
            } catch(_) {}
          }
        } catch(_) {}
      }

      // DETECTION: Monitor fingerprinting attempts
      var fingerprintingDetected = 0;
      if (pageSettings.detectFingerprinting && applyProtection) {
        try {
          // Monitor canvas operations that might be fingerprinting
          var origToDataURL = HTMLCanvasElement.prototype.toDataURL;
          HTMLCanvasElement.prototype.toDataURL = function() {
            try {
              // Detect potential fingerprinting by canvas size and context
              if (this.width * this.height < 100 && this.getContext) {
                fingerprintingDetected++;
                window.postMessage({ 
                  type: 'PRIVACY_SHIELD_DETECTION', 
                  method: 'canvas_fingerprint',
                  property: 'canvas.size',
                  value: this.width + 'x' + this.height,
                  count: fingerprintingDetected 
                }, '*');
              }
            } catch(_) {}
            return origToDataURL.apply(this, arguments);
          };

          // Monitor WebGL parameter queries
          var patchGLDetection = function(proto) {
            if (!proto || !proto.getParameter) return;
            var origGetParameter = proto.getParameter;
            proto.getParameter = function(param) {
              try {
                // Common fingerprinting parameters
                var suspiciousParams = [
                  this.VENDOR, this.RENDERER, this.VERSION,
                  this.SHADING_LANGUAGE_VERSION, 37445, 37446
                ];
                if (suspiciousParams.includes(param)) {
                  fingerprintingDetected++;
                  
                  // Map parameter number to name for better reporting
                  const paramNames = {
                    37445: 'UNMASKED_VENDOR_WEBGL',
                    37446: 'UNMASKED_RENDERER_WEBGL',
                    7936: 'VENDOR',
                    7937: 'RENDERER',
                    7938: 'VERSION',
                    35724: 'SHADING_LANGUAGE_VERSION'
                  };
                  
                  const paramName = paramNames[param] || param.toString();
                  
                  window.postMessage({ 
                    type: 'PRIVACY_SHIELD_DETECTION', 
                    method: 'webgl_fingerprint',
                    property: 'webgl.' + paramName,
                    value: param.toString(),
                    count: fingerprintingDetected 
                  }, '*');
                }
              } catch(_) {}
              return origGetParameter.call(this, param);
            };
          };
          try { if (typeof WebGLRenderingContext !== 'undefined') patchGLDetection(WebGLRenderingContext.prototype); } catch(_){}  
          try { if (typeof WebGL2RenderingContext !== 'undefined') patchGLDetection(WebGL2RenderingContext.prototype); } catch(_){}  
        } catch(_) {}
      }

      // Monitor navigator property access
      var navigatorAccess = 0;
      var suspiciousProps = ['userAgent', 'platform', 'hardwareConcurrency', 'deviceMemory', 'connection'];
      suspiciousProps.forEach(function(prop) {
        try {
          if (prop in Navigator.prototype) {
            var desc = Object.getOwnPropertyDescriptor(Navigator.prototype, prop);
            if (desc && desc.get) {
              var originalGetter = desc.get;
              Object.defineProperty(Navigator.prototype, prop, {
                get: function() {
                  navigatorAccess++;
                  if (navigatorAccess > 3) { // threshold for detection
                    fingerprintingDetected++;
                    window.postMessage({ 
                      type: 'PRIVACY_SHIELD_DETECTION', 
                      method: 'navigator_fingerprint',
                      property: prop,
                      count: fingerprintingDetected 
                    }, '*');
                  }
                  return originalGetter.call(this);
                },
                configurable: true,
                enumerable: true
              });
            }
          }
        } catch(_) {}
      });
    } catch (e) {
      // En caso de error, no interferir con la página
    }

    // Listen for fingerprinting detection messages from injected script
    window.addEventListener('message', function(event) {
      if (event.source !== window) return;
      if (event.data && event.data.type === 'PRIVACY_SHIELD_DETECTION') {
        // Map legacy detection methods to new categories for enhanced reporting
        const detectionMapping = {
          'canvas_fingerprint': { category: 'canvas', severity: 'high' },
          'webgl_fingerprint': { category: 'webgl', severity: 'high' },
          'navigator_fingerprint': { category: 'navigator', severity: 'medium' },
          'screen_fingerprint': { category: 'screen', severity: 'medium' },
          'audio_fingerprint': { category: 'audio', severity: 'high' },
          'font_fingerprint': { category: 'fonts', severity: 'medium' }
        };

        const mappedDetection = detectionMapping[event.data.method] || {
          category: 'navigator',
          severity: 'medium'
        };

        // Send both legacy and new format messages for compatibility
        // OLD: Keep legacy format for existing functionality
        chrome.runtime.sendMessage({
          action: 'fingerprintingDetected',
          method: event.data.method,
          count: event.data.count,
          property: event.data.property,
          url: window.location.href
        }).catch(() => {}); // Ignore if background script is not available

        // NEW: Send enhanced detection message with categorization
        chrome.runtime.sendMessage({
          type: 'FINGERPRINTING_DETECTED',
          category: mappedDetection.category,
          method: event.data.method,
          severity: mappedDetection.severity,
          property: event.data.property,
          value: event.data.value,
          count: event.data.count,
          url: window.location.href
        }).catch(() => {}); // Ignore if background script is not available
      }
    }, false);
    `;

    // Multiple injection attempts for robustness
    function attemptInjection() {
      try {
        const s = document.createElement('script');
        s.textContent = injection;
        s.setAttribute('data-privacy-shield', 'injected');
        
        // Try different injection points
        const targets = [
          document.documentElement,
          document.head,
          document.body,
          document
        ];
        
        for (const target of targets) {
          if (target) {
            target.appendChild(s);
            s.remove();
            return true;
          }
        }
      } catch(_) {}
      return false;
    }

    // Initial injection attempt
    if (!attemptInjection()) {
      // Retry injection when DOM is ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attemptInjection, { once: true });
      }
      // Final attempt when everything is loaded
      if (document.readyState !== 'complete') {
        window.addEventListener('load', attemptInjection, { once: true });
      }
    }
  }

  try {
    chrome.storage.sync.get(DEFAULTS, (settings) => {
      if (!settings || settings.enabled === false) return;

      // Sanitiza patrones antes de inyectar
      function sanitizePatterns(arr) {
        if (!Array.isArray(arr)) return [];
        const out = [];
        for (const raw of arr) {
          if (typeof raw !== 'string') continue;
          let s = raw.trim().toLowerCase();
          if (!s) continue;
          try {
            // quitar esquema/puerto/path si pegaron una URL completa
            if (s.includes("://")) {
              const u = new URL(s);
              s = u.hostname.toLowerCase();
            }
          } catch (_) {}
          s = s.replace(/^\.+/, ''); // quitar puntos iniciales
          if (s.startsWith('*.')) s = '*.' + s.slice(2).replace(/^\.+/, '');
          // invalidar si contiene espacios o barras
          if (/\s|\//.test(s)) continue;
          if (s.length > 255) continue;
          // permitir exacto o comodín prefijo
          if (s.startsWith('*.')) {
            const base = s.slice(2);
            if (!base || base.includes('*')) continue;
            out.push('*.' + base);
          } else {
            if (s.includes('*')) continue;
            out.push(s);
          }
        }
        return Array.from(new Set(out));
      }

      const safeWhitelist = sanitizePatterns([...(settings.whitelistPatterns || []), ...BUILTIN_TRUSTED]);
      const safeBlacklist = sanitizePatterns(settings.blacklistPatterns || []);

      // Inject protections using robust injection function
      injectProtections(settings, safeWhitelist, safeBlacklist);
    });

    // NEW: Persona Request Helper Function
    // Allow content scripts to request personas for the current domain
    function requestPersonaForDomain(osPreference) {
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          type: 'GET_PERSONA',
          osPreference: osPreference
        }).then(response => {
          if (response && response.success) {
            resolve(response.persona);
          } else {
            reject(new Error(response?.error || 'Failed to get persona'));
          }
        }).catch(reject);
      });
    }

    // NEW: Expose persona helper to injected scripts via window object
    // This allows page-level protection scripts to access persona data
    if (!window.__PRIVACY_SHIELD_PERSONA_API__) {
      window.__PRIVACY_SHIELD_PERSONA_API__ = {
        requestPersona: requestPersonaForDomain,
        version: '2.0'
      };
    }
  } catch (e) {
    // En caso de error, no interferir con la página
  }
})();
