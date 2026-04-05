/**
 * MerchantNormaliser — strips bank-specific noise from raw transaction
 * descriptions so they can be matched against the merchants table.
 *
 * Irish bank descriptions typically look like:
 *   "POS TESCO STORES 3219 DUBLIN IE"
 *   "VDP-UBER *TRIP HELP.UBER.COM NL"
 *   "DD NETFLIX.COM 800-123-456"
 *   "STO ELECTRIC IRELAND DD 30APR"
 *   "FT FROM JOHN SMITH REF 12345"
 */

// Step 1: Transaction type prefixes added by Irish banks
const TX_PREFIXES =
  /^(?:POS|VDP|VDA|DD|STO|FT|BGC|DEB|BP|TFR|S\/O|D\/D|PAY|CHQ|ATM|CDM)\s*[-:]?\s*/i;

// Step 2: Trailing noise — country codes, city names, reference numbers, dates
const TRAILING_COUNTRY = /\s+[A-Z]{2}$/; // "IE", "NL", "GB"
const TRAILING_REFS = /\s+(?:REF|TXN|ID)\s*[:#]?\s*\S+$/i;
const TRAILING_DATES = /\s+\d{2}(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\d{0,2}$/i;
const TRAILING_NUMBERS = /\s+\d{4,}$/; // terminal IDs, branch codes

// Step 3: Card / account fragments
const CARD_NUMBERS = /\s*\*+\d{2,4}/g; // *1234, ***4567
const ACCOUNT_REFS = /\s*(?:xx|XX)\d{4,}/g; // xx1234
const URL_FRAGMENTS = /\s+\S+\.(?:com|co\.uk|ie|eu|net|org)\S*/gi;

// Step 4: Common filler words in bank descriptions
const FILLER_WORDS = /\s+(?:PAYMENT|PURCHASE|DEBIT|CREDIT|TRANSACTION)\s*/gi;

// Irish cities — strip these from the end of descriptions
const IRISH_CITIES =
  /\s+(?:DUBLIN|CORK|GALWAY|LIMERICK|WATERFORD|KILKENNY|WEXFORD|DROGHEDA|DUNDALK|ATHLONE|NAVAN|NAAS|BRAY|SWORDS|BLANCHARDSTOWN|LIFFEY\s*(?:VLY|VALLEY)?)\s*$/i;

/**
 * Normalise a raw bank description into a clean, matchable string.
 * Returns uppercase for consistent pattern matching.
 */
export function normaliseDescription(raw: string): string {
  let s = raw.trim().toUpperCase();

  // Strip transaction type prefix
  s = s.replace(TX_PREFIXES, '');

  // Strip card/account fragments
  s = s.replace(CARD_NUMBERS, '');
  s = s.replace(ACCOUNT_REFS, '');

  // Strip URLs (but extract merchant hint first)
  s = s.replace(URL_FRAGMENTS, '');

  // Strip filler words
  s = s.replace(FILLER_WORDS, ' ');

  // Strip trailing noise (apply multiple passes — layers can stack)
  s = s.replace(TRAILING_DATES, '');
  s = s.replace(TRAILING_REFS, '');
  s = s.replace(IRISH_CITIES, '');
  s = s.replace(TRAILING_COUNTRY, '');
  s = s.replace(TRAILING_NUMBERS, '');

  // Collapse whitespace and trim
  s = s.replace(/\s+/g, ' ').trim();

  return s;
}

/**
 * Extract a likely merchant name from a normalised description.
 * Takes the first 2–3 meaningful words as the merchant candidate.
 * This is used when no pattern match is found — a best-effort clean name.
 */
export function extractMerchantCandidate(normalised: string): string {
  const words = normalised.split(' ').filter((w) => w.length > 1);

  // Special cases: "FROM JOHN SMITH" → "John Smith"
  if (words[0] === 'FROM' && words.length >= 2) {
    return titleCase(words.slice(1, 4).join(' '));
  }

  // Take up to 3 words as merchant name
  return titleCase(words.slice(0, 3).join(' '));
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
