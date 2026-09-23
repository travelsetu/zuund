import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * A business-rule failure with a stable machine-readable code. Frontends
 * switch on `code`; `message` is safe to show to the user as-is.
 */
export class DomainException extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly details?: unknown,
  ) {
    super({ code, message, details }, status);
  }
}

export const E = {
  // buying posts
  DUPLICATE_ACTIVE_POST: (m = 'You already have an active buying post for this car in this city') =>
    new DomainException('DUPLICATE_ACTIVE_POST', m, HttpStatus.CONFLICT),
  POST_NOT_EDITABLE: () =>
    new DomainException(
      'POST_NOT_EDITABLE',
      'This buying post is closed and can no longer be changed',
    ),
  POST_NOT_ACTIVE: () => new DomainException('POST_NOT_ACTIVE', 'This buying post is not active'),
  INVALID_TRANSITION: (m: string) => new DomainException('INVALID_TRANSITION', m),
  // connections
  ALREADY_CONNECTED: () => new DomainException('ALREADY_CONNECTED', 'You are already connected'),
  REQUEST_ALREADY_SENT: () =>
    new DomainException('REQUEST_ALREADY_SENT', 'Connection request already sent'),
  REQUEST_NOT_PENDING: () =>
    new DomainException('REQUEST_NOT_PENDING', 'This request is not pending'),
  NOT_CONNECTED: () =>
    new DomainException(
      'NOT_CONNECTED',
      'Connect with this buyer to message them',
      HttpStatus.FORBIDDEN,
    ),
  BLOCKED: () => new DomainException('BLOCKED', 'Not available', HttpStatus.FORBIDDEN),
  // collectives
  COLLECTIVE_CLOSED: () =>
    new DomainException('COLLECTIVE_CLOSED', 'This collective is closed', HttpStatus.FORBIDDEN),
  NOT_A_MEMBER: () =>
    new DomainException(
      'NOT_A_MEMBER',
      'You are not a member of this collective',
      HttpStatus.FORBIDDEN,
    ),
  BUYING_PASS_REQUIRED: () =>
    new DomainException(
      'BUYING_PASS_REQUIRED',
      'A Buying Pass for this buying post is required to participate',
      HttpStatus.FORBIDDEN,
    ),
  BUYING_PASS_EXPIRED: () =>
    new DomainException(
      'BUYING_PASS_EXPIRED',
      'Your Buying Pass has expired',
      HttpStatus.FORBIDDEN,
    ),
  INTENT_MISMATCH: () =>
    new DomainException(
      'INTENT_MISMATCH',
      'Your buying post is for a different car or city than this collective',
    ),
  ALREADY_IN_COLLECTIVE: (m = 'This buying post is already in a collective') =>
    new DomainException('ALREADY_IN_COLLECTIVE', m, HttpStatus.CONFLICT),
  // payments
  JOIN_FIRST: () =>
    new DomainException('JOIN_FIRST', 'Join the collective with this buying post before paying'),
  PAYMENT_ALREADY_SUCCEEDED: () =>
    new DomainException(
      'PAYMENT_ALREADY_SUCCEEDED',
      'This payment has already succeeded',
      HttpStatus.CONFLICT,
    ),
  PASS_ALREADY_ACTIVE: () =>
    new DomainException(
      'PASS_ALREADY_ACTIVE',
      'This buying post already has an active Buying Pass',
      HttpStatus.CONFLICT,
    ),
  PAYMENT_VERIFICATION_FAILED: () =>
    new DomainException('PAYMENT_VERIFICATION_FAILED', 'The payment could not be verified'),
  PAYMENT_ORDER_MISMATCH: () =>
    new DomainException('PAYMENT_ORDER_MISMATCH', 'The payment does not match this order'),
  REFUND_NOT_ALLOWED: (m: string) => new DomainException('REFUND_NOT_ALLOWED', m),
  // polls
  POLL_CLOSED: () => new DomainException('POLL_CLOSED', 'This poll is closed'),
  ALREADY_VOTED: () => new DomainException('ALREADY_VOTED', 'You have already voted on this poll'),
  INVALID_VOTE: (m: string) => new DomainException('INVALID_VOTE', m),
  NOT_CREATOR: (what: string) =>
    new DomainException(
      'NOT_CREATOR',
      `Only the ${what} creator can do this`,
      HttpStatus.FORBIDDEN,
    ),
  // misc
  ACCOUNT_NOT_ACTIVE: () =>
    new DomainException(
      'ACCOUNT_NOT_ACTIVE',
      'This account is not active',
      HttpStatus.UNAUTHORIZED,
    ),
  INVALID_CREDENTIALS: () =>
    new DomainException(
      'INVALID_CREDENTIALS',
      'Invalid email or password',
      HttpStatus.UNAUTHORIZED,
    ),
  PHONE_TAKEN: () =>
    new DomainException(
      'PHONE_TAKEN',
      'An account with this mobile number already exists',
      HttpStatus.CONFLICT,
    ),
  EMAIL_TAKEN: () =>
    new DomainException(
      'EMAIL_TAKEN',
      'An account with this email already exists',
      HttpStatus.CONFLICT,
    ),
  SELF_ACTION: (m: string) => new DomainException('SELF_ACTION', m),
};
