import { Actor } from 'apify';
import { scrapeRealtorProperty, validateRealtorUrl } from './realtor-scraper.js';
import { scrapeIdealistaProperty, validateIdealistaUrl } from './idealista-scraper.js';

export const TOOLS = [
  {
    name: 'realtor_property_intel',
    description:
      'Extracts deep property intelligence from Realtor.com listings using Next.js hydration state, including multi-year tax history, county property assessments, historical price cuts, GreatSchools ratings, and verified MLS agent attribution. Strictly pay-per-success ($0.02). Zero charge on failure.',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description:
            'Realtor.com property detail URL (e.g. https://www.realtor.com/realestateandhomes-detail/...)'
        }
      },
      required: ['url']
    }
  },
  {
    name: 'idealista_market_intel',
    description:
      'Extracts property specs, gross rental yield benchmarks, energy efficiency ratings, and tourist rental license compliance from Idealista (Spain, Italy, Portugal) listings. Resilient against DataDome. Strictly pay-per-success ($0.01). Zero charge on failure.',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description:
            'Idealista property URL (e.g. https://www.idealista.com/inmueble/12345678/)'
        }
      },
      required: ['url']
    }
  }
];

let isChargeLimitReached = false;
let totalChargedUsd = 0;

export function resetChargeTracker() {
  isChargeLimitReached = false;
  totalChargedUsd = 0;
}

export function getTotalChargedUsd(): number {
  return totalChargedUsd;
}

export async function handleToolCall(
  toolName: string,
  args: any,
  meta: Record<string, any> = {},
  proxyUrl?: string
): Promise<{
  isError?: boolean;
  content: Array<{ type: 'text'; text: string }>;
}> {
  // 0. Enforce Apify PPE spending limit
  if (isChargeLimitReached) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: 'Spending limit reached (ACTOR_MAX_TOTAL_CHARGE_USD). Run stopped to prevent overcharging.'
          })
        }
      ]
    };
  }

  const maxCharge = Number(process.env.ACTOR_MAX_TOTAL_CHARGE_USD || 100);

  // 1. Route: Realtor.com property intelligence
  if (toolName === 'realtor_property_intel') {
    const rawUrl = args?.url;
    if (!rawUrl) {
      return {
        isError: true,
        content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Missing required argument: url' }) }]
      };
    }

    const validation = validateRealtorUrl(rawUrl);
    if (!validation.valid) {
      return {
        isError: true,
        content: [{ type: 'text', text: JSON.stringify({ success: false, error: validation.error }) }]
      };
    }

    try {
      const data = await scrapeRealtorProperty(validation.cleanUrl!, proxyUrl);

      // Charge ONLY upon verified successful data extraction ($0.02)
      try {
        await Actor.charge({ eventName: 'realtor-intel', count: 1 });
        totalChargedUsd += 0.02;
        if (totalChargedUsd >= maxCharge) isChargeLimitReached = true;
      } catch (err: any) {
        console.warn(`[PPE] Actor.charge skipped or not in Apify environment: ${err.message}`);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true, data }, null, 2)
          }
        ]
      };
    } catch (err: any) {
      // ZERO CHARGE ON FAILURE GUARANTEE: Never bill on Kasada blocks or network errors
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: err.message || 'Failed to extract Realtor.com listing data',
              billed: false,
              notice: 'Zero charge applied due to extraction block or error.'
            })
          }
        ]
      };
    }
  }

  // 2. Route: Idealista market intelligence
  if (toolName === 'idealista_market_intel') {
    const rawUrl = args?.url;
    if (!rawUrl) {
      return {
        isError: true,
        content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Missing required argument: url' }) }]
      };
    }

    const validation = validateIdealistaUrl(rawUrl);
    if (!validation.valid) {
      return {
        isError: true,
        content: [{ type: 'text', text: JSON.stringify({ success: false, error: validation.error }) }]
      };
    }

    try {
      const data = await scrapeIdealistaProperty(validation.cleanUrl!, proxyUrl);

      // Charge ONLY upon verified successful extraction ($0.01)
      try {
        await Actor.charge({ eventName: 'idealista-intel', count: 1 });
        totalChargedUsd += 0.01;
        if (totalChargedUsd >= maxCharge) isChargeLimitReached = true;
      } catch (err: any) {
        console.warn(`[PPE] Actor.charge skipped or not in Apify environment: ${err.message}`);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true, data }, null, 2)
          }
        ]
      };
    } catch (err: any) {
      // ZERO CHARGE ON FAILURE GUARANTEE
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: err.message || 'Failed to extract Idealista listing data',
              billed: false,
              notice: 'Zero charge applied due to extraction block or error.'
            })
          }
        ]
      };
    }
  }

  return {
    isError: true,
    content: [{ type: 'text', text: JSON.stringify({ success: false, error: `Unknown tool: ${toolName}` }) }]
  };
}
