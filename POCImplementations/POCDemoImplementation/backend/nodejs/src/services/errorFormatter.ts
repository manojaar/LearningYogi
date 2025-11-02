/**
 * Error formatter service to convert technical errors to human-readable messages
 */

export interface FormattedError {
  message: string;
  code?: string;
  details?: string;
}

/**
 * Format error to human-readable message
 */
export function formatError(error: any): FormattedError {
  const errorMessage = error?.message || String(error) || 'An unknown error occurred';
  const errorCode = error?.code || error?.statusCode || undefined;

  // Database errors
  if (errorMessage.includes('SQLITE') || errorMessage.includes('database') || errorMessage.includes('constraint')) {
    return {
      message: 'Unable to save data. Please try again.',
      code: errorCode || 'DATABASE_ERROR',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
    };
  }

  // Network/Connection errors
  if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ETIMEDOUT') || errorMessage.includes('network')) {
    return {
      message: 'Connection problem. Please check your internet connection and try again.',
      code: errorCode || 'NETWORK_ERROR',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
    };
  }

  // Validation errors
  if (errorMessage.includes('validation') || errorMessage.includes('invalid') || errorMessage.includes('required')) {
    return {
      message: errorMessage.includes('validation') 
        ? 'The provided data is invalid. Please check your input and try again.'
        : 'Invalid data provided. Please check your input and try again.',
      code: errorCode || 'VALIDATION_ERROR',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
    };
  }

  // Not found errors
  if (errorMessage.includes('not found') || errorMessage.includes('404')) {
    return {
      message: 'The requested resource was not found.',
      code: errorCode || 'NOT_FOUND',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
    };
  }

  // Processing errors
  if (errorMessage.includes('processing') || errorMessage.includes('OCR') || errorMessage.includes('AI')) {
    return {
      message: 'Unable to process timetable. Please check the file and try again.',
      code: errorCode || 'PROCESSING_ERROR',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
    };
  }

  // Redis/Cache errors (silent - don't show to user)
  if (errorMessage.includes('Redis') || errorMessage.includes('cache')) {
    return {
      message: 'A temporary error occurred. Please try again.',
      code: errorCode || 'CACHE_ERROR',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
    };
  }

  // Timeout errors
  if (errorMessage.includes('timeout') || errorMessage.includes('TIMEOUT')) {
    return {
      message: 'The request took too long. Please try again.',
      code: errorCode || 'TIMEOUT_ERROR',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
    };
  }

  // Generic error - return original message but formatted
  return {
    message: errorMessage.length > 200 
      ? errorMessage.substring(0, 200) + '...'
      : errorMessage,
    code: errorCode,
    details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
  };
}

/**
 * Format API error response
 */
export function formatApiError(error: any, statusCode: number = 500): { error: string; code?: string; details?: string } {
  const formatted = formatError(error);
  return {
    error: formatted.message,
    code: formatted.code,
    details: formatted.details,
  };
}

