// NOTE: Keep previous behavior commented with `// OLD:` when replaced.
// Service Worker para manejar la lógica de fondo
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
      detectFingerprinting: true
    };
    chrome.storage.sync.set(Object.assign({}, defaults, current || {}));
  });
});

// Tracking fingerprinting attempts per tab
const tabDetections = new Map();

function updateIcon(tabId) {
  chrome.storage.sync.get(['enabled'], (result) => {
    const enabled = result && result.enabled !== false;
    const detectionCount = tabDetections.get(tabId) || 0;
    
    chrome.action.setIcon({
      tabId,
      path: enabled ? {
        "16": "icons/icon16.png",
        "48": "icons/icon48.png",
        "128": "icons/icon128.png"
      } : {
        "16": "icons/icon16-disabled.png",
        "48": "icons/icon48-disabled.png",
        "128": "icons/icon128-disabled.png"
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
  
  // Handle fingerprinting detection alerts
  if (request.action === 'fingerprintingDetected' && sender.tab) {
    const tabId = sender.tab.id;
    const currentCount = tabDetections.get(tabId) || 0;
    tabDetections.set(tabId, currentCount + 1);
    
    // Update badge immediately
    updateIcon(tabId);
    
    // Log detection for debugging
    console.log('Fingerprinting detected:', {
      tabId,
      method: request.method,
      count: tabDetections.get(tabId),
      url: request.url,
      property: request.property
    });
    
    sendResponse({ success: true });
    return true;
  }
});