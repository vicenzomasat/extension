     /**
 * Privacy Shield - Content Script v2
 * Enhanced with session tokens and persona consistency
 */

(function() {
  'use strict';

  // Prevent multiple initializations
  if (window.__PS_CS_INITIALIZED__) return;
  window.__PS_CS_INITIALIZED__ = true;

  /**
   * Configuration defaults
   */
  const DEFAULTS = {
    enabled: true,
    spoofUserAgent: false,
    spoofTimezone: false,
    spoofWebGL: true,
    spoofCanvas: true,
    spoofAudio: true,
    preserveAuth: true,
    whitelistPatterns: [],
    blacklistPatterns: [],
    spoofScreen: false,
    spoofHardware: false,
    blockBattery: true,
    blockGamepad: true,
    blockWebRTC: true,
    blockFonts: false,
    detectFingerprinting: true,
    protectIframes: 'same-origin'
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

  /**
   * Secure Message Bridge with session tokens
   */
  class SecureMessageBridge {
    constructor(sessionToken) {
      this.sessionToken = sessionToken;
      this.pending = new Map();
      this.handlers = new Map();
      this.setupListeners();
    }

    setupListeners() {
      window.addEventListener('message', (e) => {
        // Security checks
        if (e.source !== window) return;
        
        // Handle file:// protocol
        const isFileProtocol = location.protocol === 'file:';
        if (!isFileProtocol && e.origin !== window.location.origin) return;
        if (isFileProtocol && e.origin !== 'null') return;
        
        const data = e.data;
        if (!data || typeof data !== 'object') return;
        if (!data.type?.startsWith('PS_')) return;
        
        // Verify session token
        if (data.__psToken !== this.sessionToken) return;

        switch(data.type) {
          case 'PS_RESPONSE':
            this.handleResponse(data);
            break;
          case 'PS_EVENT':
            this.handleEvent(data);
            break;
          case 'PS_ACK':
            this.handleAck(data);
            break;
          case 'PS_REQUEST':
            this.handleRequest(data);
            break;
        }
      });
    }

    handleResponse(data) {
      const promise = this.pending.get(data.id);
      if (promise) {
        promise.resolve(data.payload);
        this.pending.delete(data.id);
      }
    }

    handleEvent(data) {
      const handler = this.handlers.get(data.event);
      if (handler) {
        handler(data.payload);
      }

      // Forward fingerprinting events to background
      if (data.event === 'fingerprinting_detected') {
        chrome.runtime.sendMessage({
          type: 'FINGERPRINTING_DETECTED',
          ...data.payload
        }).catch(() => {
          // Extension context invalidated
        });
      }
    }

    handleAck(data) {
      const handler = this.handlers.get('ack_' + data.id);
      if (handler) {
        handler(true);
        this.handlers.delete('ack_' + data.id);
      }
    }

    async handleRequest(data) {
      // Handle requests from injected script
      switch(data.request) {
        case 'GET_PERSONA':
          try {
            const response = await chrome.runtime.sendMessage({
              type: 'GET_PERSONA',
              osPreference: data.payload?.osPreference
            });
            
            this.sendToPage('PS_RESPONSE', {
              id: data.id,
              payload: response
            });
          } catch(e) {
            this.sendToPage('PS_RESPONSE', {
              id: data.id,
              payload: { error: e.message }
            });
          }
          break;
          
        case 'LOG':
          // Forward logs from main world to console
          console.log('[PS Main World]', ...data.payload);
          break;
      }
    }

    sendToPage(type, data) {
      const targetOrigin = location.protocol === 'file:' ? '*' : window.location.origin;
      window.postMessage({
        ...data,
        type,
        __psToken: this.sessionToken
      }, targetOrigin);
    }

    async request(type, payload, timeout = 5000) {
      const id = crypto.randomUUID();
      
      return new Promise((resolve, reject) => {
        this.pending.set(id, { resolve, reject });
        
        this.sendToPage('PS_REQUEST', {
          id,
          request: type,
          payload
        });
        
        setTimeout(() => {
          if (this.pending.has(id)) {
            this.pending.delete(id);
            reject(new Error('Request timeout'));
          }
        }, timeout);
      });
    }

    on(event, handler) {
      this.handlers.set(event, handler);
    }

    waitForAck(id, timeout = 300) {
      return new Promise((resolve) => {
        this.handlers.set('ack_' + id, resolve);
        setTimeout(() => {
          if (this.handlers.has('ack_' + id)) {
            this.handlers.delete('ack_' + id);
            resolve(false);
          }
        }, timeout);
      });
    }
  }

  /**
   * Enhanced Injection Manager with Blob URL fallback
   */
  class EnhancedInjectionManager {
    constructor(bridge, sessionToken) {
      this.bridge = bridge;
      this.sessionToken = sessionToken;
      this.injected = false;
    }

    async inject(settings, whitelist, blacklist, persona) {
      if (this.injected) return true;

      const msgId = crypto.randomUUID();
      
      // Include session token and persona in settings
      const enhancedSettings = {
        ...settings,
        __sessionToken: this.sessionToken,
        __persona: persona
      };
      
      // Try MV3 method first (most reliable)
      const mv3Success = await this.tryMV3Injection(enhancedSettings, whitelist, blacklist, msgId);
      if (mv3Success) {
        this.injected = true;
        return true;
      }

      // Fallback to Blob URL injection
      const blobSuccess = await this.tryBlobInjection(enhancedSettings, whitelist, blacklist, msgId);
      if (blobSuccess) {
        this.injected = true;
        return true;
      }

      // Last resort: inline script injection
      const inlineSuccess = await this.tryInlineInjection(enhancedSettings, whitelist, blacklist, msgId);
      if (inlineSuccess) {
        this.injected = true;
        return true;
      }

      console.warn('[Privacy Shield] All injection methods failed');
      return false;
    }

    async tryMV3Injection(settings, whitelist, blacklist, msgId) {
      try {
        // Request background script to inject
        const response = await chrome.runtime.sendMessage({
          type: 'INJECT_MAIN_WORLD',
          args: [settings, whitelist, blacklist, msgId]
        });

        if (response?.success) {
          // Wait for ACK from injected script
          const acked = await this.bridge.waitForAck(msgId, 500);
          return acked;
        }
      } catch(e) {
        console.debug('[Privacy Shield] MV3 injection failed:', e);
      }
      return false;
    }

    async tryBlobInjection(settings, whitelist, blacklist, msgId) {
      try {
        // Read the inject.js file
        const injectUrl = chrome.runtime.getURL('inject.js');
        const response = await fetch(injectUrl);
        const injectCode = await response.text();
        
        // Prepare the initialization code
        const initCode = `
          (function() {
            const settings = ${JSON.stringify(settings)};
            const whitelist = ${JSON.stringify(whitelist)};
            const blacklist = ${JSON.stringify(blacklist)};
            const msgId = ${JSON.stringify(msgId)};
            
            // Initialize the protection
            if (typeof initializeProtection === 'function') {
              initializeProtection(settings, whitelist, blacklist, msgId);
            }
          })();
        `;

        // Create blob URL
        const blob = new Blob([injectCode, '\n', initCode], { type: 'text/javascript' });
        const blobUrl = URL.createObjectURL(blob);
        
        // Create and inject script
        const script = document.createElement('script');
        script.src = blobUrl;
        
        // Clean up and wait for result
        const done = new Promise((resolve) => {
          script.onload = script.onerror = () => {
            URL.revokeObjectURL(blobUrl);
            script.remove();
            resolve();
          };
        });
        
        (document.head || document.documentElement).appendChild(script);
        await done;

        // Wait for ACK
        const acked = await this.bridge.waitForAck(msgId, 500);
        return acked;
      } catch(e) {
        console.debug('[Privacy Shield] Blob injection failed:', e);
      }
      return false;
    }

    async tryInlineInjection(settings, whitelist, blacklist, msgId) {
      try {
        // Read the inject.js file
        const injectUrl = chrome.runtime.getURL('inject.js');
        const response = await fetch(injectUrl);
        const injectCode = await response.text();
        
        // Prepare the initialization code
        const initCode = `
          (function() {
            const settings = ${JSON.stringify(settings)};
            const whitelist = ${JSON.stringify(whitelist)};
            const blacklist = ${JSON.stringify(blacklist)};
            const msgId = ${JSON.stringify(msgId)};
            
            // Initialize the protection
            if (typeof initializeProtection === 'function') {
              initializeProtection(settings, whitelist, blacklist, msgId);
            }
          })();
        `;

        // Create and inject inline script
        const script = document.createElement('script');
        script.textContent = injectCode + '\n' + initCode;
        
        (document.head || document.documentElement).appendChild(script);
        script.remove();

        // Wait for ACK
        const acked = await this.bridge.waitForAck(msgId, 300);
        return acked;
      } catch(e) {
        console.debug('[Privacy Shield] Inline injection failed:', e);
      }
      return false;
    }
  }

  /**
   * Pattern matching utilities
   */
  function normalizeHostPattern(raw) {
    if (typeof raw !== 'string') return null;
    
    let s = raw.trim().toLowerCase();
    
    // Extract hostname from URL if needed
    try {
      if (s.includes('://')) {
        s = new URL(s).hostname.toLowerCase();
      }
    } catch {}
    
    // Remove any remaining URL parts
    s = s.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    s = s.replace(/\s/g, '');
    
    if (!s) return null;
    
    // Handle wildcards
    if (s.startsWith('*.')) {
      // Already has wildcard
    } else if (s.startsWith('.')) {
      // Convert .example.com to *.example.com
      s = '*' + s;
    }
    
    // Validate
    if (s.length > 255) return null;
    if (s.slice(2).includes('*')) return null; // Only *.domain allowed
    
    return s;
  }

  function patternMatch(hostname, pattern) {
    if (!hostname || !pattern) return false;
    
    if (pattern.startsWith('*.')) {
      const base = pattern.slice(2);
      return hostname === base || hostname.endsWith('.' + base);
    }
    
    return hostname === pattern;
  }

  function shouldProtect(hostname, whitelist, blacklist, preserveAuth) {
    const inBlacklist = blacklist.some(p => patternMatch(hostname, p));
    const inWhitelist = whitelist.some(p => patternMatch(hostname, p));
    
    // Blacklist always wins
    if (inBlacklist) return true;
    
    // If preserveAuth is enabled and site is whitelisted, don't protect
    if (preserveAuth && inWhitelist) return false;
    
    // Otherwise protect
    return true;
  }

  /**
   * Initialize the content script
   */
  async function initialize() {
    // Check iframe policy
    const isIframe = window !== window.top;
    if (isIframe) {
      const settings = await chrome.storage.sync.get(['protectIframes']);
      const policy = settings.protectIframes || 'same-origin';
      
      if (policy === 'top-only') {
        console.debug('[Privacy Shield] Skipping iframe (top-only policy)');
        return;
      }
      
      if (policy === 'same-origin') {
        try {
          // This will throw if cross-origin
          const topHostname = window.top.location.hostname;
          if (topHostname !== window.location.hostname) {
            console.debug('[Privacy Shield] Skipping cross-origin iframe');
            return;
          }
        } catch {
          console.debug('[Privacy Shield] Skipping cross-origin iframe');
          return;
        }
      }
    }

    // Get settings
    const settings = await chrome.storage.sync.get(DEFAULTS);
    
    if (!settings.enabled) {
      console.log('[Privacy Shield] Extension disabled');
      return;
    }

    // Normalize patterns
    const whitelist = [...(settings.whitelistPatterns || []), ...BUILTIN_TRUSTED]
      .map(normalizeHostPattern)
      .filter(Boolean);
    
    // Remove duplicates
    const uniqueWhitelist = Array.from(new Set(whitelist));
    
    const blacklist = (settings.blacklistPatterns || [])
      .map(normalizeHostPattern)
      .filter(Boolean);
    
    const uniqueBlacklist = Array.from(new Set(blacklist));

    // Check if we should protect this site
    const hostname = window.location.hostname.toLowerCase();
    const protect = shouldProtect(hostname, uniqueWhitelist, uniqueBlacklist, settings.preserveAuth);
    
    if (!protect) {
      console.log('[Privacy Shield] Site whitelisted, protection disabled');
      return;
    }

    // Generate session token for secure communication
    const sessionToken = crypto.randomUUID();
    
    // Initialize secure bridge
    const bridge = new SecureMessageBridge(sessionToken);
    const injector = new EnhancedInjectionManager(bridge, sessionToken);

    // Get persona from background for consistency
    let persona = null;
    try {
      persona = await chrome.runtime.sendMessage({
        type: 'GET_PERSONA',
        osPreference: settings.osPreference
      });
    } catch(e) {
      console.warn('[Privacy Shield] Failed to get persona:', e);
    }

    // Set up event handlers
    bridge.on('fingerprinting_detected', (data) => {
      console.log('[Privacy Shield] Fingerprinting detected:', data);
    });

    // Inject protection with persona
    const injected = await injector.inject(settings, uniqueWhitelist, uniqueBlacklist, persona);
    
    if (injected) {
      console.log('[Privacy Shield] Protection active');
    } else {
      console.warn('[Privacy Shield] Failed to inject protection');
    }
  }

  // Start initialization
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})();
