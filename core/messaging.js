'use strict';

/**
 * Messaging channels and helpers (stubs).
 * Phase 1: scaffold only, no behavior changes.
 */

export const Channels = Object.freeze({
  Detected: 'detected',
  UpdateBadge: 'update-badge',
  OptionsChanged: 'options-changed',
});

export function sendMessage(/* channel, payload */) {
  // Stub – wiring will be added in later phases.
}

export function onMessage(/* channel, handler */) {
  // Stub – wiring will be added in later phases.
}
