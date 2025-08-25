(function() {
  /**
   * Stealth / CSP-safe injection
   * Goals:
   *  - Avoid direct prototype or native function overwrites (prefer per-instance proxies / accessors)
   *  - Use coherent persona values (fonts, UA, screen)
   *  - Minimal detectable surface (preserve original toString, prototype chains)
   *  - Very low-noise canvas (<0.01% pixels) + selective WebGL param masking
   *  - Do NOT blanket-block APIs (fonts) -> provide plausible subset
   */

  const DEFAULTS = {
    enabled: true,
    spoofUserAgent: false,
    spoofTimezone: false,
    spoofWebGL: true,
    spoofCanvas: true,
    preserveAuth: true,
    whitelistPatterns: [],
    blacklistPatterns: [],
    spoofScreen: false,
    spoofHardware: false,
    blockBattery: true,
    blockGamepad: true,
    blockWebRTC: true,
    blockFonts: false,          // switched to false (we now supply coherent fonts)
    detectFingerprinting: true
  };

  const BUILTIN_TRUSTED = [
    "accounts.google.com","login.microsoftonline.com","auth0.com","okta.com","login.yahoo.com","secure.bankofamerica.com","chase.com","wellsfargo.com","paypal.com","amazon.com"
  ];

  function injectScript(fn, ...args){
    try {
      // CSP-safer injection using blob URL and import
      const fnStr = fn.toString();
      const argsStr = args.map(a=>{try{return JSON.stringify(a);}catch{return 'null';}}).join(',');
      const code = `(${fnStr})(${argsStr});`;
      
      // Try blob URL approach first (more CSP-safe)
      try {
        const blob = new Blob([code], {type: 'application/javascript'});
        const url = URL.createObjectURL(blob);
        const s = document.createElement('script');
        s.src = url;
        s.onload = s.onerror = () => {
          URL.revokeObjectURL(url);
          s.remove();
        };
        (document.head||document.documentElement).prepend(s);
        return;
      } catch(e) {
        // Fallback to original method if blob approach fails
        const s=document.createElement('script');
        s.textContent = code;
        (document.head||document.documentElement).prepend(s); 
        s.remove();
      }
    } catch(e){}
  }

  function pageMain(settings, WL, BL){
    'use strict';
    if (window.__PRIVACY_SHIELD_INJECTED__) return; window.__PRIVACY_SHIELD_INJECTED__=true;

    const originalToString = Function.prototype.toString;
    const toStringCache = new WeakMap();
    function cloneFunctionSignature(original, wrapper){
      try { 
        // Enhanced signature preservation
        wrapper.toString = originalToString.bind(original); 
        wrapper.name = original.name;
        wrapper.length = original.length;
        // Copy any additional properties that might be checked
        Object.defineProperty(wrapper, 'prototype', {
          value: original.prototype,
          writable: false,
          enumerable: false,
          configurable: false
        });
      } catch(_){ }
      toStringCache.set(wrapper, original);
      return wrapper;
    }

    // Persona (simplified async fetch compatibility)
    let persona = null; let personaFetchAttempted=false;
    async function ensurePersona(){
      if (personaFetchAttempted) return persona; personaFetchAttempted=true;
      try {
        if (window.__PRIVACY_SHIELD_PERSONA_API__ && window.__PRIVACY_SHIELD_PERSONA_API__.requestPersona){
          persona = await window.__PRIVACY_SHIELD_PERSONA_API__.requestPersona();
        }
      }catch(_){ }
      if (!persona){
        persona = {
          id: 'fallback-windows-chrome',
          os: 'windows', browser: 'chrome',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
          screen: { width: 1920, height:1080, availWidth:1920, availHeight:1040, colorDepth:24, pixelDepth:24 },
          devicePixelRatio: 1,
          timezone: 'America/New_York',
          language: 'en-US', languages:['en-US','en'],
          webgl: { vendor: 'Google Inc.', renderer: 'ANGLE (Intel, Intel(R) UHD Graphics)' },
          hardwareConcurrency: 8,
          platform: 'Win32',
          fonts: [ // plausible Windows 10 core fonts
            'Arial','Calibri','Cambria','Candara','Consolas','Constantia','Corbel','Courier New','Georgia','Lucida Console','MS Gothic','MS PGothic','MS UI Gothic','Segoe UI','Segoe UI Symbol','Tahoma','Times New Roman','Trebuchet MS','Verdana'
          ]
        };
      }
      return persona;
    }
    ensurePersona(); // fire & forget

    function hostname(){ try { return new URL(location.href).hostname.toLowerCase(); } catch{ return location.hostname.toLowerCase(); } }
    function patternMatch(h,p){ if (!h||!p) return false; if (p.startsWith('*.')){ const b=p.slice(2); return h===b || h.endsWith('.'+b);} return h===p; }
    function anyMatch(h,list){ for(const p of list) if (patternMatch(h,p)) return true; return false; }

    const host = hostname();
    const inBL = anyMatch(host, BL); const inWL = anyMatch(host, WL);
    const trustedMode = !!(settings.preserveAuth && inWL && !inBL);
    const applyProtection = inBL || !trustedMode;

    // --- Navigator Proxy with enhanced stealth ---
    if (applyProtection && settings.spoofUserAgent){
      const realNav = window.navigator;
      const accessCounts = new Map(); // Track access patterns
      
      const personaUA = () => (persona? persona.userAgent : realNav.userAgent);
      const personaPlatform = () => (persona? persona.platform : realNav.platform);
      const personaLang = () => (persona? persona.language : realNav.language);
      const personaLangs = () => (persona? persona.languages : realNav.languages);
      const personaCores = () => (settings.spoofHardware && persona? persona.hardwareConcurrency : realNav.hardwareConcurrency);

      const navProxy = new Proxy(realNav, {
        get(target, prop, receiver){
          // Track access patterns for stealth
          const count = accessCounts.get(prop) || 0;
          accessCounts.set(prop, count + 1);
          
          switch(prop){
            case 'userAgent': 
              // Add slight variation to avoid fingerprinting consistency checks
              const ua = personaUA();
              return count > 10 && Math.random() < 0.05 ? ua + ' ' : ua;
            case 'platform': return personaPlatform();
            case 'language': return personaLang();
            case 'languages': 
              // Return a copy to prevent modification detection
              return Object.freeze([...personaLangs()]);
            case 'hardwareConcurrency': return personaCores();
            default: return Reflect.get(target, prop, receiver);
          }
        },
        has(target, prop){ return Reflect.has(target, prop); },
        ownKeys(target){ return Reflect.ownKeys(target); },
        getOwnPropertyDescriptor(target, prop){ return Reflect.getOwnPropertyDescriptor(target, prop); }
      });
      
      try {
        Object.defineProperty(window,'navigator',{
          get: cloneFunctionSignature(function(){}, function(){ return navProxy; }), 
          configurable:true
        });
      }catch(_){ /* ignore */ }
    }

    // --- Timezone spoof (Proxy Intl.DateTimeFormat) ---
    if (applyProtection && settings.spoofTimezone){
      const realDTF = Intl.DateTimeFormat;
      function WrappedDateTimeFormat(...args){ return new realDTF(...args); }
      cloneFunctionSignature(realDTF, WrappedDateTimeFormat);
      WrappedDateTimeFormat.prototype = realDTF.prototype;
      try {
        Object.defineProperty(Intl, 'DateTimeFormat', { value: new Proxy(WrappedDateTimeFormat, {
          construct(target, args){ const fmt = new realDTF(...args); return new Proxy(fmt, {
            get(obj, prop){ if (prop === 'resolvedOptions'){ const orig = obj.resolvedOptions.bind(obj); return cloneFunctionSignature(orig, function(){ const o=orig(); const tz = (persona && persona.timezone) || 'UTC'; return Object.assign({}, o, { timeZone: tz }); }); } return Reflect.get(obj, prop); }
          }); }
        }), configurable:true });
      }catch(_){ }
    }

    // --- Screen & innerWidth/innerHeight coherence ---
    if (applyProtection && settings.spoofScreen){
      const realScreen = window.screen;
      const orig = { w: realScreen.width, h: realScreen.height, aw: realScreen.availWidth, ah: realScreen.availHeight };
      function values(){ if (persona && persona.screen) return persona.screen; return { width:orig.w, height:orig.h, availWidth:orig.aw, availHeight:orig.ah, colorDepth: realScreen.colorDepth, pixelDepth: realScreen.pixelDepth }; }
      const screenProxy = new Proxy(realScreen, {
        get(t, prop){ const v=values(); switch(prop){
          case 'width': return v.width; case 'height': return v.height;
          case 'availWidth': return v.availWidth; case 'availHeight': return v.availHeight;
          case 'colorDepth': return v.colorDepth; case 'pixelDepth': return v.pixelDepth;
          default: return Reflect.get(t, prop);
        } }, has(t,p){ return p in t; }
      });
      try { Object.defineProperty(window,'screen',{get: cloneFunctionSignature(function(){}, function(){ return screenProxy; }), configurable:true}); }catch(_){ }

      // innerWidth/innerHeight proportional ratio
      const realInnerW = window.innerWidth; const realInnerH = window.innerHeight;
      function ratio(){ const v=values(); return { rx: v.width / orig.w, ry: v.height / orig.h }; }
      try { Object.defineProperties(window, {
        innerWidth: { get: cloneFunctionSignature(function(){}, function(){ const {rx}=ratio(); return Math.round(realInnerW * rx); }), configurable:true },
        innerHeight:{ get: cloneFunctionSignature(function(){}, function(){ const {ry}=ratio(); return Math.round(realInnerH * ry); }), configurable:true }
      }); }catch(_){ }

      // matchMedia adaptation
      const realMM = window.matchMedia;
      function patchedMatchMedia(q){ const v=values(); const re=/(min|max)?-?device-(width|height)\s*:\s*(\d+(?:\.\d+)?)px/i; const m=String(q).match(re); if(!m) return realMM(q); const bound=m[1]||''; const side=m[2]; const px=parseFloat(m[3]); let match=false; if(!bound) match = (val===px); else if(bound==='min') match = (val>=px); else if(bound==='max') match = (val<=px); const r=realMM('all'); try { Object.defineProperty(r,'media',{value:q,configurable:true}); Object.defineProperty(r,'matches',{get:()=>match, configurable:true}); }catch(_){ } return r; }
      cloneFunctionSignature(realMM, patchedMatchMedia);
      try { window.matchMedia = patchedMatchMedia; }catch(_){ }
    }

    // --- Canvas minimal noise (<0.01%) with per-instance proxies ---
    if (applyProtection && settings.spoofCanvas){
      const canvasInstances = new WeakMap();
      const origGetContext = HTMLCanvasElement.prototype.getContext;
      
      function wrappedGetContext(type, ...rest){
        const ctx = origGetContext.apply(this, [type, ...rest]);
        if (!ctx || (type!=='2d' && type!=='webgl' && type!=='webgl2')) return ctx;
        
        // Only proxy 2D contexts, return others as-is for WebGL separate handling
        if (type==='2d' && !canvasInstances.has(ctx)){
          const contextProxy = new Proxy(ctx, {
            get(target, prop){
              if (prop==='getImageData'){
                const orig = target.getImageData.bind(target);
                return cloneFunctionSignature(orig, function(x,y,w,h){ 
                  const data = orig(x,y,w,h); 
                  try { 
                    const total = data.data.length/4; 
                    const changes = Math.max(1, Math.floor(total*0.00005)); 
                    for(let i=0;i<changes;i++){ 
                      const p = (Math.random()*total)|0; 
                      const idx=p*4; 
                      // adjust only one channel by +-1
                      data.data[idx] = (data.data[idx] + (Math.random()<0.5?-1:1)) & 0xFF; 
                    } 
                  }catch(_){ } 
                  return data; 
                });
              }
              if (prop==='toDataURL'){
                const orig = target.toDataURL.bind(target);
                return cloneFunctionSignature(orig, function(...a){ 
                  try { 
                    // force a tiny pre-read to introduce noise path
                    const w = target.canvas.width; 
                    const h = target.canvas.height; 
                    if (w*h>0 && w*h<500000){ 
                      const sample = target.getImageData(0,0,Math.min(16,w), Math.min(16,h)); 
                      sample.data[0] ^= 0; 
                    }
                  }catch(_){ } 
                  return orig(...a); 
                });
              }
              if (prop==='toBlob' && typeof target.toBlob==='function'){
                const orig = target.toBlob.bind(target);
                return cloneFunctionSignature(orig, function(cb,type,qual){ 
                  return orig(function(blob){ cb(blob); }, type, qual); 
                });
              }
              return Reflect.get(target, prop);
            }
          });
          canvasInstances.set(ctx, contextProxy);
          return contextProxy;
        }
        return ctx; // for webgl we use separate path
      }
      cloneFunctionSignature(origGetContext, wrappedGetContext);
      try { HTMLCanvasElement.prototype.getContext = wrappedGetContext; }catch(_){ }
    }

    // --- WebGL selective param spoof with enhanced stealth ---
    if (applyProtection && settings.spoofWebGL){
      const overrideParams = new WeakMap();
      const queryCount = new WeakMap(); // Track query frequency for stealth
      
      function patchContext(gl){
        if (overrideParams.has(gl)) return gl;
        
        const vendorConst = gl.VENDOR, rendererConst = gl.RENDERER;
        const unmaskedVendor = 0x9245; // UNMASKED_VENDOR_WEBGL
        const unmaskedRenderer = 0x9246; // UNMASKED_RENDERER_WEBGL
        const realGetParameter = gl.getParameter.bind(gl);
        const personaVals = () => persona && persona.webgl ? persona.webgl : { 
          vendor:'Google Inc.', 
          renderer:'ANGLE (Intel, Intel(R) UHD Graphics)' 
        };
        
        // Initialize query counter
        queryCount.set(gl, 0);
        
        function wrappedGetParameter(p){
          const vals = personaVals();
          const count = queryCount.get(gl) || 0;
          queryCount.set(gl, count + 1);
          
          // Use variable probability based on query frequency to avoid patterns
          const baseProb = 0.6;
          const adjustedProb = Math.max(0.3, baseProb - (count * 0.05));
          
          if (p===unmaskedVendor || p===vendorConst){ 
            if (Math.random()<adjustedProb) return vals.vendor; 
          }
          if (p===unmaskedRenderer || p===rendererConst){ 
            if (Math.random()<adjustedProb) return vals.renderer; 
          }
          return realGetParameter(p);
        }
        cloneFunctionSignature(realGetParameter, wrappedGetParameter);
        
        const handler = {
          get(t,prop){ 
            if (prop==='getParameter') return wrappedGetParameter; 
            return Reflect.get(t,prop); 
          }
        };
        const prox = new Proxy(gl, handler);
        overrideParams.set(gl, prox); 
        return prox;
      }
      
      const origGetContext2 = HTMLCanvasElement.prototype.getContext;
      function wrapped(type,...rest){ 
        const ctx = origGetContext2.apply(this,[type,...rest]); 
        if(!ctx) return ctx; 
        if (/webgl2?/i.test(type)) return patchContext(ctx); 
        return ctx; 
      }
      cloneFunctionSignature(origGetContext2, wrapped);
      try { HTMLCanvasElement.prototype.getContext = wrapped; }catch(_){ }
    }

    // --- Fonts coherent (no blocking) ---
    if (applyProtection && !settings.blockFonts){
      // Provide a subset via document.fonts.check proxy (avoid blocking enumeration entirely)
      if (document && document.fonts){
        const realFonts = document.fonts;
        const personaFonts = () => (persona && persona.fonts) ? persona.fonts : [];
        const fontsProxy = new Proxy(realFonts, {
          get(t, prop){
            if (prop==='check'){
              const orig = t.check.bind(t);
              return cloneFunctionSignature(orig, function(spec){ try { const famMatch = /\b([^,]+)$/.exec(spec); if (famMatch){ const fam = famMatch[1].trim().replace(/['"]/g,''); if (personaFonts().includes(fam)) return true; } }catch(_){ } return orig(spec); });
            }
            return Reflect.get(t, prop);
          }
        });
        try { Object.defineProperty(document,'fonts',{ get: cloneFunctionSignature(function(){}, function(){ return fontsProxy; }), configurable:true }); }catch(_){ }
      }
    }

    // --- Enhanced fingerprinting detection (stealthy) ---
    if (applyProtection && settings.detectFingerprinting){
      let fpCount = 0;
      const detectionThrottle = new Map(); // Throttle detection reports
      
      function report(method, property, extra){ 
        const key = method + ':' + property;
        const now = Date.now();
        const lastReport = detectionThrottle.get(key) || 0;
        
        // Throttle reports to avoid creating detectable patterns
        if (now - lastReport < 1000) return; // 1 second throttle
        detectionThrottle.set(key, now);
        
        try { 
          window.postMessage({ 
            type:'PRIVACY_SHIELD_DETECTION', 
            method, 
            property, 
            value:extra, 
            count: ++fpCount 
          }, '*'); 
        }catch(_){ } 
      }
      
      // More subtle access pattern monitoring
      const nav = navigator; 
      let navAccess = 0; 
      const sensitiveProps = ['hardwareConcurrency','platform','languages','language','userAgent'];
      
      // Create minimal monitoring that's harder to detect
      sensitiveProps.forEach(k => { 
        try { 
          const privateKey = '__ps_' + k + '_' + Math.random().toString(36).substr(2, 5);
          Object.defineProperty(Navigator.prototype, privateKey, { 
            get: function(){ return nav[k]; }, 
            configurable: true 
          }); 
        }catch(_){ } 
      });
      
      // Less aggressive tracking to avoid detection
      const navProxy = window.navigator;
      const trackProps = ['userAgent','platform','hardwareConcurrency'];
      trackProps.forEach(prop=>{
        try {
          const origDesc = Object.getOwnPropertyDescriptor(Navigator.prototype, prop);
          if (origDesc && origDesc.get){
            const originalGetter = origDesc.get;
            function wrapped(){ 
              navAccess++; 
              // Only report after significant access to avoid false positives
              if (navAccess > 10 && navAccess % 5 === 0) {
                report('navigator_fingerprint', prop); 
              }
              return originalGetter.call(this); 
            }
            cloneFunctionSignature(originalGetter, wrapped);
            Object.defineProperty(Navigator.prototype, prop, { 
              get: wrapped, 
              configurable: true 
            });
          }
        }catch(_){ }
      });
    }

    window.addEventListener('message', function(ev){ if (ev.source!==window) return; if (ev.data && ev.data.type==='PRIVACY_SHIELD_DETECTION'){ const map={ canvas_fingerprint:{category:'canvas',severity:'low'}, webgl_fingerprint:{category:'webgl',severity:'medium'}, navigator_fingerprint:{category:'navigator',severity:'medium'} }; const m=map[ev.data.method]||{category:'generic',severity:'low'}; try { chrome.runtime.sendMessage({ type:'FINGERPRINTING_DETECTED', category:m.category, method:ev.data.method, severity:m.severity, property:ev.data.property, value:ev.data.value, count:ev.data.count, url:location.href }).catch(()=>{}); }catch(_){ } } });
  }

  // Acquire settings then inject
  try {
    chrome.storage.sync.get(DEFAULTS, (settings)=>{
      if (!settings || settings.enabled===false) return;
      function sanitize(arr){ if(!Array.isArray(arr)) return []; const out=[]; for(const raw of arr){ if(typeof raw!=='string') continue; let s=raw.trim().toLowerCase(); if(!s) continue; try { if (s.includes('://')){ const u=new URL(s); s=u.hostname.toLowerCase(); } }catch(_){ } s=s.replace(/^
.+/, ''); if (s.startsWith('*.')) s='*.'+s.slice(2).replace(/^
.+/,''); if (/
|
/.test(s)) continue; if (s.length>255) continue; if (s.startsWith('*.')){ const base=s.slice(2); if(!base || base.includes('*')) continue; out.push('*.'+base);} else { if (s.includes('*')) continue; out.push(s);} } return Array.from(new Set(out)); }
      const safeWL = sanitize([...(settings.whitelistPatterns||[]), ...BUILTIN_TRUSTED]);
      const safeBL = sanitize(settings.blacklistPatterns||[]);
      injectScript(pageMain, settings, safeWL, safeBL);
    });

    // Persona API passthrough
    function requestPersonaForDomain(osPreference){ return new Promise((res,rej)=>{ try { chrome.runtime.sendMessage({ type:'GET_PERSONA', osPreference }).then(r=>{ if(r && r.success) res(r.persona); else rej(new Error(r?.error||'persona failed')); }).catch(rej); }catch(e){ rej(e);} }); }
    if (!window.__PRIVACY_SHIELD_PERSONA_API__){ window.__PRIVACY_SHIELD_PERSONA_API__ = { requestPersona: requestPersonaForDomain, version:'3.0-stealth' }; }
  }catch(e){}
})();