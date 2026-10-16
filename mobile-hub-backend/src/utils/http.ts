import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const asyncHandler = (
  handler: (request: Request, response: Response, next: NextFunction) => Promise<unknown>
): RequestHandler => (request, response, next) => {
  void handler(request, response, next).catch(next);
};

export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  if (error instanceof ZodError) {
    response.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Request validation failed.', details: error.issues }
    });
    return;
  }
  if (error instanceof HttpError) {
    response.status(error.statusCode).json({
      error: { code: error.code, message: error.message }
    });
    return;
  }
  if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
    response.status(409).json({
      error: { code: 'CONFLICT', message: 'A record with those details already exists.' }
    });
    return;
  }
  console.error(JSON.stringify({
    level: 'error',
    event: 'unhandled_api_error',
    requestId: _request.requestId,
    errorName: error instanceof Error ? error.name : 'UnknownError'
  }));
  response.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' },
    requestId: _request.requestId
  });
};
