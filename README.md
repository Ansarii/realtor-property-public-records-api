# Real Estate Intelligence & Public Records MCP Server (`realestate-intel-mcp`)

[![Run on Apify](https://apify.com/actor-badge?actor=neon_innovation_lab/realestate-intel-mcp)](https://apify.com/neon_innovation_lab/realestate-intel-mcp)

⚡ **Run directly on the cloud (Zero setup, residential proxy included)**: [Apify Store: Realtor Property & Public Records API](https://apify.com/neon_innovation_lab/realestate-intel-mcp)

> High-defense real estate intelligence and public records extraction for AI agents (Claude Desktop, Cursor, Windsurf) and automated proptech pipelines.
>
> *Disclaimer: This Actor is an independent developer tool and is not affiliated with, authorized, maintained, or sponsored by Realtor.com, Move, Inc., the National Association of Realtors (NAR), or Idealista.*

## Overview

Unlike standard brittle scrapers, **`realestate-intel-mcp`** is engineered to navigate enterprise-grade anti-bot defenses across the world's leading real estate portals:

1. **Realtor.com (Kasada-Aware)**: Extracts the Next.js `<script id="__NEXT_DATA__">` hydration state to capture deep property intelligence, county property tax assessments, multi-year historical tax payments, price drops, GreatSchools ratings, and verified MLS agent contacts.
2. **Idealista (DataDome-Resilient)**: Targets the dominant real estate portal across Spain, Italy, and Portugal using TLS/JA4 fingerprinting to extract asking prices, size in square meters, energy ratings, estimated gross rental yields, and municipal tourist rental license compliance.

---

## Tools

### 1. `realtor_property_intel`
Extracts structured property and public records intelligence from any Realtor.com property detail page.

**Parameters**:
- `url` *(string, required)*: The Realtor.com property detail URL (e.g. `https://www.realtor.com/realestateandhomes-detail/...`).

**Extracted Output**:
- **Listing Details**: Address, list price, price/sqft, beds, baths, square footage, lot size, year built, property type, days on market, HOA fees.
- **County Tax Assessments**: Total assessed value, land value, improvement value, assessment year, parcel ID (APN).
- **Multi-Year Tax History**: Array of historical tax payments and assessed amounts.
- **Price Cut History**: Event log of price reductions and delistings (identifying motivated sellers).
- **GreatSchools Data**: School names, verified ratings, grades, and distance.
- **Agent Attribution**: Listing agent name, brokerage office, and MLS ID.
- **FCRA Safe-Harbor Metadata**: Structured disclaimer confirming public records non-consumer report status.

### 2. `idealista_market_intel`
Extracts property metrics, gross rental yield benchmarks, and holiday rental license compliance across Spain, Italy, and Portugal.

**Parameters**:
- `url` *(string, required)*: The Idealista property listing URL (e.g. `https://www.idealista.com/inmueble/...`).

**Extracted Output**:
- **Property Specs**: Price, price/m², size (m²), rooms, bathrooms, floor, and energy efficiency certification (A–G).
- **Estimated Gross Yield**: Municipal benchmark rental yield comparison.
- **Tourist License Status**: Flags declared holiday rental license numbers (`VUT-`, `HUTB-`, `AL/`).
- **Advertiser**: Professional real estate agency vs. private seller.
- **EU GDPR Notice**: Confirms 100% public market data processing without non-consensual personal tracking.

---

## Monetization & Pricing Guarantee

- **`realtor-intel`**: **$0.02** per successful property extraction.
- **`idealista-intel`**: **$0.01** per successful property extraction.
- **Zero Charge on Failure**: If a target platform blocks the request or extraction fails, **you are never billed** ($0.00).

---

## AI Agent Integration

### Claude Desktop (`claude_desktop_config.json`)
```json
{
  "mcpServers": {
    "realestate-intel": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://neon-innovation-lab--realestate-intel-mcp.apify.actor/mcp"]
    }
  }
}
```

### Cursor (`.cursor/mcp.json`)
```json
{
  "mcpServers": {
    "realestate-intel": {
      "type": "streamable-http",
      "url": "https://neon-innovation-lab--realestate-intel-mcp.apify.actor/mcp"
    }
  }
}
```
