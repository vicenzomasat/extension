'use strict';

/**
 * Detectors registry (stubs).
 * Phase 1: scaffold only, no behavior changes.
 */

const registry = new Map();

export function registerDetector(name, detectorFn) {
  if (typeof name !== 'string' || typeof detectorFn !== 'function') return;
  registry.set(name, detectorFn);
}

export function getDetectors() {
  return Array.from(registry.entries());
}
