import crypto from 'node:crypto';
import type {
  BankingProvider,
  AuthUrlParams,
  TokenPair,
  ProviderAccount,
  ProviderBalance,
  ProviderTransaction,
  TransactionFetchOptions,
  WebhookEvent,
  WebhookEventType,
} from '../lib/banking-provider.js';
import {
  ProviderError,
  TokenExpiredError,
  RefreshTokenExpiredError,
  ProviderRateLimitError,
  ProviderUnavailableError,
  ConsentRevokedError,
} from '../lib/banking-provider.js';

// ─── TrueLayer API base URLs ────────────────────────────────────

const AUTH_BASE = {
  sandbox: 'https://auth.truelayer-sandbox.com',
  live: 'https://auth.truelayer.com',
} as const;

const API_BASE = {
  sandbox: 'https://api.truelayer-sandbox.com',
  live: 'https://api.truelayer.com',
} as const;

// ─── TrueLayer response shapes (vendor-specific, never exported) ─

interface TLTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

interface TLAccount {
  account_id: string;
  account_type: string;
  display_name: string;
  currency: string;
  account_number?: {
    iban?: string;
    sort_code?: string;
    number?: string;
  };
}

interface TLBalance {
  current: number;
  available?: number;
  currency: string;
  update_timestamp: string;
}

interface TLTransaction {
  transaction_id: string;
  amount: number;
  currency: string;
  description: string;
  merchant_name?: string;
  transaction_category?: string;
  transaction_classification?: string[];
  status: string; // Booked | Pending
  timestamp: string;
}

interface TLWebhookPayload {
  type: string;
  event_id: string;
  event_uri?: string;
  account_id?: string;
  credentials_id?: string;
  timestamp: string;
  [key: string]: unknown;
}

// ─── Config ──────────────────────────────────────────────────────

export interface TrueLayerConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  webhookSecret: string;
  env: 'sandbox' | 'live';
}

// ─── Implementation ──────────────────────────────────────────────

export class TrueLayerProvider implements BankingProvider {
  readonly name = 'truelayer' as const;

  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly webhookSecret: string;
  private readonly authBase: string;
  private readonly apiBase: string;

  constructor(config: TrueLayerConfig) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.redirectUri = config.redirectUri;
    this.webhookSecret = config.webhookSecret;
    this.authBase = AUTH_BASE[config.env];
    this.apiBase = API_BASE[config.env];
  }

  // ── OAuth flow ───────────────────────────────────────────────

  getAuthUrl(params: AuthUrlParams): string {
    const qs = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: params.redirectUri,
      scope: 'info accounts balance transactions',
      providers: params.institutionId,
      state: params.state,
    });
    return `${this.authBase}/?${qs.toString()}`;
  }

  async exchangeCode(code: string): Promise<TokenPair> {
    const res = await this.post<TLTokenResponse>(
      `${this.authBase}/connect/token`,
      {
        grant_type: 'authorization_code',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        code,
      },
    );
    return this.mapTokenResponse(res);
  }

  async refreshTokens(refreshToken: string): Promise<TokenPair> {
    try {
      const res = await this.post<TLTokenResponse>(
        `${this.authBase}/connect/token`,
        {
          grant_type: 'refresh_token',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: refreshToken,
        },
      );
      return this.mapTokenResponse(res);
    } catch (err) {
      if (err instanceof TokenExpiredError) {
        throw new RefreshTokenExpiredError();
      }
      throw err;
    }
  }

  // ── Data fetching ────────────────────────────────────────────

  async getAccounts(accessToken: string): Promise<ProviderAccount[]> {
    const res = await this.get<{ results: TLAccount[] }>(
      `${this.apiBase}/data/v1/accounts`,
      accessToken,
    );
    return res.results.map((a) => ({
      externalId: a.account_id,
      accountType: a.account_type.toUpperCase(),
      displayName: a.display_name,
      currency: a.currency,
      ...(a.account_number && {
        accountNumber: {
          iban: a.account_number.iban,
          sortCode: a.account_number.sort_code,
          number: a.account_number.number,
        },
      }),
    }));
  }

  async getBalance(accessToken: string, accountExternalId: string): Promise<ProviderBalance> {
    const res = await this.get<{ results: TLBalance[] }>(
      `${this.apiBase}/data/v1/accounts/${accountExternalId}/balance`,
      accessToken,
    );
    const b = res.results[0];
    if (!b) throw new ProviderError('NO_BALANCE', 'No balance data returned');
    return {
      current: String(b.current),
      available: b.available != null ? String(b.available) : undefined,
      currency: b.currency,
      updatedAt: b.update_timestamp,
    };
  }

  async getTransactions(
    accessToken: string,
    accountExternalId: string,
    options: TransactionFetchOptions,
  ): Promise<ProviderTransaction[]> {
    const qs = new URLSearchParams({ from: options.from, to: options.to });
    const res = await this.get<{ results: TLTransaction[] }>(
      `${this.apiBase}/data/v1/accounts/${accountExternalId}/transactions?${qs.toString()}`,
      accessToken,
    );
    return res.results.map((t) => ({
      externalId: t.transaction_id,
      amount: String(t.amount),
      currency: t.currency,
      description: t.description,
      merchantName: t.merchant_name,
      category: t.transaction_category ?? t.transaction_classification?.[0],
      isPending: t.status === 'Pending',
      bookedAt: t.timestamp,
    }));
  }

  // ── Webhooks ─────────────────────────────────────────────────

  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
    const expected = crypto
      .createHmac('sha512', this.webhookSecret)
      .update(rawBody)
      .digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(signature, 'hex'),
    );
  }

  parseWebhookEvent(payload: unknown): WebhookEvent {
    const p = payload as TLWebhookPayload;
    return {
      type: this.mapWebhookType(p.type),
      accountExternalId: p.account_id,
      connectionExternalId: p.credentials_id,
      timestamp: p.timestamp,
      metadata: p,
    };
  }

  // ── Private helpers ──────────────────────────────────────────

  private mapTokenResponse(res: TLTokenResponse): TokenPair {
    return {
      accessToken: res.access_token,
      refreshToken: res.refresh_token,
      expiresIn: res.expires_in,
      scope: res.scope,
    };
  }

  private mapWebhookType(tlType: string): WebhookEventType {
    const map: Record<string, WebhookEventType> = {
      account_data_available: 'SYNC_AVAILABLE',
      consent_revoked: 'CONSENT_REVOKED',
      consent_expiring: 'CONSENT_EXPIRING',
    };
    return map[tlType] ?? 'ERROR';
  }

  private async get<T>(url: string, accessToken: string): Promise<T> {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });
    return this.handleResponse<T>(res);
  }

  private async post<T>(url: string, body: Record<string, string>): Promise<T> {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(body).toString(),
    });
    return this.handleResponse<T>(res);
  }

  private async handleResponse<T>(res: Response): Promise<T> {
    if (res.ok) return (await res.json()) as T;

    const text = await res.text().catch(() => '');

    if (res.status === 401) {
      throw new TokenExpiredError(text || 'Unauthorized');
    }
    if (res.status === 403) {
      throw new ConsentRevokedError(text || 'Forbidden');
    }
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('Retry-After') ?? '60', 10);
      throw new ProviderRateLimitError(retryAfter, text || 'Rate limited');
    }
    if (res.status >= 500) {
      throw new ProviderUnavailableError(text || `Provider returned ${res.status}`);
    }

    throw new ProviderError(
      'PROVIDER_ERROR',
      text || `TrueLayer returned ${res.status}`,
      res.status,
      false,
    );
  }
}

// ─── Factory ─────────────────────────────────────────────────────

let _instance: BankingProvider | null = null;

export function createBankingProvider(config: TrueLayerConfig): BankingProvider {
  _instance = new TrueLayerProvider(config);
  return _instance;
}

export function getBankingProvider(): BankingProvider {
  if (!_instance) throw new Error('BankingProvider not initialised — call createBankingProvider() first');
  return _instance;
}
