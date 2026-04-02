export async function syncAccountData(_userId: string, _accountId: string): Promise<void> {
  // TODO:
  // 1. Get ConnectedBank for user
  // 2. Decrypt access token
  // 3. Refresh if expired
  // 4. Fetch accounts from TrueLayer
  // 5. Fetch transactions from TrueLayer
  // 6. Upsert into database
  // 7. Run recurring payment detection
  // 8. Update lastSynced timestamp
  throw new Error('Not implemented');
}
