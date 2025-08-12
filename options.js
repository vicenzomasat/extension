function sanitizePatternInput(s) {
  if (typeof s !== 'string') return '';
  s = s.trim().toLowerCase();
  if (!s) return '';
  try { if (s.includes('://')) s = new URL(s).hostname.toLowerCase(); } catch(_){ }
  s = s.replace(/^\.+/, '');
  if (s.startsWith('*.')) s = '*.' + s.slice(2).replace(/^\.+/, '');
  if (/\s|\//.test(s)) return '';
  if (s.length > 255) return '';
  if (s.startsWith('*.')) {
    const base = s.slice(2);
    if (!base || base.includes('*')) return '';
    return '*.' + base;
  }
  if (s.includes('*')) return '';
  return s;
}

function renderList(ul, items, kind) {
  ul.innerHTML = '';
  items.forEach((p, idx) => {
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.textContent = p;
    const btn = document.createElement('button');
    btn.textContent = 'Eliminar';
    btn.className = 'danger';
    btn.addEventListener('click', () => {
      chrome.storage.sync.get([kind], res => {
        const arr = (res[kind] || []).slice();
        arr.splice(idx, 1);
        chrome.storage.sync.set({ [kind]: arr }, () => load());
      });
    });
    li.appendChild(span); li.appendChild(btn);
    ul.appendChild(li);
  });
}

function load() {
  chrome.storage.sync.get(['whitelistPatterns', 'blacklistPatterns'], res => {
    const wl = Array.isArray(res.whitelistPatterns) ? res.whitelistPatterns : [];
    const bl = Array.isArray(res.blacklistPatterns) ? res.blacklistPatterns : [];
    renderList(document.getElementById('wlList'), wl, 'whitelistPatterns');
    renderList(document.getElementById('blList'), bl, 'blacklistPatterns');
  });
}

document.addEventListener('DOMContentLoaded', () => {
  load();
  document.getElementById('addWl').addEventListener('click', () => {
    const raw = document.getElementById('wlInput').value;
    const pat = sanitizePatternInput(raw);
    if (!pat) return;
    chrome.storage.sync.get(['whitelistPatterns'], res => {
      const wl = Array.isArray(res.whitelistPatterns) ? res.whitelistPatterns : [];
      if (!wl.includes(pat)) wl.push(pat);
      chrome.storage.sync.set({ whitelistPatterns: wl }, () => { document.getElementById('wlInput').value=''; load(); });
    });
  });
  document.getElementById('addBl').addEventListener('click', () => {
    const raw = document.getElementById('blInput').value;
    const pat = sanitizePatternInput(raw);
    if (!pat) return;
    chrome.storage.sync.get(['blacklistPatterns'], res => {
      const bl = Array.isArray(res.blacklistPatterns) ? res.blacklistPatterns : [];
      if (!bl.includes(pat)) bl.push(pat);
      chrome.storage.sync.set({ blacklistPatterns: bl }, () => { document.getElementById('blInput').value=''; load(); });
    });
  });
});