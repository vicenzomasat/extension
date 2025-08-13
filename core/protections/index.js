'use strict';

/**
 * Protections registry (stubs).
 * Phase 1: scaffold only, no behavior changes.
 */

const registry = new Map();

export function registerProtection(name, protectionFn) {
  if (typeof name !== 'string' || typeof protectionFn !== 'function') return;
  registry.set(name, protectionFn);
}

export function getProtections() {
  return Array.from(registry.entries());
}
