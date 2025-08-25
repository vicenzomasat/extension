function getCurrentHost(cb) {
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    const tab = tabs && tabs[0];
    let host = '';
    if (tab && tab.url) {
      try { host = new URL(tab.url).hostname.toLowerCase(); } catch(_) {}
    }
    cb(host);
  });
}

function updateStatus() {
  const enabled = document.getElementById('enabled').checked;
  const statusElement = document.getElementById('status');
  statusElement.innerHTML = enabled
    ? '<span class="protected">✅ Protegido</span>'
    : '<span class="disabled">❌ Desactivado</span>';
}

function hostMatchesPattern(host, pat) {
  if (pat.startsWith('*.')) {
    const base = pat.slice(2);
    return host === base || host.endsWith('.' + base);
  }
  return host === pat;
}

function computeListStatus(host, wl, bl) {
  const inW = wl.some(p => hostMatchesPattern(host, p));
  const inB = bl.some(p => hostMatchesPattern(host, p));
  if (inB && inW) return 'En ambas (prioriza Negra)';
  if (inB) return 'Lista Negra';
  if (inW) return 'Lista Blanca';
  return 'Ninguna';
}

function refreshListStatus() {
  getCurrentHost(function(host) {
    if (!host) {
      document.getElementById('currentHost').textContent = '(no disponible)';
      document.getElementById('listStatus').textContent = '-';
      return;
    }
    document.getElementById('currentHost').textContent = host;
    chrome.storage.sync.get(['whitelistPatterns', 'blacklistPatterns'], function(res) {
      const wl = Array.isArray(res.whitelistPatterns) ? res.whitelistPatterns : [];
      const bl = Array.isArray(res.blacklistPatterns) ? res.blacklistPatterns : [];
      document.getElementById('listStatus').textContent = computeListStatus(host, wl, bl);
    });
  });
}

// Inicializa toggles y estado
document.addEventListener('DOMContentLoaded', function() {
  chrome.storage.sync.get([
    'enabled', 'spoofUserAgent', 'spoofTimezone', 'spoofWebGL', 'spoofCanvas',
    // NEW:
    'spoofScreen', 'spoofHardware',
    'whitelistPatterns', 'blacklistPatterns'
  ], function(result) {
    document.getElementById('enabled').checked = result.enabled !== false;
    document.getElementById('spoofUserAgent').checked = result.spoofUserAgent === true;
    document.getElementById('spoofTimezone').checked = result.spoofTimezone === true;
    document.getElementById('spoofWebGL').checked = result.spoofWebGL !== false;
    document.getElementById('spoofCanvas').checked = result.spoofCanvas !== false;
    // NEW defaults
    document.getElementById('spoofScreen').checked = result.spoofScreen === true;
    document.getElementById('spoofHardware').checked = result.spoofHardware === true;

    refreshListStatus();
    updateStatus();
  });

  const toggles = [
    'enabled', 'spoofUserAgent', 'spoofTimezone', 'spoofWebGL', 'spoofCanvas',
    // NEW toggles wired
    'spoofScreen', 'spoofHardware'
  ];
  toggles.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', function() {
      const settings = {};
      toggles.forEach(t => {
        const node = document.getElementById(t);
        if (node) settings[t] = node.checked;
      });
      chrome.runtime.sendMessage({ action: 'updateSettings', settings }, function(resp) {
        if (resp && resp.success) {
          updateStatus();
          chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs && tabs[0]) chrome.tabs.reload(tabs[0].id);
          });
        }
      });
    });
  });

  document.getElementById('addWhitelist').addEventListener('click', function() {
    getCurrentHost(function(host) {
      if (!host) return;
      chrome.storage.sync.get(['whitelistPatterns'], function(res) {
        const wl = Array.isArray(res.whitelistPatterns) ? res.whitelistPatterns : [];
        if (!wl.some(p => hostMatchesPattern(host, p) || p === host)) wl.push(host);
        chrome.runtime.sendMessage({ action: 'updateSettings', settings: { whitelistPatterns: Array.from(new Set(wl)) } }, function() {
          refreshListStatus();
          chrome.tabs.query({active: true, currentWindow: true}, function(tabs) { if (tabs && tabs[0]) chrome.tabs.reload(tabs[0].id); });
        });
      });
    });
  });

  document.getElementById('addBlacklist').addEventListener('click', function() {
    getCurrentHost(function(host) {
      if (!host) return;
      chrome.storage.sync.get(['blacklistPatterns'], function(res) {
        const bl = Array.isArray(res.blacklistPatterns) ? res.blacklistPatterns : [];
        if (!bl.some(p => hostMatchesPattern(host, p) || p === host)) bl.push(host);
        chrome.runtime.sendMessage({ action: 'updateSettings', settings: { blacklistPatterns: Array.from(new Set(bl)) } }, function() {
          refreshListStatus();
          chrome.tabs.query({active: true, currentWindow: true}, function(tabs) { if (tabs && tabs[0]) chrome.tabs.reload(tabs[0].id); });
        });
      });
    });
  });

  document.getElementById('removeFromLists').addEventListener('click', function() {
    getCurrentHost(function(host) {
      if (!host) return;
      chrome.storage.sync.get(['whitelistPatterns', 'blacklistPatterns'], function(res) {
        const wl = (res.whitelistPatterns || []).filter(p => !hostMatchesPattern(host, p) && p !== host);
        const bl = (res.blacklistPatterns || []).filter(p => !hostMatchesPattern(host, p) && p !== host);
        chrome.runtime.sendMessage({ action: 'updateSettings', settings: { whitelistPatterns: wl, blacklistPatterns: bl } }, function() {
          refreshListStatus();
          chrome.tabs.query({active: true, currentWindow: true}, function(tabs) { if (tabs && tabs[0]) chrome.tabs.reload(tabs[0].id); });
        });
      });
    });
  });

  document.getElementById('openOptions').addEventListener('click', function(e) {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
});