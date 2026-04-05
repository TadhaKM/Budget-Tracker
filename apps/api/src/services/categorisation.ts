/**
 * CategorisationService — the multi-stage pipeline that assigns a category,
 * merchant, and confidence score to every transaction.
 *
 * Pipeline stages (in priority order):
 *   1. User override (MerchantOverride table)
 *   2. Known merchant (rawPatterns match)
 *   3. Income detection (amount + keywords)
 *   4. Transfer detection (description patterns)
 *   5. ATM detection
 *   6. Keyword rules (fuzzy category hints)
 *   7. Fallback → OTHER
 */

import type { PrismaClient, Merchant, MerchantOverride } from '../../generated/prisma/client.js';
import { normaliseDescription, extractMerchantCandidate } from '../lib/merchant-normaliser.js';

// ─── Types ───────────────────────────────────────────────────────

export interface CategorisationInput {
  description: string;
  amount: string; // decimal string, negative = outgoing
  currency: string;
  merchantName?: string; // from provider, may be null
  isPending: boolean;
}

export interface CategorisationResult {
  categoryId: string;
  merchantId: string | null;
  cleanMerchantName: string | null;
  confidence: number; // 0.0 – 1.0
  source: CategorisationSource;
}

export type CategorisationSource =
  | 'USER_OVERRIDE'
  | 'KNOWN_MERCHANT'
  | 'INCOME_HEURISTIC'
  | 'TRANSFER_HEURISTIC'
  | 'ATM_HEURISTIC'
  | 'KEYWORD_RULE'
  | 'FALLBACK';

// ─── Keyword → category rules (Stage 6) ─────────────────────────

interface KeywordRule {
  keywords: string[];
  categoryId: string;
  confidence: number;
}

const KEYWORD_RULES: KeywordRule[] = [
  // Groceries
  { keywords: ['SUPERMARKET', 'GROCERY', 'FRESH', 'ORGANIC', 'BUTCHER', 'BAKERY', 'FARM SHOP'], categoryId: 'GROCERIES', confidence: 0.65 },
  // Dining
  { keywords: ['RESTAURANT', 'CAFE', 'COFFEE', 'PIZZA', 'BURGER', 'TAKEAWAY', 'FOOD HALL', 'CHIPPER', 'DINER', 'BAR ', 'PUB '], categoryId: 'DINING', confidence: 0.65 },
  // Transport
  { keywords: ['PARKING', 'FUEL', 'PETROL', 'DIESEL', 'TOPAZ', 'CIRCLE K', 'APPLEGREEN', 'MAXOL', 'TAXI', 'CAB ', 'BUS ', 'RAIL', 'LUAS', 'DART', 'TOLL'], categoryId: 'TRANSPORT', confidence: 0.65 },
  // Entertainment
  { keywords: ['CINEMA', 'THEATRE', 'THEATER', 'CONCERT', 'FESTIVAL', 'GAMING', 'STEAM ', 'PLAYSTATION', 'XBOX', 'NINTENDO', 'TWITCH'], categoryId: 'ENTERTAINMENT', confidence: 0.60 },
  // Shopping
  { keywords: ['AMAZON', 'EBAY', 'ASOS', 'IKEA', 'ARGOS', 'CURRYS', 'HARVEY NORMAN', 'BROWN THOMAS', 'ARNOTTS'], categoryId: 'SHOPPING', confidence: 0.60 },
  // Bills
  { keywords: ['INSURANCE', 'RENT ', 'MORTGAGE', 'COUNCIL', 'PROPERTY TAX', 'RATES', 'BROADBAND', 'PHONE BILL', 'MOBILE BILL', 'WASTE', 'BIN COLLECTION'], categoryId: 'BILLS', confidence: 0.70 },
  // Health
  { keywords: ['PHARMACY', 'CHEMIST', 'DOCTOR', 'DENTIST', 'HOSPITAL', 'CLINIC', 'PHYSIO', 'OPTICIAN', 'VHI', 'LAYA', 'IRISH LIFE'], categoryId: 'HEALTH', confidence: 0.65 },
  // Subscriptions (digital / recurring indicators)
  { keywords: ['SUBSCRIPTION', 'MONTHLY FEE', 'ANNUAL FEE', 'MEMBERSHIP', 'PREMIUM'], categoryId: 'SUBSCRIPTIONS', confidence: 0.60 },
];

// ─── Income detection patterns (Stage 3) ─────────────────────────

const SALARY_KEYWORDS = ['SALARY', 'WAGES', 'PAYROLL', 'PAY FROM', 'NET PAY', 'MONTHLY PAY'];
const GOVT_KEYWORDS = ['DEPT SOCIAL', 'DSP ', 'REVENUE REFUND', 'TAX REFUND', 'CHILD BENEFIT', 'HAP ', 'JOBSEEKER'];
const REFUND_KEYWORDS = ['REFUND', 'REVERSAL', 'CREDIT NOTE', 'RETURNED'];

// ─── Transfer detection patterns (Stage 4) ────────────────────────

const TRANSFER_KEYWORDS = [
  'TFR', 'TRANSFER TO', 'TRANSFER FROM', 'INTERNAL TRANSFER',
  'STANDING ORDER', 'S/O TO', 'S/O FROM',
  'REVOLUT', 'PAYPAL TO', 'SENT TO',
  'FASTER PAYMENT', 'SEPA CREDIT', 'SEPA TRANSFER',
  'FT TO', 'FT FROM',
];

// ─── ATM detection patterns (Stage 5) ────────────────────────────

const ATM_KEYWORDS = ['ATM', 'CASH WITHDRAWAL', 'CASH MACHINE', 'CDM', 'CASHPOINT'];

// ─── Service ─────────────────────────────────────────────────────

export class CategorisationService {
  // In-memory caches, refreshed per sync batch
  private merchantCache: Merchant[] = [];
  private overrideCache: Map<string, MerchantOverride> = new Map(); // key: merchantId
  private cacheUserId: string | null = null;

  constructor(private prisma: PrismaClient) {}

  /**
   * Load merchants and user overrides into memory for a batch of transactions.
   * Call once per sync, not per transaction.
   */
  async warmCache(userId: string): Promise<void> {
    const [merchants, overrides] = await Promise.all([
      this.prisma.merchant.findMany(),
      this.prisma.merchantOverride.findMany({ where: { userId } }),
    ]);

    this.merchantCache = merchants;
    this.overrideCache = new Map(overrides.map((o) => [o.merchantId, o]));
    this.cacheUserId = userId;
  }

  /**
   * Categorise a single transaction through the full pipeline.
   */
  categorise(input: CategorisationInput): CategorisationResult {
    const normDesc = normaliseDescription(input.description);
    const providerMerchant = input.merchantName
      ? normaliseDescription(input.merchantName)
      : null;

    // The string we match patterns against — prefer provider merchant name, fall back to description
    const matchTarget = providerMerchant ?? normDesc;
    const amount = parseFloat(input.amount);

    // Stage 1: User override
    const merchantMatch = this.findMerchant(matchTarget);
    if (merchantMatch) {
      const override = this.overrideCache.get(merchantMatch.id);
      if (override) {
        return {
          categoryId: override.categoryId,
          merchantId: merchantMatch.id,
          cleanMerchantName: merchantMatch.name,
          confidence: 1.0,
          source: 'USER_OVERRIDE',
        };
      }

      // Stage 2: Known merchant default
      return {
        categoryId: merchantMatch.defaultCategoryId,
        merchantId: merchantMatch.id,
        cleanMerchantName: merchantMatch.name,
        confidence: 0.9,
        source: 'KNOWN_MERCHANT',
      };
    }

    // Stage 3: Income detection
    const incomeResult = this.detectIncome(normDesc, amount);
    if (incomeResult) {
      return {
        ...incomeResult,
        merchantId: null,
        cleanMerchantName: extractMerchantCandidate(normDesc),
      };
    }

    // Stage 4: Transfer detection
    const transferResult = this.detectTransfer(normDesc, amount);
    if (transferResult) {
      return {
        ...transferResult,
        merchantId: null,
        cleanMerchantName: extractMerchantCandidate(normDesc),
      };
    }

    // Stage 5: ATM detection
    if (this.matchesAny(normDesc, ATM_KEYWORDS)) {
      return {
        categoryId: 'ATM',
        merchantId: null,
        cleanMerchantName: null,
        confidence: 0.95,
        source: 'ATM_HEURISTIC',
      };
    }

    // Stage 6: Keyword rules
    const keywordResult = this.matchKeywordRules(normDesc);
    if (keywordResult) {
      return {
        ...keywordResult,
        merchantId: null,
        cleanMerchantName: extractMerchantCandidate(normDesc),
      };
    }

    // Stage 7: Fallback
    return {
      categoryId: 'OTHER',
      merchantId: null,
      cleanMerchantName: extractMerchantCandidate(normDesc),
      confidence: 0.0,
      source: 'FALLBACK',
    };
  }

  // ── Stage helpers ──────────────────────────────────────────────

  private findMerchant(matchTarget: string): Merchant | null {
    const target = matchTarget.toUpperCase();

    for (const merchant of this.merchantCache) {
      for (const pattern of merchant.rawPatterns) {
        // Convert SQL LIKE pattern (%X%) to a simple contains/startsWith/endsWith check
        if (this.likeMatch(target, pattern.toUpperCase())) {
          return merchant;
        }
      }
    }
    return null;
  }

  /**
   * Simple SQL LIKE emulation: only supports % wildcards at start/end.
   * '%TESCO%' → contains('TESCO')
   * 'TESCO%'  → startsWith('TESCO')
   * '%TESCO'  → endsWith('TESCO')
   * 'TESCO'   → exact match
   */
  private likeMatch(value: string, pattern: string): boolean {
    const startsWild = pattern.startsWith('%');
    const endsWild = pattern.endsWith('%');
    const core = pattern.replace(/^%|%$/g, '');

    if (startsWild && endsWild) return value.includes(core);
    if (startsWild) return value.endsWith(core);
    if (endsWild) return value.startsWith(core);
    return value === core;
  }

  private detectIncome(
    normDesc: string,
    amount: number,
  ): Pick<CategorisationResult, 'categoryId' | 'confidence' | 'source'> | null {
    if (amount <= 0) return null; // outgoing money can't be income

    // Salary keywords + large amount
    if (this.matchesAny(normDesc, SALARY_KEYWORDS) && amount > 500) {
      return { categoryId: 'INCOME', confidence: 0.95, source: 'INCOME_HEURISTIC' };
    }

    // Government payments
    if (this.matchesAny(normDesc, GOVT_KEYWORDS)) {
      return { categoryId: 'INCOME', confidence: 0.90, source: 'INCOME_HEURISTIC' };
    }

    // Salary keywords without amount threshold
    if (this.matchesAny(normDesc, SALARY_KEYWORDS)) {
      return { categoryId: 'INCOME', confidence: 0.80, source: 'INCOME_HEURISTIC' };
    }

    // Refunds (smaller amounts)
    if (this.matchesAny(normDesc, REFUND_KEYWORDS)) {
      return { categoryId: 'INCOME', confidence: 0.75, source: 'INCOME_HEURISTIC' };
    }

    // Large generic credit — might be salary from unknown employer
    if (amount > 500) {
      return { categoryId: 'INCOME', confidence: 0.50, source: 'INCOME_HEURISTIC' };
    }

    return null; // don't categorise small credits as income
  }

  private detectTransfer(
    normDesc: string,
    _amount: number,
  ): Pick<CategorisationResult, 'categoryId' | 'confidence' | 'source'> | null {
    if (this.matchesAny(normDesc, TRANSFER_KEYWORDS)) {
      // Higher confidence for explicit transfer language
      const isExplicit = normDesc.includes('TRANSFER') || normDesc.includes('INTERNAL') || normDesc.includes('S/O');
      return {
        categoryId: 'TRANSFERS',
        confidence: isExplicit ? 0.90 : 0.70,
        source: 'TRANSFER_HEURISTIC',
      };
    }
    return null;
  }

  private matchKeywordRules(
    normDesc: string,
  ): Pick<CategorisationResult, 'categoryId' | 'confidence' | 'source'> | null {
    for (const rule of KEYWORD_RULES) {
      if (this.matchesAny(normDesc, rule.keywords)) {
        return {
          categoryId: rule.categoryId,
          confidence: rule.confidence,
          source: 'KEYWORD_RULE',
        };
      }
    }
    return null;
  }

  private matchesAny(text: string, keywords: string[]): boolean {
    const upper = text.toUpperCase();
    return keywords.some((kw) => upper.includes(kw.toUpperCase()));
  }
}
