import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Convert an axios / FastAPI error into a message that is safe to show a user.
 * FastAPI sends `detail` as a string for HTTPException and as a list of
 * `{ loc, msg }` objects for request-validation (422) errors.
 */
export function getApiErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (error?.response) {
    const detail = error.response.data?.detail;
    if (typeof detail === 'string' && detail.trim()) return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      return detail
        .map((d) => {
          const field = Array.isArray(d.loc) ? d.loc.filter((part) => part !== 'body').join(' > ') : '';
          return field ? `${field}: ${d.msg}` : d.msg;
        })
        .join('; ');
    }
    return fallback;
  }
  if (error?.request) {
    return 'Cannot reach the server. Check your connection and try again.';
  }
  return fallback;
}
