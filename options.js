/**
 * Privacy Shield - Options Page Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Load settings on startup
  await loadAllSettings();
  
  // Setup tab switching
  setupTabs();
  
  // Setup event listeners
  setupEventListeners();
  
  // Load statistics
  await loadStatistics();
  
  // Load activity log
  await loadActivityLog();
});

/**
 * Tab Management
 */
function setupTabs() {
  const tabs = document.querySelectorAll('.tab');
  const contents = document.querySelectorAll('.tab-content');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Remove active class from all
      tabs.forEach(t => t.classList.remove('active'));
      contents.forEach(c => c.classList.remove('active'));
      
      // Add active to clicked tab
      tab.classList.add('active');
      const contentId = tab.dataset.tab;
      document.getElementById(contentId).classList.add('active');
    });
  });
}

/**
 * Load all settings from storage
 */
async function loadAllSettings() {
  const settings = await chrome.storage.sync.get(null);
  
  // Protection settings
  document.getElementById('opt-canvas').checked = settings.spoofCanvas !== false;
  document.getElementById('opt-webgl').checked = settings.spoofWebGL !== false;
  document.getElementById('opt-audio').checked = settings.spoofAudio !== false;
  document.getElementById('opt-webrtc').checked = settings.blockWebRTC !== false;
  document.getElementById('opt-hardware').checked = settings.spoofHardware === true;
  document.getElementById('opt-fonts').checked = settings.blockFonts === true;
  
  // Advanced settings
  document.getElementById('opt-detection').checked = settings.detectFingerprinting !== false;
  document.getElementById('opt-notifications').checked = settings.notifyFingerprinting === true;
  document.getElementById('opt-preserve-auth').checked = settings.preserveAuth !== false;
  document.getElementById('iframe-policy').value = settings.protectIframes || 'same-origin';
  
  // Whitelist/Blacklist
  const whitelistTextarea = document.getElementById('whitelist-patterns');
  const blacklistTextarea = document.getElementById('blacklist-patterns');
  
  if (settings.whitelistPatterns) {
    whitelistTextarea.value = settings.whitelistPatterns.join('\n');
  }
  
  if (settings.blacklistPatterns) {
    blacklistTextarea.value = settings.blacklistPatterns.join('\n');
  }
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
  // Protection toggles
  const protectionToggles = [
    { id: 'opt-canvas', setting: 'spoofCanvas' },
    { id: 'opt-webgl', setting: 'spoofWebGL' },
    { id: 'opt-audio', setting: 'spoofAudio' },
    { id: 'opt-webrtc', setting: 'blockWebRTC' },
    { id: 'opt-hardware', setting: 'spoofHardware' },
    { id: 'opt-fonts', setting: 'blockFonts' }
  ];
  
  protectionToggles.forEach(toggle => {
    document.getElementById(toggle.id).addEventListener('change', async (e) => {
      await chrome.storage.sync.set({ [toggle.setting]: e.target.checked });
      showNotification('Setting updated', 'success');
    });
  });
  
  // Advanced settings
  document.getElementById('opt-detection').addEventListener('change', async (e) => {
    await chrome.storage.sync.set({ detectFingerprinting: e.target.checked });
    showNotification('Detection setting updated', 'success');
  });
  
  document.getElementById('opt-notifications').addEventListener('change', async (e) => {
    await chrome.storage.sync.set({ notifyFingerprinting: e.target.checked });
    showNotification('Notification setting updated', 'success');
  });
  
  document.getElementById('opt-preserve-auth').addEventListener('change', async (e) => {
    await chrome.storage.sync.set({ preserveAuth: e.target.checked });
    showNotification('Auth preservation updated', 'success');
  });
  
  document.getElementById('iframe-policy').addEventListener('change', async (e) => {
    await chrome.storage.sync.set({ protectIframes: e.target.value });
    showNotification('iFrame policy updated', 'success');
  });
  
  // Save buttons
  document.getElementById('save-lists').addEventListener('click', saveWhitelistBlacklist);
  document.getElementById('save-advanced').addEventListener('click', saveAdvancedSettings);
  
  // Import/Export
  document.getElementById('export-lists').addEventListener('click', exportLists);
  document.getElementById('import-lists').addEventListener('click', importLists);
  document.getElementById('export-logs').addEventListener('click', exportLogs);
  
  // Clear/Reset
  document.getElementById('clear-logs').addEventListener('click', clearLogs);
  document.getElementById('reset-all').addEventListener('click', resetToDefaults);
}

/**
 * Save whitelist and blacklist
 */
async function saveWhitelistBlacklist() {
  const whitelistText = document.getElementById('whitelist-patterns').value;
  const blacklistText = document.getElementById('blacklist-patterns').value;
  
  const whitelistPatterns = whitelistText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
  
  const blacklistPatterns = blacklistText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
  
  await chrome.storage.sync.set({
    whitelistPatterns,
    blacklistPatterns
  });
  
  showNotification('Lists saved successfully', 'success');
}

/**
 * Save advanced settings
 */
async function saveAdvancedSettings() {
  const settings = {
    detectFingerprinting: document.getElementById('opt-detection').checked,
    notifyFingerprinting: document.getElementById('opt-notifications').checked,
    preserveAuth: document.getElementById('opt-preserve-auth').checked,
    protectIframes: document.getElementById('iframe-policy').value
  };
  
  await chrome.storage.sync.set(settings);
  showNotification('Advanced settings saved', 'success');
}

/**
 * Load statistics
 */
async function loadStatistics() {
  const { fingerprintingHistory = [] } = await chrome.storage.local.get(['fingerprintingHistory']);
  
  const total = fingerprintingHistory.length;
  const high = fingerprintingHistory.filter(e => e.severity === 'high').length;
  const uniqueSites = new Set(fingerprintingHistory.map(e => e.url)).size;
  
  // Calculate blocked attempts (estimate based on detections)
  const blocked = fingerprintingHistory.reduce((sum, e) => {
    const categories = e.categories || {};
    return sum + Object.keys(categories).length;
  }, 0);
  
  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-high').textContent = high;
  document.getElementById('stat-sites').textContent = uniqueSites;
  document.getElementById('stat-blocked').textContent = blocked;
}

/**
 * Load activity log
 */
async function loadActivityLog() {
  const { fingerprintingHistory = [] } = await chrome.storage.local.get(['fingerprintingHistory']);
  const logContainer = document.getElementById('activity-log');
  
  // Clear existing entries
  logContainer.innerHTML = '';
  
  // Sort by timestamp (newest first)
  const sorted = fingerprintingHistory.sort((a, b) => b.timestamp - a.timestamp);
  
  // Show last 20 entries
  sorted.slice(0, 20).forEach(entry => {
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    
    const time = new Date(entry.timestamp).toLocaleString();
    const categories = Object.keys(entry.categories || {}).join(', ');
    
    logEntry.innerHTML = `
      <span class="log-severity ${entry.severity}">${entry.severity}</span>
      <div class="log-details">
        <div class="log-site">${entry.url}</div>
        <div class="log-time">${time} | ${categories}</div>
      </div>
    `;
    
    logContainer.appendChild(logEntry);
  });
  
  if (sorted.length === 0) {
    logContainer.innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">No fingerprinting attempts detected yet</p>';
  }
}

/**
 * Export lists
 */
function exportLists() {
  chrome.storage.sync.get(['whitelistPatterns', 'blacklistPatterns'], (data) => {
    const exportData = {
      whitelist: data.whitelistPatterns || [],
      blacklist: data.blacklistPatterns || [],
      exported: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'privacy-shield-lists.json';
    a.click();
    
    URL.revokeObjectURL(url);
    showNotification('Lists exported', 'success');
  });
}

/**
 * Import lists
 */
function importLists() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (data.whitelist && data.blacklist) {
        await chrome.storage.sync.set({
          whitelistPatterns: data.whitelist,
          blacklistPatterns: data.blacklist
        });
        
        await loadAllSettings();
        showNotification('Lists imported successfully', 'success');
      } else {
        showNotification('Invalid import file', 'error');
      }
    } catch (err) {
      showNotification('Import failed: ' + err.message, 'error');
    }
  };
  
  input.click();
}

/**
 * Export logs
 */
function exportLogs() {
  chrome.storage.local.get(['fingerprintingHistory'], (data) => {
    const exportData = {
      logs: data.fingerprintingHistory || [],
      exported: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'privacy-shield-logs.json';
    a.click();
    
    URL.revokeObjectURL(url);
    showNotification('Logs exported', 'success');
  });
}

/**
 * Clear logs
 */
async function clearLogs() {
  if (confirm('Are you sure you want to clear all detection logs?')) {
    await chrome.storage.local.set({ fingerprintingHistory: [] });
    await loadStatistics();
    await loadActivityLog();
    showNotification('Logs cleared', 'success');
  }
}

/**
 * Reset to defaults
 */
async function resetToDefaults() {
  if (confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
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
      protectIframes: 'same-origin',
      notifyFingerprinting: false,
      // New enhanced protections
      timingProtection: true,
      cssFingerprint: true,
      fontEnumeration: true,
      audioFingerprint: true,
      batteryAPI: true,
      webrtcMode: 'block'
    };
    
    await chrome.storage.sync.set(DEFAULTS);
    await loadAllSettings();
    showNotification('Settings reset to defaults', 'success');
  }
}

/**
 * Show notification
 */
function showNotification(message, type = 'info') {
  // Create notification element
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 25px;
    background: ${type === 'success' ? 'linear-gradient(135deg, #FFD700, #B8860B)' : '#ff4444'};
    color: ${type === 'success' ? '#000' : '#fff'};
    border-radius: 8px;
    font-weight: 600;
    z-index: 10000;
    animation: slideIn 0.3s ease-out;
    box-shadow: 0 5px 20px rgba(0,0,0,0.3);
  `;
  notification.textContent = message;
  
  // Add animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(400px); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
  
  document.body.appendChild(notification);
  
  // Remove after 3 seconds
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-out';
    notification.style.animationFillMode = 'forwards';
    
    setTimeout(() => {
      notification.remove();
      style.remove();
    }, 300);
  }, 3000);
}
