// NOTE: Keep previous behavior commented with `// OLD:` when replaced.
// Service Worker para manejar la lógica de fondo
chrome.runtime.onInstalled.addListener(() => {
  console.log('Privacy Shield extension installed');

  // Configuración inicial (conservadora + listas vacías por defecto)
  // OLD: chrome.storage.sync.set({ enabled: true, ... })
  chrome.storage.sync.get(null, (current) => {
    const defaults = {
      enabled: true,
      spoofUserAgent: false,
      spoofTimezone: false,
      spoofWebGL: true,
      spoofCanvas: true,
      preserveAuth: true,
      whitelistPatterns: [],
      blacklistPatterns: []
    };
    chrome.storage.sync.set(Object.assign({}, defaults, current || {}));
  });
});

function updateIcon(tabId) {
  chrome.storage.sync.get(['enabled'], (result) => {
    const enabled = result && result.enabled !== false;
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
  });
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete') updateIcon(tabId);
});
chrome.tabs.onActivated.addListener(({ tabId }) => updateIcon(tabId));

// Mensajes desde popup/options
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateSettings') {
    chrome.storage.sync.set(request.settings, () => sendResponse({ success: true }));
    return true;
  }
});