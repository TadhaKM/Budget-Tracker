/**
 * Provider-agnostic open banking adapter interface.
 *
 * The rest of the app (routes, services, workers) depends ONLY on these
 * types and the BankingProvider interface — never on TrueLayer directly.
 */

// ─── Normalised domain models ────────────────────────────────────

export interface ProviderAccount {
  externalId: string;
  accountType: string; // CURRENT | SAVINGS | CREDIT_CARD
  displayName: string;
  currency: string;
  accountNumber?: {
    iban?: string;
    sortCode?: string;
    number?: string;
  };
}

export interface ProviderBalance {
  current: string; // string to preserve decimal precision
  available?: string;
  currency: string;
  updatedAt: string; // ISO 8601
}

export interface ProviderTransaction {
  externalId: string;
  amount: string; // negative = outgoing, positive = incoming
  currency: string;
  description: string;
  merchantName?: string;
  category?: string; // vendor hint — we re-categorise internally
  isPending: boolean;
  bookedAt: string; // ISO 8601
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
  scope: string;
}

export interface AuthUrlParams {
  state: string;
  institutionId: string;
  redirectUri: string;
}

export interface TransactionFetchOptions {
  from: string; // ISO 8601 date
  to: string;
}

// ─── Webhook events ──────────────────────────────────────────────

export type WebhookEventType =
  | 'SYNC_AVAILABLE'
  | 'CONSENT_REVOKED'
  | 'CONSENT_EXPIRING'
  | 'ERROR';

export interface WebhookEvent {
  type: WebhookEventType;
  connectionExternalId?: string;
  accountExternalId?: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}

// ─── Provider errors ─────────────────────────────────────────────

export class ProviderError extends Error {
  constructor(
    public providerCode: string,
    message: string,
    public statusCode?: number,
    public isRetryable: boolean = false,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export class TokenExpiredError extends ProviderError {
  constructor(message = 'Access token expired') {
    super('TOKEN_EXPIRED', message, 401, false);
    this.name = 'TokenExpiredError';
  }
}

export class RefreshTokenExpiredError extends ProviderError {
  constructor(message = 'Refresh token expired — user must re-authenticate') {
    super('REFRESH_TOKEN_EXPIRED', message, 401, false);
    this.name = 'RefreshTokenExpiredError';
  }
}

export class ProviderRateLimitError extends ProviderError {
  constructor(
    public retryAfterSeconds: number,
    message = 'Rate limited by provider',
  ) {
    super('RATE_LIMITED', message, 429, true);
    this.name = 'ProviderRateLimitError';
  }
}

export class ProviderUnavailableError extends ProviderError {
  constructor(message = 'Provider temporarily unavailable') {
    super('PROVIDER_UNAVAILABLE', message, 503, true);
    this.name = 'ProviderUnavailableError';
  }
}

export class ConsentRevokedError extends ProviderError {
  constructor(message = 'Consent has been revoked') {
    super('CONSENT_REVOKED', message, 403, false);
    this.name = 'ConsentRevokedError';
  }
}

// ─── Adapter interface ───────────────────────────────────────────

export interface BankingProvider {
  readonly name: string; // e.g. 'truelayer'

  // OAuth consent flow
  getAuthUrl(params: AuthUrlParams): string;
  exchangeCode(code: string): Promise<TokenPair>;
  refreshTokens(refreshToken: string): Promise<TokenPair>;

  // Data fetching
  getAccounts(accessToken: string): Promise<ProviderAccount[]>;
  getBalance(accessToken: string, accountExternalId: string): Promise<ProviderBalance>;
  getTransactions(
    accessToken: string,
    accountExternalId: string,
    options: TransactionFetchOptions,
  ): Promise<ProviderTransaction[]>;

  // Webhooks
  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean;
  parseWebhookEvent(payload: unknown): WebhookEvent;
}
