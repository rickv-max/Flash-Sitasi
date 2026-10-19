export class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function errorResponse(error, res) {
  // Never return provider bodies, credentials, or stack traces to the browser.
  const known = error instanceof AppError;
  if (!known) console.error('Server error:', error?.code || error?.name || 'unknown');
  return res.status(known ? error.status : 500).json({ success: false, error: {
    code: known ? error.code : 'INTERNAL_ERROR',
    message: known ? error.message : 'Proses belum berhasil. Silakan coba lagi sebentar.',
    ...(error?.paymentPending ? { paymentPending: true } : {}),
  } });
}
