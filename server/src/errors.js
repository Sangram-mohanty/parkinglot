export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

export function errorHandler(error, _req, res, _next) {
  if (error?.name === 'ZodError') {
    return res.status(400).json({ message: 'Invalid request.', errors: error.issues });
  }
  if (error?.code === 11000) {
    return res.status(409).json({ message: 'A record with these details already exists.' });
  }
  if (error?.name === 'CastError') {
    return res.status(400).json({ message: 'Invalid record identifier.' });
  }
  if (error instanceof ApiError) {
    return res.status(error.status).json({ message: error.message });
  }
  console.error(error);
  return res.status(500).json({ message: 'An unexpected server error occurred.' });
}
