import axios from 'axios';

/**
 * Format error messages for user display
 */
export function formatErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const errorResponse = error.response?.data;
    
    // Check if backend already formatted the error
    if (errorResponse?.error) {
      return errorResponse.error;
    }
    
    // Format based on status code
    switch (error.response?.status) {
      case 400:
        return 'Invalid request. Please check your input and try again.';
      case 404:
        return 'The requested resource was not found.';
      case 409:
        return 'A conflict occurred. Please refresh and try again.';
      case 422:
        return errorResponse?.message || 'Validation failed. Please check your input.';
      case 500:
        return 'A server error occurred. Please try again later.';
      case 503:
        return 'Service temporarily unavailable. Please try again later.';
      default:
        return errorResponse?.message || 'An error occurred. Please try again.';
    }
  }
  
  if (error instanceof Error) {
    // Check for specific error types
    if (error.message.includes('Network Error') || error.message.includes('ECONNREFUSED')) {
      return 'Unable to connect to the server. Please check your internet connection.';
    }
    
    if (error.message.includes('timeout')) {
      return 'The request took too long. Please try again.';
    }
    
    return error.message;
  }
  
  return 'An unexpected error occurred. Please try again.';
}

