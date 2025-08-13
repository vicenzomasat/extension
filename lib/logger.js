'use strict';

/**
 * Minimal logger (no-op by default).
 * Phase 1: scaffold only, no behavior changes.
 */

class Logger {
  constructor(enabled = false) {
    this.enabled = enabled;
  }
  setEnabled(v) {
    this.enabled = Boolean(v);
  }
  debug(...args) {
    if (this.enabled) console.debug('[ext][debug]', ...args);
  }
  info(...args) {
    if (this.enabled) console.info('[ext][info]', ...args);
  }
  warn(...args) {
    if (this.enabled) console.warn('[ext][warn]', ...args);
  }
  error(...args) {
    if (this.enabled) console.error('[ext][error]', ...args);
  }
}

export const logger = new Logger(false);
