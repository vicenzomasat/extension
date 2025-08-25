'use strict';

/**
 * Storage helpers (stubs).
 * Phase 1: scaffold only, no behavior changes.
 */

const hasChromeStorage = typeof chrome !== 'undefined' && chrome.storage;

export async function getSync(keys) {
  if (!hasChromeStorage) return {};
  return new Promise((resolve) => {
    chrome.storage.sync.get(keys, (items) => resolve(items || {}));
  });
}

export async function setSync(items) {
  if (!hasChromeStorage) return;
  return new Promise((resolve) => {
    chrome.storage.sync.set(items, () => resolve());
  });
}

export async function getLocal(keys) {
  if (!hasChromeStorage) return {};
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (items) => resolve(items || {}));
  });
}

export async function setLocal(items) {
  if (!hasChromeStorage) return;
  return new Promise((resolve) => {
    chrome.storage.local.set(items, () => resolve());
  });
}
