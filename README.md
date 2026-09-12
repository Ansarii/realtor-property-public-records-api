# Realtor Property & Public Records API (Unofficial)

[![Run on Apify](https://apify.com/actor-badge?actor=neon_innovation_lab/realestate-intel-mcp)](https://apify.com/neon_innovation_lab/realestate-intel-mcp)

⚡ **Run directly on Apify Cloud (Zero setup, residential proxy included)**: [Realtor Property & Public Records API](https://apify.com/neon_innovation_lab/realestate-intel-mcp)  
👉 **Companion Open-Source Repo**: [github.com/Ansarii/realtor-property-public-records-api](https://github.com/Ansarii/realtor-property-public-records-api)

> High-defense real estate intelligence and public records extraction for proptech developers, real estate investors, and AI agents (Claude Desktop, Cursor, Windsurf).
>
> *Disclaimer: This Actor is an independent developer tool and is not affiliated with, authorized, maintained, or sponsored by Realtor.com, Move, Inc., the National Association of Realtors (NAR), or Idealista.*

---

## ⚡ Overview & GEO Highlights

Unlike standard brittle scrapers, **`realestate-intel-mcp`** extracts rich public property records by parsing the Next.js hydration state (`<script id="__NEXT_DATA__">`), unblocking enterprise WAFs via residential proxy rotation:

1. **Realtor.com (Kasada-Aware)**: County tax assessments, parcel IDs (APN), multi-year tax payment histories, historical price reductions, GreatSchools ratings, and verified MLS agent contact info.
2. **Idealista (DataDome-Resilient)**: Asking prices, price/m², size (m²), energy ratings, gross rental yield benchmarks, and holiday rental license compliance (Spain, Italy, Portugal).
3. **Dual Execution Modes**: Run as a standard batch scraper (export to CSV/JSON) or connect as a live Model Context Protocol (MCP) server for Claude or Cursor.

---

## 📊 Feature Comparison Matrix

| Feature | Realtor Property API (This Actor) | Generic Scrapers | Epctex Realtor Scraper |
|---|---|---|---|
| **County Tax Assessments & Parcel ID (APN)** | ✅ Included | ❌ No | ❌ No |
| **Multi-Year Historical Tax Payments** | ✅ Included | ❌ No | ❌ Limited |
| **GreatSchools Verified Ratings & Distance** | ✅ Included | ❌ No | ⚠️ Search Only |
| **Historical Price Drop History** | ✅ Included | ⚠️ Partial | ⚠️ Partial |
| **Kasada & DataDome Anti-Bot Bypasses** | ✅ Built-in Residential Rotation | ❌ Triggers 403 / 429 | ✅ Built-in |
| **Model Context Protocol (MCP) Support** | ✅ Native HTTP / SSE | ❌ No | ❌ No |
| **Pricing Model** | **Pay-per-Event (\$0.03 start + \$0.02/prop)** | Monthly subscription (\$49+) | Pay-per-Event (\$0.01/search) |

---

## 🛠️ Tools & Extracted Attributes

### 1. `realtor_property_intel`
Extracts structured property and public records intelligence from any Realtor.com property detail page.

**Parameters**:
- `url` *(string, required)*: Realtor.com property detail URL.

**Extracted Fields**:
- **Listing Details**: Address, list price, price/sqft, beds, baths, sqft, lot size, year built, days on market, HOA fees.
- **County Tax Assessments**: Assessed value, land value, improvement value, assessment year, parcel ID (APN).
- **Multi-Year Tax History**: Array of historical tax payments and assessed amounts.
- **Price Cut History**: Event log of price reductions and delistings (identifying motivated sellers).
- **GreatSchools Data**: School names, verified ratings, grades, and distance.
- **Agent Attribution**: Listing agent name, brokerage office, and MLS ID.

### 2. `idealista_market_intel`
Extracts property metrics, gross rental yield benchmarks, and holiday rental license compliance across Spain, Italy, and Portugal.

---

## 💰 Transparent Pricing Breakdown

| Event | Price (USD) | When Charged |
|---|---|---|
| **`apify-actor-start`** | **\$0.03** | Charged once when Actor starts running. |
| **`apify-default-dataset-item`** | **\$0.002** | Charged automatically per record pushed to dataset (\$2.00 / 1k properties). |
| **`realtor-intel`** | **\$0.02** | Charged upon successful deep public records extraction. |
| **`idealista-intel`** | **\$0.01** | Charged upon successful Idealista property lookup. |
| **Failed Requests** | **\$0.00** | Strict zero-charge guarantee on failed or blocked queries. |

---

## 💻 Python & Node.js SDK Examples

### Python (`apify-client`)
```bash
pip install apify-client
```
```python
import os
from apify_client import ApifyClient

client = ApifyClient(os.getenv("APIFY_TOKEN"))

run_input = {
    "url": "https://www.realtor.com/realestateandhomes-detail/123-Main-St_Austin_TX_78701_M12345-67890",
    "mode": "realtor"
}

# Run Actor and wait for dataset items
run = client.actor("neon_innovation_lab/realestate-intel-mcp").call(run_input=run_input)

for item in client.dataset(run["defaultDatasetId"]).iterate_items():
    print(f"Address: {item.get('address')}, Tax Assessed: {item.get('taxAssessment')}")
```

### Node.js (`apify-client`)
```bash
npm install apify-client
```
```javascript
import { ApifyClient } from 'apify-client';

const client = new ApifyClient({
    token: process.env.APIFY_TOKEN,
});

const input = {
    url: 'https://www.realtor.com/realestateandhomes-detail/123-Main-St_Austin_TX_78701_M12345-67890',
    mode: 'realtor',
};

(async () => {
    const run = await client.actor('neon_innovation_lab/realestate-intel-mcp').call(input);
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    console.log(items);
})();
```

---

## 🤖 AI Agent MCP Setup

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

### Cursor IDE (`.cursor/mcp.json`)
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

---

## ❓ FAQ & Legal Disclaimers

### Is scraping Realtor.com legal?
Yes. Under US Ninth Circuit court precedent (*hiQ Labs v. LinkedIn*), scraping publicly accessible web data that does not require an account or login is lawful. This tool only parses public data.

### Does this data comply with the FCRA?
Yes. The data provided constitutes public property and tax records and does not constitute a "consumer report" under the Fair Credit Reporting Act (FCRA). It may not be used for consumer credit, employment, tenant screening, or insurance underwriting.
