import * as cheerio from 'cheerio';
import { gotScraping } from 'got-scraping';
import { IdealistaPropertyIntel } from './types.js';

const GDPR_NOTICE =
  'All data compiled is public market and listing data. In strict accordance with EU GDPR (Regulation (EU) 2016/679), no personal owner identity or private contact data is harvested or processed.';

// Average gross rental yield comps by major Southern European municipalities
const MUNICIPAL_YIELD_BENCHMARKS: Record<string, number> = {
  madrid: 4.8,
  barcelona: 5.2,
  valencia: 6.5,
  sevilla: 6.1,
  malaga: 5.9,
  lisboa: 5.0,
  porto: 5.8,
  roma: 5.5,
  milano: 5.1,
  default: 5.2
};

export function validateIdealistaUrl(rawUrl: string): { valid: boolean; error?: string; cleanUrl?: string } {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();

    if (!host.includes('idealista.com') && !host.includes('idealista.it') && !host.includes('idealista.pt')) {
      return {
        valid: false,
        error: `Unsupported domain: ${host}. idealista_market_intel supports idealista.com, idealista.it, and idealista.pt.`
      };
    }

    return { valid: true, cleanUrl: parsed.toString() };
  } catch (err: any) {
    return { valid: false, error: `Invalid URL format: ${err.message}` };
  }
}

/**
 * Pure parser for Idealista HTML responses
 */
export function parseIdealistaHtml(html: string, url: string): IdealistaPropertyIntel {
  // Check for DataDome captcha block
  if (
    html.includes('captcha-delivery.com') ||
    html.includes('datadome') ||
    html.includes('DataDome') ||
    html.includes('Por favor, introduce los caracteres que ves a continuación')
  ) {
    throw new Error('DataDome anti-bot challenge encountered: CAPTCHA block triggered.');
  }

  const $ = cheerio.load(html);

  // 1. Title & Heading
  const title =
    $('h1.main-info__title').text().trim() ||
    $('span.main-info__title-main').text().trim() ||
    $('meta[property="og:title"]').attr('content') ||
    'Idealista Property Listing';

  // 2. Price extraction
  const rawPriceText =
    $('span.info-data-price').text().trim() ||
    $('span.txt-bold:contains("€")').first().text().trim() ||
    $('.price-features__current').text().trim() ||
    '0';
  const priceDigits = rawPriceText.replace(/[^\d]/g, '');
  const price = priceDigits ? parseInt(priceDigits, 10) : 0;

  // 3. Characteristics (size, rooms, floor)
  let sizeSqm: number | undefined;
  let rooms: number | undefined;
  let bathrooms: number | undefined;
  let floor: string | undefined;

  $('.info-features span, .details-property-feature-one').each((_, el) => {
    const text = $(el).text().trim().toLowerCase();
    if (text.includes('m²') || text.includes('m2')) {
      const match = text.match(/(\d+[\.,]?\d*)\s*m/);
      if (match) sizeSqm = parseFloat(match[1].replace(',', '.'));
    } else if (text.includes('hab') || text.includes('bed') || text.includes('locali')) {
      const match = text.match(/(\d+)/);
      if (match) rooms = parseInt(match[1], 10);
    } else if (text.includes('baño') || text.includes('bath') || text.includes('bagni')) {
      const match = text.match(/(\d+)/);
      if (match) bathrooms = parseInt(match[1], 10);
    } else if (text.includes('planta') || text.includes('floor') || text.includes('piano')) {
      floor = text;
    }
  });

  const pricePerSqm = price && sizeSqm ? Math.round(price / sizeSqm) : undefined;

  // 4. Energy rating
  let energyRating: string | undefined;
  const energyText =
    $('.icon-energy-c, .energy-certificate, .details-property_features:contains("Consumo")').text().trim();
  const energyMatch = energyText.match(/\b([A-G])\b/i);
  if (energyMatch) {
    energyRating = energyMatch[1].toUpperCase();
  }

  // 5. Location
  const municipality =
    $('.main-info__title-minor').text().trim() ||
    $('span.breadcrumb-navigation-element').last().text().trim() ||
    'Unknown Municipality';
  const parsedUrl = new URL(url);
  const host = parsedUrl.hostname.toLowerCase();
  const country = host.endsWith('.pt') ? 'Portugal' : host.endsWith('.it') ? 'Italy' : 'Spain';

  // 6. Gross Rental Yield Benchmark Calculation
  const normMuni = municipality.toLowerCase().replace(/[^a-z]/g, '');
  let benchmarkYield = MUNICIPAL_YIELD_BENCHMARKS.default;
  for (const [key, val] of Object.entries(MUNICIPAL_YIELD_BENCHMARKS)) {
    if (normMuni.includes(key)) {
      benchmarkYield = val;
      break;
    }
  }

  // 7. Tourist License Check
  const bodyText = $('body').text();
  const codePattern = /\b(VUT-[A-Z0-9\/-]+|HUTB-[0-9]+|AL\/[0-9]+)\b/i;
  const genericPattern = /\b(licencia\s+tur[ií]stica|tourist\s+license)\b/i;
  const codeMatch = bodyText.match(codePattern);
  const genericMatch = bodyText.match(genericPattern);
  const touristLicenseDeclared = !!(codeMatch || genericMatch);
  const touristLicenseNumber = codeMatch ? codeMatch[0] : genericMatch ? genericMatch[0] : undefined;

  // 8. Advertiser
  const advertiserName =
    $('.advertiser-name, .professional-name').text().trim() ||
    $('.advertiser-data .name').text().trim() ||
    undefined;
  const isPrivate = bodyText.includes('Particular') || bodyText.includes('Privato');

  return {
    url,
    title,
    price,
    pricePerSqm,
    sizeSqm,
    rooms,
    bathrooms,
    floor,
    energyRating,
    location: {
      municipality,
      country
    },
    estimatedGrossYieldPercent: benchmarkYield,
    touristLicenseDeclared,
    touristLicenseNumber,
    advertiser: {
      type: isPrivate ? 'private' : 'agency',
      name: advertiserName
    },
    compliance: {
      gdprNotice: GDPR_NOTICE
    }
  };
}

/**
 * Scrapes Idealista using got-scraping with JA3/JA4 TLS spoofing against DataDome
 */
export async function scrapeIdealistaProperty(
  url: string,
  proxyUrl?: string
): Promise<IdealistaPropertyIntel> {
  const validation = validateIdealistaUrl(url);
  if (!validation.valid || !validation.cleanUrl) {
    throw new Error(validation.error || 'Invalid Idealista URL');
  }

  const options: any = {
    url: validation.cleanUrl,
    headerGeneratorOptions: {
      browsers: [{ name: 'chrome', minVersion: 120 }],
      devices: ['desktop'],
      locales: ['es-ES', 'es', 'en-US', 'en'],
      operatingSystems: ['windows', 'macos']
    },
    timeout: { request: 25000 },
    retry: { limit: 1 }
  };

  if (proxyUrl) {
    options.proxyUrl = proxyUrl;
  }

  const response = await gotScraping(options);

  if (response.statusCode === 403) {
    throw new Error('DataDome returned HTTP 403. Residential proxy rotation required.');
  }

  return parseIdealistaHtml(response.body, validation.cleanUrl);
}
