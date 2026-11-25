/* =====================================================================
   DATA ERRORS
   Every data function fails by throwing { code, message }. `message` is
   ready to show the user (screens show it with a Retry button, req 6.5).
   ===================================================================== */

import { t } from '../core/theme-engine.js';

export class DataError extends Error {
  constructor(code, messageKey = 'err.generic') {
    super(t(messageKey));
    this.code = code;
  }
}

export function networkError() {
  return new DataError('network', 'err.network');
}

/** Anything thrown that isn't already a DataError becomes a generic one. */
export function asDataError(error) {
  if (error instanceof DataError) return error;
  if (error && error.code && error.message) return error;
  return new DataError('unknown', 'err.generic');
}
