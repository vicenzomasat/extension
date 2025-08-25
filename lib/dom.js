'use strict';

/**
 * DOM utilities (stubs).
 * Phase 1: scaffold only, no behavior changes.
 */

export function onReady(cb) {
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(cb, 0);
  } else {
    document.addEventListener('DOMContentLoaded', cb, { once: true });
  }
}

export function $(selector, root = document) {
  return root.querySelector(selector);
}

export function $all(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}
