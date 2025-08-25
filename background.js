// NOTE: Keep previous behavior commented with `// OLD:` when replaced.
// Service Worker para manejar la lógica de fondo

// Import persona generator and fingerprint detector for Phase 2
import { getOrCreatePersonaForDomain, getPersonaStats } from './core/persona-generator.js';
import { fingerprintDetector, FingerprintCategories, DetectionSeverity } from './core/fingerprint-detector.js';

chrome.runtime.onInstalled.addListener(() => {
  console.log('Privacy Shield extension installed');

  // Configuración inicial (conservadora + listas vacías por defecto)
  // OLD: chrome.storage.sync.set({ enabled: true, spoofUserAgent: false, spoofTimezone: false, spoofWebGL: true, spoofCanvas: true, preserveAuth: true })
  chrome.storage.sync.get(null, (current) => {
    const defaults = {
      enabled: true,
      spoofUserAgent: false,
      spoofTimezone: false,
      spoofWebGL: true,
      spoofCanvas: true,
      preserveAuth: true,
      whitelistPatterns: [],
      blacklistPatterns: [],
      // NEW defaults (avanzados)
      spoofScreen: false,
      spoofHardware: false,
      // AGGRESSIVE defaults
      blockBattery: true,
      blockGamepad: true,
      blockWebRTC: true,
      blockFonts: true,
      detectFingerprinting: true,
      // New enhanced protections defaults
      timingProtection: true,
      cssFingerprint: true,
      fontEnumeration: true,
      audioFingerprint: true,
      batteryAPI: true,
      webrtcMode: 'block'
    };
    chrome.storage.sync.set(Object.assign({}, defaults, current || {}));
  });

  // Setup DNR rules for HTTP header normalization
  setupHeaderNormalizationRules();

  // Setup WebRTC network policy for enhanced blocking
  setupWebRTCNetworkPolicy();
});

// Setup dynamic DNR rules for header normalization (main_frame/sub_frame only)
async function setupHeaderNormalizationRules() {
  try {
    // Remove any existing rules first
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const rulesToRemove = existingRules.filter(rule => 
      rule.id >= 91001 && rule.id <= 91003
    ).map(rule => rule.id);
    
    if (rulesToRemove.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: rulesToRemove });
    }

    // Add new header normalization rules
    const headerRules = [
      {
        id: 91001,
        priority: 1,
        action: {
          type: 'modifyHeaders',
          requestHeaders: [
            {
              header: 'Accept-Language',
              operation: 'set',
              value: 'es-AR,es;q=0.9'
            }
          ]
        },
        condition: {
          resourceTypes: ['main_frame', 'sub_frame']
        }
      },
      {
        id: 91002,
        priority: 1,
        action: {
          type: 'modifyHeaders',
          requestHeaders: [
            {
              header: 'Accept',
              operation: 'set',
              value: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7'
            }
          ]
        },
        condition: {
          resourceTypes: ['main_frame', 'sub_frame']
        }
      },
      {
        id: 91003,
        priority: 1,
        action: {
          type: 'modifyHeaders',
          requestHeaders: [
            {
              header: 'Accept-Encoding',
              operation: 'set',
              value: 'gzip, deflate, br, zstd'
            }
          ]
        },
        condition: {
          resourceTypes: ['main_frame', 'sub_frame']
        }
      }
    ];

    await chrome.declarativeNetRequest.updateDynamicRules({ addRules: headerRules });
    console.log('Header normalization rules installed');
  } catch (error) {
    console.error('Failed to setup header normalization rules:', error);
  }
}

// Setup WebRTC network policy for enhanced blocking
async function setupWebRTCNetworkPolicy() {
  try {
    // Note: This requires "privacy" permission in manifest
    if (chrome.privacy && chrome.privacy.network && chrome.privacy.network.webRTCIPHandlingPolicy) {
      await chrome.privacy.network.webRTCIPHandlingPolicy.set({ value: 'disable_non_proxied_udp' });
      console.log('WebRTC network policy applied: disable_non_proxied_udp');
    } else {
      console.log('WebRTC network policy not available (requires privacy permission)');
    }
  } catch (error) {
    console.error('Failed to setup WebRTC network policy:', error);
  }
}

// Tracking fingerprinting attempts per tab
const tabDetections = new Map();

function updateIcon(tabId) {
  chrome.storage.sync.get(['enabled'], (result) => {
    const enabled = result && result.enabled !== false;
    const detectionCount = tabDetections.get(tabId) || 0;
    
    chrome.action.setIcon({
      tabId,
      path: enabled ? {
        "16": "icons/logo/16g.png",
        "32": "icons/logo/32g.png",
        "48": "icons/logo/48g.png",
        "128": "icons/logo/128g.png"
      } : {
        "16": "icons/logo/16g.png",
        "32": "icons/logo/32g.png",
        "48": "icons/logo/48g.png",
        "128": "icons/logo/128g.png"
      }
    });

    // Update badge with detection count
    if (enabled && detectionCount > 0) {
      chrome.action.setBadgeText({
        tabId,
        text: detectionCount > 99 ? '99+' : detectionCount.toString()
      });
      chrome.action.setBadgeBackgroundColor({
        tabId,
        color: detectionCount > 10 ? '#d32f2f' : '#ff9800' // Red for high activity, orange for moderate
      });
    } else {
      chrome.action.setBadgeText({ tabId, text: '' });
    }
  });
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete') {
    updateIcon(tabId);
  } else if (changeInfo.status === 'loading') {
    // Reset detection count when navigating to new page
    tabDetections.delete(tabId);
    updateIcon(tabId);
  }
});
chrome.tabs.onActivated.addListener(({ tabId }) => updateIcon(tabId));

// Clean up detection data for closed tabs
chrome.tabs.onRemoved.addListener((tabId) => {
  tabDetections.delete(tabId);
});

// Mensajes desde popup/options
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateSettings') {
    chrome.storage.sync.set(request.settings, () => sendResponse({ success: true }));
    return true;
  }
  
  // NEW: Handle GET_PERSONA requests for Phase 2
  if (request.type === 'GET_PERSONA' && sender.tab) {
    (async () => {
      try {
        const url = new URL(sender.tab.url);
        const domain = url.hostname;
        const persona = await getOrCreatePersonaForDomain(domain, request.osPreference);
        sendResponse({ success: true, persona });
      } catch (error) {
        console.error('Error getting persona for domain:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // Keep message channel open for async response
  }

  // NEW: Handle PERSONA_STATS requests (for debugging)
  if (request.type === 'PERSONA_STATS') {
    (async () => {
      try {
        const stats = await getPersonaStats();
        sendResponse({ success: true, stats });
      } catch (error) {
        console.error('Error getting persona stats:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }
  
  // NEW: Handle FINGERPRINT_STATS requests (for debugging)
  if (request.type === 'FINGERPRINT_STATS') {
    const stats = fingerprintDetector.getStats();
    sendResponse({ success: true, stats });
    return true;
  }
  
  // NEW: Handle ps:updateHeaders requests for runtime header adjustments
  if (request.type === 'ps:updateHeaders') {
    (async () => {
      try {
        await setupHeaderNormalizationRules();
        sendResponse({ success: true });
      } catch (error) {
        console.error('Error updating headers:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }
  
  // Handle fingerprinting detection alerts - support both legacy and new message types
  // OLD: request.action === 'fingerprintingDetected'
  if ((request.action === 'fingerprintingDetected' || request.type === 'FINGERPRINTING_DETECTED') && sender.tab) {
    const tabId = sender.tab.id;
    const currentCount = tabDetections.get(tabId) || 0;
    tabDetections.set(tabId, currentCount + 1);
    
    // NEW: Also report to core fingerprint detector for categorization
    if (request.type === 'FINGERPRINTING_DETECTED' && request.category && request.method) {
      fingerprintDetector.reportDetection({
        category: request.category,
        method: request.method,
        severity: request.severity || DetectionSeverity.MEDIUM,
        property: request.property,
        value: request.value
      });
    }
    
    // Update badge immediately
    updateIcon(tabId);
    
    // Log detection for debugging
    console.log('Fingerprinting detected:', {
      tabId,
      method: request.method,
      count: tabDetections.get(tabId),
      url: request.url,
      property: request.property,
      // NEW: log message type and category for debugging
      messageType: request.type || request.action,
      category: request.category,
      severity: request.severity
    });
    
    sendResponse({ success: true });
    return true;
  }
});