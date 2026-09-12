import * as cheerio from 'cheerio';
import { chromium, Browser, BrowserContext } from 'playwright';
import {
  RealtorPropertyIntel,
  RealtorTaxRecord,
  RealtorPriceEvent,
  RealtorSchool
} from './types.js';

const FCRA_DISCLAIMER =
  'This data is compiled strictly from public records and is NOT a consumer report. Under the Fair Credit Reporting Act (15 U.S.C. § 1681 et seq.), this information must NOT be used to determine eligibility for credit, insurance, employment, tenant screening, or any other FCRA permissible purpose.';

/**
 * Validates target URL and cleanly rejects unsupported domains (like Zillow)
 */
export function validateRealtorUrl(rawUrl: string): { valid: boolean; error?: string; cleanUrl?: string } {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();

    if (host.includes('zillow.com')) {
      return {
        valid: false,
        error:
          'Zillow is protected by PerimeterX/HUMAN behavioral keystroke dynamics and is not supported in Phase 1. Please provide a Realtor.com property URL (e.g. https://www.realtor.com/realestateandhomes-detail/...).'
      };
    }

    if (!host.includes('realtor.com')) {
      return {
        valid: false,
        error: `Unsupported domain: ${host}. realtor_property_intel supports https://www.realtor.com listing detail URLs.`
      };
    }

    if (!parsed.pathname.includes('/realestateandhomes-detail/')) {
      return {
        valid: false,
        error:
          'Invalid Realtor.com path. Expected a property detail URL matching /realestateandhomes-detail/<Address_ID>.'
      };
    }

    return { valid: true, cleanUrl: parsed.toString() };
  } catch (err: any) {
    return { valid: false, error: `Invalid URL format: ${err.message}` };
  }
}

/**
 * Pure parser for Realtor.com HTML hydration payload
 */
export function parseRealtorHtml(html: string, url: string): RealtorPropertyIntel {
  const $ = cheerio.load(html);

  // 1. Locate Next.js hydration payload
  const nextDataScript = $('script#__NEXT_DATA__').html();
  if (!nextDataScript) {
    // Check if Kasada block page was received
    if (html.includes('x-kpsdk') || html.includes('Kasada') || html.includes('Access Denied')) {
      throw new Error('Kasada anti-bot challenge encountered: Proof-of-Work did not complete.');
    }
    throw new Error('No Next.js hydration script (__NEXT_DATA__) found in Realtor.com response.');
  }

  let nextData: any;
  try {
    nextData = JSON.parse(nextDataScript);
  } catch (err: any) {
    throw new Error(`Failed to parse __NEXT_DATA__ JSON: ${err.message}`);
  }

  // 2. Traversal helper to find property detail object in Next.js state
  const props = nextData.props || {};
  const pageProps = props.pageProps || {};
  const rawProperty =
    pageProps.initialReduxState?.propertyDetails ||
    pageProps.property ||
    pageProps.listing ||
    pageProps.initialState?.property ||
    pageProps.data?.home ||
    {};

  // 3. Address extraction
  const rawAddr = rawProperty.address || rawProperty.location?.address || {};
  const address = {
    street: rawAddr.line || rawAddr.street_name || rawAddr.street_address || '',
    city: rawAddr.city || '',
    state: rawAddr.state_code || rawAddr.state || '',
    zip: rawAddr.postal_code || rawAddr.zip || '',
    county: rawAddr.county || rawProperty.county || undefined
  };

  // 4. Listing specs
  const price = rawProperty.list_price || rawProperty.price || rawProperty.community?.price_max || 0;
  const beds = rawProperty.description?.beds || rawProperty.beds || undefined;
  const baths =
    rawProperty.description?.baths ||
    rawProperty.baths ||
    rawProperty.description?.baths_full ||
    undefined;
  const sqft = rawProperty.description?.sqft || rawProperty.sqft || undefined;
  const lotSqft =
    rawProperty.description?.lot_sqft || rawProperty.lot_sqft || rawProperty.lot_size || undefined;
  const yearBuilt = rawProperty.description?.year_built || rawProperty.year_built || undefined;
  const propertyType = rawProperty.description?.type || rawProperty.prop_type || undefined;
  const daysOnMarket = rawProperty.days_on_market || rawProperty.list_date_duration || undefined;
  const hoaFeeMonthly = rawProperty.hoa?.fee || rawProperty.hoa_fee || undefined;
  const pricePerSqft = price && sqft ? Math.round(price / sqft) : undefined;

  // 5. Public records & tax assessment
  const rawAssessment = rawProperty.assessment || rawProperty.tax_assessment || {};
  const taxAssessment = {
    totalValue: rawAssessment.total || rawAssessment.assessed_value || undefined,
    landValue: rawAssessment.land || undefined,
    improvementValue: rawAssessment.building || rawAssessment.improvements || undefined,
    assessmentYear: rawAssessment.year || undefined,
    parcelId: rawProperty.parcel_number || rawProperty.apn || undefined
  };

  // 6. Tax history
  const taxHistory: RealtorTaxRecord[] = [];
  const rawTaxHistory =
    rawProperty.tax_history ||
    rawProperty.property_history?.tax ||
    rawProperty.history?.tax ||
    [];
  if (Array.isArray(rawTaxHistory)) {
    for (const record of rawTaxHistory) {
      if (record.year && (record.tax !== undefined || record.amount !== undefined)) {
        taxHistory.push({
          year: Number(record.year),
          tax: Number(record.tax ?? record.amount ?? 0),
          assessment: record.assessment ? Number(record.assessment) : undefined
        });
      }
    }
  }

  // 7. Price event history
  const priceHistory: RealtorPriceEvent[] = [];
  const rawHistory =
    rawProperty.property_history ||
    rawProperty.price_history ||
    rawProperty.history?.price ||
    [];
  if (Array.isArray(rawHistory)) {
    for (const event of rawHistory) {
      if (event.event_name || event.event || event.price) {
        priceHistory.push({
          date: String(event.date || event.event_date || ''),
          event: String(event.event_name || event.event || 'Price Change'),
          price: Number(event.price || 0),
          priceChangePercent: event.price_change_percent ? Number(event.price_change_percent) : undefined
        });
      }
    }
  }

  // 8. Schools
  const schools: RealtorSchool[] = [];
  const rawSchools =
    rawProperty.schools ||
    rawProperty.nearby_schools?.schools ||
    rawProperty.community?.schools ||
    [];
  if (Array.isArray(rawSchools)) {
    for (const school of rawSchools) {
      if (school.name) {
        schools.push({
          name: String(school.name),
          rating: school.rating ? Number(school.rating) : undefined,
          grades: school.grades ? String(school.grades) : undefined,
          distanceMiles: school.distance_in_miles ? Number(school.distance_in_miles) : undefined,
          type: school.education_levels?.[0] || school.funding_type || undefined
        });
      }
    }
  }

  // 9. Listing agent & brokerage
  const rawAdvertiser =
    rawProperty.advertisers?.[0] ||
    rawProperty.branding?.[0] ||
    rawProperty.agent ||
    {};
  const listingAgent = {
    name: rawAdvertiser.name || rawProperty.agent_name || undefined,
    brokerage: rawAdvertiser.office?.name || rawProperty.broker_name || undefined,
    mlsId: rawProperty.mls?.id || rawProperty.listing_id || undefined
  };

  return {
    url,
    address,
    price,
    pricePerSqft,
    beds,
    baths,
    sqft,
    lotSqft,
    yearBuilt,
    propertyType,
    daysOnMarket,
    hoaFeeMonthly,
    taxAssessment,
    taxHistory,
    priceHistory,
    schools,
    listingAgent,
    compliance: {
      isConsumerReport: false,
      disclaimer: FCRA_DISCLAIMER
    }
  };
}

/**
 * Scrapes Realtor.com using Playwright Stealth to complete Kasada Proof-of-Work
 */
export async function scrapeRealtorProperty(
  url: string,
  proxyUrl?: string
): Promise<RealtorPropertyIntel> {
  const validation = validateRealtorUrl(url);
  if (!validation.valid || !validation.cleanUrl) {
    throw new Error(validation.error || 'Invalid Realtor.com URL');
  }

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;

  try {
    const launchOptions: any = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--window-size=1920,1080'
      ]
    };

    if (proxyUrl) {
      launchOptions.proxy = { server: proxyUrl };
    }

    browser = await chromium.launch(launchOptions);
    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      locale: 'en-US',
      timezoneId: 'America/New_York'
    });

    const page = await context.newPage();

    // Mask webdriver flag
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    // Navigate to listing detail page
    const response = await page.goto(validation.cleanUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    if (!response) {
      throw new Error('Navigation failed: No HTTP response received.');
    }

    const status = response.status();
    if (status === 403 || status === 429) {
      throw new Error(`Kasada blocked request with HTTP ${status}. Anti-bot Proof-of-Work failed.`);
    }

    // Wait briefly for Next.js hydration payload
    await page.waitForSelector('script#__NEXT_DATA__', { timeout: 10000 }).catch(() => null);

    const html = await page.content();
    return parseRealtorHtml(html, validation.cleanUrl);
  } finally {
    if (context) await context.close().catch(() => null);
    if (browser) await browser.close().catch(() => null);
  }
}
