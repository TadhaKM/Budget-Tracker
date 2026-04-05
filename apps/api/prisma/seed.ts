/**
 * Prisma seed script — populates categories and known Irish merchants.
 *
 * Run: npx prisma db seed
 * Config: add to package.json: "prisma": { "seed": "npx tsx prisma/seed.ts" }
 */

import { PrismaClient } from '../generated/prisma/client.js';

const prisma = new PrismaClient();

// ─── Categories ──────────────────────────────────────────────────

const CATEGORIES = [
  { id: 'GROCERIES', label: 'Groceries', icon: 'cart', color: '#22c55e', sortOrder: 1, isExpense: true },
  { id: 'DINING', label: 'Dining & Takeaway', icon: 'restaurant', color: '#f97316', sortOrder: 2, isExpense: true },
  { id: 'TRANSPORT', label: 'Transport', icon: 'bus', color: '#3b82f6', sortOrder: 3, isExpense: true },
  { id: 'ENTERTAINMENT', label: 'Entertainment', icon: 'film', color: '#a855f7', sortOrder: 4, isExpense: true },
  { id: 'SHOPPING', label: 'Shopping', icon: 'bag', color: '#ec4899', sortOrder: 5, isExpense: true },
  { id: 'BILLS', label: 'Bills & Utilities', icon: 'receipt', color: '#64748b', sortOrder: 6, isExpense: true },
  { id: 'HEALTH', label: 'Health & Fitness', icon: 'heart', color: '#ef4444', sortOrder: 7, isExpense: true },
  { id: 'SUBSCRIPTIONS', label: 'Subscriptions', icon: 'refresh', color: '#8b5cf6', sortOrder: 8, isExpense: true },
  { id: 'TRANSFERS', label: 'Transfers', icon: 'swap-horizontal', color: '#06b6d4', sortOrder: 9, isExpense: false },
  { id: 'INCOME', label: 'Income', icon: 'cash', color: '#10b981', sortOrder: 10, isExpense: false },
  { id: 'ATM', label: 'Cash & ATM', icon: 'cash-outline', color: '#f59e0b', sortOrder: 11, isExpense: true },
  { id: 'OTHER', label: 'Other', icon: 'ellipsis-horizontal', color: '#94a3b8', sortOrder: 12, isExpense: true },
];

// ─── Irish Merchants ─────────────────────────────────────────────

interface MerchantSeed {
  name: string;
  rawPatterns: string[];
  defaultCategoryId: string;
  isSubscription: boolean;
}

const MERCHANTS: MerchantSeed[] = [
  // ── Groceries ────────────────────────────────────────────────
  { name: 'Tesco', rawPatterns: ['%TESCO%'], defaultCategoryId: 'GROCERIES', isSubscription: false },
  { name: 'Lidl', rawPatterns: ['%LIDL%'], defaultCategoryId: 'GROCERIES', isSubscription: false },
  { name: 'Aldi', rawPatterns: ['%ALDI%'], defaultCategoryId: 'GROCERIES', isSubscription: false },
  { name: 'Dunnes Stores', rawPatterns: ['%DUNNES%'], defaultCategoryId: 'GROCERIES', isSubscription: false },
  { name: 'SuperValu', rawPatterns: ['%SUPERVALU%', '%SUPER VALU%'], defaultCategoryId: 'GROCERIES', isSubscription: false },
  { name: 'Centra', rawPatterns: ['%CENTRA%'], defaultCategoryId: 'GROCERIES', isSubscription: false },
  { name: 'Spar', rawPatterns: ['%SPAR %'], defaultCategoryId: 'GROCERIES', isSubscription: false },
  { name: 'M&S Food', rawPatterns: ['%MARKS AND SPENCER%', '%M&S FOOD%', '%M & S%'], defaultCategoryId: 'GROCERIES', isSubscription: false },
  { name: 'Fresh', rawPatterns: ['%FRESH THE GOOD%'], defaultCategoryId: 'GROCERIES', isSubscription: false },
  { name: 'Costcutter', rawPatterns: ['%COSTCUTTER%'], defaultCategoryId: 'GROCERIES', isSubscription: false },

  // ── Subscriptions / streaming ────────────────────────────────
  { name: 'Netflix', rawPatterns: ['%NETFLIX%'], defaultCategoryId: 'SUBSCRIPTIONS', isSubscription: true },
  { name: 'Spotify', rawPatterns: ['%SPOTIFY%'], defaultCategoryId: 'SUBSCRIPTIONS', isSubscription: true },
  { name: 'Disney+', rawPatterns: ['%DISNEY PLUS%', '%DISNEY+%', '%DISNEYPLUS%'], defaultCategoryId: 'SUBSCRIPTIONS', isSubscription: true },
  { name: 'Apple', rawPatterns: ['%APPLE.COM%', '%APPLE SERV%', '%ITUNES%'], defaultCategoryId: 'SUBSCRIPTIONS', isSubscription: true },
  { name: 'Google', rawPatterns: ['%GOOGLE *%', '%GOOGLE PLAY%'], defaultCategoryId: 'SUBSCRIPTIONS', isSubscription: true },
  { name: 'Amazon Prime', rawPatterns: ['%AMZN MKTP%', '%AMAZON PRIME%', '%PRIME VIDEO%'], defaultCategoryId: 'SUBSCRIPTIONS', isSubscription: true },
  { name: 'YouTube Premium', rawPatterns: ['%YOUTUBE PREMIUM%', '%YOUTUBE.COM%'], defaultCategoryId: 'SUBSCRIPTIONS', isSubscription: true },
  { name: 'Adobe', rawPatterns: ['%ADOBE%'], defaultCategoryId: 'SUBSCRIPTIONS', isSubscription: true },
  { name: 'Microsoft 365', rawPatterns: ['%MICROSOFT%365%', '%MSBILL%'], defaultCategoryId: 'SUBSCRIPTIONS', isSubscription: true },
  { name: 'ChatGPT', rawPatterns: ['%OPENAI%', '%CHATGPT%'], defaultCategoryId: 'SUBSCRIPTIONS', isSubscription: true },
  { name: 'Now TV', rawPatterns: ['%NOW TV%', '%NOWTV%'], defaultCategoryId: 'SUBSCRIPTIONS', isSubscription: true },

  // ── Transport ────────────────────────────────────────────────
  { name: 'Uber', rawPatterns: ['%UBER%'], defaultCategoryId: 'TRANSPORT', isSubscription: false },
  { name: 'Bolt', rawPatterns: ['%BOLT.EU%', '%BOLT RIDE%'], defaultCategoryId: 'TRANSPORT', isSubscription: false },
  { name: 'Free Now', rawPatterns: ['%FREENOW%', '%FREE NOW%', '%MYTAXI%'], defaultCategoryId: 'TRANSPORT', isSubscription: false },
  { name: 'Dublin Bus', rawPatterns: ['%DUBLIN BUS%', '%DUBLINBUS%'], defaultCategoryId: 'TRANSPORT', isSubscription: false },
  { name: 'Leap Card', rawPatterns: ['%LEAP%'], defaultCategoryId: 'TRANSPORT', isSubscription: false },
  { name: 'Irish Rail', rawPatterns: ['%IRISH RAIL%', '%IRISHRAIL%', '%IARNROD%'], defaultCategoryId: 'TRANSPORT', isSubscription: false },
  { name: 'Luas', rawPatterns: ['%LUAS%'], defaultCategoryId: 'TRANSPORT', isSubscription: false },
  { name: 'Circle K', rawPatterns: ['%CIRCLE K%', '%CIRCLEK%'], defaultCategoryId: 'TRANSPORT', isSubscription: false },
  { name: 'Applegreen', rawPatterns: ['%APPLEGREEN%'], defaultCategoryId: 'TRANSPORT', isSubscription: false },
  { name: 'Topaz', rawPatterns: ['%TOPAZ%'], defaultCategoryId: 'TRANSPORT', isSubscription: false },
  { name: 'Maxol', rawPatterns: ['%MAXOL%'], defaultCategoryId: 'TRANSPORT', isSubscription: false },
  { name: 'Ryanair', rawPatterns: ['%RYANAIR%'], defaultCategoryId: 'TRANSPORT', isSubscription: false },
  { name: 'Aer Lingus', rawPatterns: ['%AER LINGUS%', '%AERLINGUS%'], defaultCategoryId: 'TRANSPORT', isSubscription: false },

  // ── Dining ───────────────────────────────────────────────────
  { name: 'Deliveroo', rawPatterns: ['%DELIVEROO%'], defaultCategoryId: 'DINING', isSubscription: false },
  { name: 'Just Eat', rawPatterns: ['%JUST EAT%', '%JUSTEAT%'], defaultCategoryId: 'DINING', isSubscription: false },
  { name: "McDonald's", rawPatterns: ['%MCDONALDS%', '%MCDONALD%'], defaultCategoryId: 'DINING', isSubscription: false },
  { name: 'Starbucks', rawPatterns: ['%STARBUCKS%'], defaultCategoryId: 'DINING', isSubscription: false },
  { name: 'Costa Coffee', rawPatterns: ['%COSTA COFFEE%', '%COSTA %'], defaultCategoryId: 'DINING', isSubscription: false },
  { name: 'Insomnia', rawPatterns: ['%INSOMNIA%'], defaultCategoryId: 'DINING', isSubscription: false },
  { name: 'Supermacs', rawPatterns: ['%SUPERMAC%'], defaultCategoryId: 'DINING', isSubscription: false },
  { name: 'Apache Pizza', rawPatterns: ['%APACHE%'], defaultCategoryId: 'DINING', isSubscription: false },
  { name: 'Dominos', rawPatterns: ['%DOMINO%'], defaultCategoryId: 'DINING', isSubscription: false },
  { name: 'Subway', rawPatterns: ['%SUBWAY%'], defaultCategoryId: 'DINING', isSubscription: false },
  { name: 'Nando\'s', rawPatterns: ['%NANDOS%', '%NANDO%'], defaultCategoryId: 'DINING', isSubscription: false },
  { name: 'KFC', rawPatterns: ['%KFC%'], defaultCategoryId: 'DINING', isSubscription: false },
  { name: 'Burger King', rawPatterns: ['%BURGER KING%'], defaultCategoryId: 'DINING', isSubscription: false },

  // ── Bills & Utilities ────────────────────────────────────────
  { name: 'Electric Ireland', rawPatterns: ['%ELECTRIC IRELAND%'], defaultCategoryId: 'BILLS', isSubscription: true },
  { name: 'Bord Gáis', rawPatterns: ['%BORD GAIS%', '%BORDGAIS%', '%BORD GAS%'], defaultCategoryId: 'BILLS', isSubscription: true },
  { name: 'SSE Airtricity', rawPatterns: ['%AIRTRICITY%', '%SSE %'], defaultCategoryId: 'BILLS', isSubscription: true },
  { name: 'Energia', rawPatterns: ['%ENERGIA%'], defaultCategoryId: 'BILLS', isSubscription: true },
  { name: 'Virgin Media', rawPatterns: ['%VIRGIN MEDIA%'], defaultCategoryId: 'BILLS', isSubscription: true },
  { name: 'Eir', rawPatterns: ['%EIR %', '%EIRCOM%'], defaultCategoryId: 'BILLS', isSubscription: true },
  { name: 'Three Ireland', rawPatterns: ['%THREE IRELAND%', '%3IRELAND%', '%THREE.IE%'], defaultCategoryId: 'BILLS', isSubscription: true },
  { name: 'Vodafone', rawPatterns: ['%VODAFONE%'], defaultCategoryId: 'BILLS', isSubscription: true },
  { name: 'Sky Ireland', rawPatterns: ['%SKY IRELAND%', '%SKY.COM%'], defaultCategoryId: 'BILLS', isSubscription: true },
  { name: 'Irish Water', rawPatterns: ['%IRISH WATER%'], defaultCategoryId: 'BILLS', isSubscription: true },
  { name: 'Revenue', rawPatterns: ['%REVENUE.IE%', '%REVENUE COMM%'], defaultCategoryId: 'BILLS', isSubscription: false },
  { name: 'Property Tax', rawPatterns: ['%LPT%', '%PROPERTY TAX%'], defaultCategoryId: 'BILLS', isSubscription: false },

  // ── Health ───────────────────────────────────────────────────
  { name: 'VHI', rawPatterns: ['%VHI%'], defaultCategoryId: 'HEALTH', isSubscription: true },
  { name: 'Laya Healthcare', rawPatterns: ['%LAYA%'], defaultCategoryId: 'HEALTH', isSubscription: true },
  { name: 'Irish Life Health', rawPatterns: ['%IRISH LIFE%'], defaultCategoryId: 'HEALTH', isSubscription: true },
  { name: 'Boots', rawPatterns: ['%BOOTS %', '%BOOTS PHARMACY%'], defaultCategoryId: 'HEALTH', isSubscription: false },
  { name: 'Gym+Coffee', rawPatterns: ['%GYM+COFFEE%', '%GYM COFFEE%'], defaultCategoryId: 'HEALTH', isSubscription: false },
  { name: 'Flyefit', rawPatterns: ['%FLYEFIT%'], defaultCategoryId: 'HEALTH', isSubscription: true },
  { name: 'Ben Dunne Gym', rawPatterns: ['%BEN DUNNE%'], defaultCategoryId: 'HEALTH', isSubscription: true },

  // ── Shopping ─────────────────────────────────────────────────
  { name: 'Penneys', rawPatterns: ['%PENNEYS%', '%PRIMARK%'], defaultCategoryId: 'SHOPPING', isSubscription: false },
  { name: 'Zara', rawPatterns: ['%ZARA %'], defaultCategoryId: 'SHOPPING', isSubscription: false },
  { name: 'H&M', rawPatterns: ['%H&M%', '%H & M%'], defaultCategoryId: 'SHOPPING', isSubscription: false },
  { name: 'Amazon', rawPatterns: ['%AMAZON.%', '%AMZN%'], defaultCategoryId: 'SHOPPING', isSubscription: false },
  { name: 'IKEA', rawPatterns: ['%IKEA%'], defaultCategoryId: 'SHOPPING', isSubscription: false },
  { name: 'Argos', rawPatterns: ['%ARGOS%'], defaultCategoryId: 'SHOPPING', isSubscription: false },
  { name: 'Currys', rawPatterns: ['%CURRYS%', '%CURRY%PC%'], defaultCategoryId: 'SHOPPING', isSubscription: false },
  { name: 'Harvey Norman', rawPatterns: ['%HARVEY NORMAN%'], defaultCategoryId: 'SHOPPING', isSubscription: false },
  { name: 'Brown Thomas', rawPatterns: ['%BROWN THOMAS%'], defaultCategoryId: 'SHOPPING', isSubscription: false },
  { name: 'Arnotts', rawPatterns: ['%ARNOTTS%'], defaultCategoryId: 'SHOPPING', isSubscription: false },

  // ── Entertainment ────────────────────────────────────────────
  { name: 'Cineworld', rawPatterns: ['%CINEWORLD%'], defaultCategoryId: 'ENTERTAINMENT', isSubscription: false },
  { name: 'Omniplex', rawPatterns: ['%OMNIPLEX%'], defaultCategoryId: 'ENTERTAINMENT', isSubscription: false },
  { name: 'Ticketmaster', rawPatterns: ['%TICKETMASTER%'], defaultCategoryId: 'ENTERTAINMENT', isSubscription: false },
  { name: 'Steam', rawPatterns: ['%STEAM%', '%STEAMPOWERED%'], defaultCategoryId: 'ENTERTAINMENT', isSubscription: false },
  { name: 'PlayStation', rawPatterns: ['%PLAYSTATION%', '%PSN%'], defaultCategoryId: 'ENTERTAINMENT', isSubscription: false },
  { name: 'Xbox', rawPatterns: ['%XBOX%', '%MICROSOFT XBOX%'], defaultCategoryId: 'ENTERTAINMENT', isSubscription: false },
  { name: 'Nintendo', rawPatterns: ['%NINTENDO%'], defaultCategoryId: 'ENTERTAINMENT', isSubscription: false },
];

// ─── Institutions (Irish banks available via TrueLayer) ──────────

const INSTITUTIONS = [
  { id: 'ie-ob-aib', name: 'AIB', country: 'IE', logoUrl: null, isAvailable: true },
  { id: 'ie-ob-boi', name: 'Bank of Ireland', country: 'IE', logoUrl: null, isAvailable: true },
  { id: 'ie-ob-ptsb', name: 'Permanent TSB', country: 'IE', logoUrl: null, isAvailable: true },
];

// ─── Seed function ───────────────────────────────────────────────

async function main() {
  console.log('Seeding categories...');
  for (const cat of CATEGORIES) {
    await prisma.category.upsert({
      where: { id: cat.id },
      create: cat,
      update: cat,
    });
  }
  console.log(`  ${CATEGORIES.length} categories seeded`);

  console.log('Seeding institutions...');
  for (const inst of INSTITUTIONS) {
    await prisma.institution.upsert({
      where: { id: inst.id },
      create: inst,
      update: inst,
    });
  }
  console.log(`  ${INSTITUTIONS.length} institutions seeded`);

  console.log('Seeding merchants...');
  for (const m of MERCHANTS) {
    // Use name as a stable lookup (not ideal but sufficient for seed)
    const existing = await prisma.merchant.findFirst({
      where: { name: m.name },
    });

    if (existing) {
      await prisma.merchant.update({
        where: { id: existing.id },
        data: {
          rawPatterns: m.rawPatterns,
          defaultCategoryId: m.defaultCategoryId,
          isSubscription: m.isSubscription,
        },
      });
    } else {
      await prisma.merchant.create({
        data: {
          name: m.name,
          rawPatterns: m.rawPatterns,
          defaultCategoryId: m.defaultCategoryId,
          isSubscription: m.isSubscription,
        },
      });
    }
  }
  console.log(`  ${MERCHANTS.length} merchants seeded`);

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
