import { friendlyError, getErrorMessage } from '../../lib/errorMessages';
import { FOLLOWUP_MESSAGES } from './model';
export function followupError(error: unknown, fallback: string): string {
  const message = getErrorMessage(error);
  return FOLLOWUP_MESSAGES.includes(message) ? message : friendlyError(error, fallback);
}
