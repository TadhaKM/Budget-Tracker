const TRUELAYER_AUTH_BASE = {
  sandbox: 'https://auth.truelayer-sandbox.com',
  live: 'https://auth.truelayer.com',
} as const;

const TRUELAYER_API_BASE = {
  sandbox: 'https://api.truelayer-sandbox.com',
  live: 'https://api.truelayer.com',
} as const;

interface TrueLayerConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  env: 'sandbox' | 'live';
}

export class TrueLayerService {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private env: 'sandbox' | 'live';

  constructor(config: TrueLayerConfig) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.redirectUri = config.redirectUri;
    this.env = config.env;
  }

  getAuthUrl(state: string): string {
    const base = TRUELAYER_AUTH_BASE[this.env];
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: 'info accounts balance transactions',
      providers: 'ie-ob-aib ie-ob-boi ie-ob-ptsb',
      state,
    });
    return `${base}/?${params}`;
  }

  async exchangeCode(_code: string): Promise<{ accessToken: string; refreshToken: string }> {
    // TODO: POST to /connect/token with authorization_code grant
    throw new Error('Not implemented');
  }

  async getAccounts(_accessToken: string): Promise<unknown[]> {
    // TODO: GET /data/v1/accounts
    throw new Error('Not implemented');
  }

  async getTransactions(
    _accessToken: string,
    _accountId: string,
  ): Promise<unknown[]> {
    // TODO: GET /data/v1/accounts/{id}/transactions
    throw new Error('Not implemented');
  }

  async refreshToken(
    _refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    // TODO: POST /connect/token with refresh_token grant
    throw new Error('Not implemented');
  }

  private get apiBase(): string {
    return TRUELAYER_API_BASE[this.env];
  }

  private get authBase(): string {
    return TRUELAYER_AUTH_BASE[this.env];
  }
}
