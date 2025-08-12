// NOTE: When altering prior logic, keep the original lines commented with `// OLD:` just above the new code.
(function() {
  const DEFAULTS = {
    enabled: true,
    spoofUserAgent: false,   // desactivado por defecto para reducir inconsistencias
    // OLD: spoofScreen: false, // removido del set de toggles soportados
    spoofTimezone: false,    // desactivado por defecto (difícil alinear con offset real)
    spoofWebGL: true,        // eficaz y seguro
    spoofCanvas: true,       // eficaz con ruido mínimo
    preserveAuth: true,
    whitelistPatterns: [],
    blacklistPatterns: []
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

      const injection = `
      (function(pageSettings, WL, BL){
        'use strict';

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

        // WebGL: cubrir VENDOR/RENDERER y ocultar WEBGL_debug_renderer_info
        if (pageSettings.spoofWebGL && applyProtection) {
          var patchGL = function(proto) {
            if (!proto || !proto.getParameter) return;
            var origGetParameter = proto.getParameter;
            proto.getParameter = function(param) {
              try {
                if (param === this.RENDERER)  return 'Intel(R) HD Graphics 4000';
                if (param === this.VENDOR)    return 'Intel Inc.';
                if (param === 37446) return 'Intel(R) HD Graphics 4000'; // UNMASKED_RENDERER_WEBGL
                if (param === 37445) return 'Intel Inc.';               // UNMASKED_VENDOR_WEBGL
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

        // UA: solo JS (no headers). Por defecto desactivado para reducir inconsistencias visibles
        if (pageSettings.spoofUserAgent && applyProtection) {
          // OLD: No UA spoofing by default
          var ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
          safeDefine(Navigator.prototype, 'userAgent', { get: function(){ return ua; } });
          safeDefine(Navigator.prototype, 'platform',  { get: function(){ return 'Win32'; } });
        }

        // Timezone: limitado; por defecto desactivado para evitar inconsistencias
        if (pageSettings.spoofTimezone && applyProtection) {
          var origResolved = Intl.DateTimeFormat.prototype.resolvedOptions;
          Object.defineProperty(Intl.DateTimeFormat.prototype, 'resolvedOptions', {
            value: function() {
              var o = origResolved.call(this);
              return Object.assign({}, o, { timeZone: 'UTC' });
            }
          });
        }

        try { console.debug('Privacy Shield activo', { host, inBlacklist, inWhitelist, trustedMode, applyProtection }); } catch(_) {}
      })(${JSON.stringify({
        enabled: true,
        spoofUserAgent: settings.spoofUserAgent === true,
        spoofTimezone: settings.spoofTimezone === true,
        spoofWebGL: settings.spoofWebGL !== false,
        spoofCanvas: settings.spoofCanvas !== false,
        preserveAuth: settings.preserveAuth !== false
      })}, ${JSON.stringify(safeWhitelist)}, ${JSON.stringify(safeBlacklist)});
      `;

      const s = document.createElement('script');
      s.textContent = injection;
      (document.documentElement || document.head || document.documentElement).appendChild(s);
      s.remove();
    });
  } catch (e) {
    // En caso de error, no interferir con la página
  }
})();