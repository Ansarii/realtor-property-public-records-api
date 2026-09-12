import './logger.js';
import express, { Request, Response } from 'express';
import { Actor } from 'apify';
import { TOOLS, handleToolCall } from './mcp-server.js';
import { scrapeRealtorProperty } from './realtor-scraper.js';
import { scrapeIdealistaProperty } from './idealista-scraper.js';

await Actor.init();

// Standby vs. Batch Duality Handling
if (process.env.APIFY_META_ORIGIN !== 'STANDBY' && process.env.APIFY_IS_AT_HOME) {
  console.log(`[realestate-intel-mcp] Batch run detected (origin: ${process.env.APIFY_META_ORIGIN || 'manual'}).`);

  const input = (await Actor.getInput<any>()) || {};
  const realtorUrls: string[] = input.realtorUrls || [];
  const idealistaUrls: string[] = input.idealistaUrls || [];

  // Initialize residential proxy configuration to prevent Kasada 429 blocks
  let proxyUrl: string | undefined;
  try {
    const proxyConfiguration = await Actor.createProxyConfiguration(input.proxyConfiguration || {
      useApifyProxy: true,
      apifyProxyGroups: ['RESIDENTIAL']
    });
    if (proxyConfiguration) {
      proxyUrl = await proxyConfiguration.newUrl();
    }
  } catch (err: any) {
    console.warn(`[realestate-intel-mcp] Proxy configuration warning: ${err.message}`);
  }

  const results: any[] = [];
  const standbyUrl =
    process.env.ACTOR_STANDBY_URL || 'https://neon-innovation-lab--realestate-intel-mcp.apify.actor';

  // 1. Process Realtor.com URLs if provided
  for (const url of realtorUrls) {
    try {
      console.log(`[realestate-intel-mcp] Batch scraping Realtor.com: ${url}`);
      const data = await scrapeRealtorProperty(url, proxyUrl);
      results.push({ target: 'realtor', url, success: true, data });
      await Actor.pushData(data);
    } catch (err: any) {
      console.error(`[realestate-intel-mcp] Failed to scrape ${url}: ${err.message}`);
      results.push({ target: 'realtor', url, success: false, error: err.message });
    }
  }

  // 2. Process Idealista URLs if provided
  for (const url of idealistaUrls) {
    try {
      console.log(`[realestate-intel-mcp] Batch scraping Idealista: ${url}`);
      const data = await scrapeIdealistaProperty(url, proxyUrl);
      results.push({ target: 'idealista', url, success: true, data });
      await Actor.pushData(data);
    } catch (err: any) {
      console.error(`[realestate-intel-mcp] Failed to scrape ${url}: ${err.message}`);
      results.push({ target: 'idealista', url, success: false, error: err.message });
    }
  }

  // Always push a standby RPC discovery record so the default dataset is NEVER empty
  await Actor.pushData({
    status: 'ready',
    mode: 'standby_ready',
    processedCount: results.length,
    results,
    endpoints: {
      streamableHttp: `${standbyUrl}/mcp`,
      sse: `${standbyUrl}/sse`,
      serverCard: `${standbyUrl}/.well-known/mcp/server-card.json`
    },
    claudeDesktopConfig: {
      mcpServers: {
        'realestate-intel': {
          command: 'npx',
          args: ['-y', 'mcp-remote', `${standbyUrl}/mcp`]
        }
      }
    },
    cursorConfig: {
      mcpServers: {
        'realestate-intel': {
          type: 'streamable-http',
          url: `${standbyUrl}/mcp`
        }
      }
    }
  });

  await Actor.exit({
    statusMessage: `Batch run completed. Processed ${results.length} properties. Standby RPC: ${standbyUrl}/mcp`
  });

  process.exit(0);
}

const app = express();
const PORT =
  process.env.ACTOR_WEB_SERVER_PORT ||
  process.env.APIFY_CONTAINER_PORT ||
  process.env.PORT ||
  8080;

app.use(express.json({ limit: '10mb' }));

// Permissive CORS for AI agent callers
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, MCP-Method, MCP-Name, x-apify-container-server-readiness-probe'
  );
  next();
});

app.options('*', (_req: Request, res: Response) => {
  res.sendStatus(204);
});

// 0. Apify Readiness Probe & Root Metadata
app.get('/', (req: Request, res: Response) => {
  if (req.headers['x-apify-container-server-readiness-probe']) {
    return res.status(200).send('Readiness probe OK');
  }
  return res.status(200).json({
    name: 'realestate-intel-mcp',
    title: 'Real Estate Intelligence & Public Records MCP Server',
    version: '1.0.0',
    description:
      'High-defense real estate intelligence for AI agents. Extracts Realtor.com Next.js hydration data, county tax assessments, price cut history, and Idealista gross rental yield comps.',
    endpoints: {
      mcp: '/mcp',
      sse: '/sse',
      health: '/health',
      serverCard: '/.well-known/mcp/server-card.json'
    },
    tools: TOOLS.map(t => t.name),
    pricing: {
      model: 'pay-per-success',
      events: {
        'realtor-intel': '$0.02 / successful property extraction',
        'idealista-intel': '$0.01 / successful property extraction'
      },
      guarantee: 'zero-charge-on-failure'
    }
  });
});

// 1. Health Probe
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'realestate-intel-mcp',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// 2. Server Card & Discovery Manifest
const serverCard = {
  $schema: 'https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json',
  serverInfo: {
    name: 'realestate-intel-mcp',
    title: 'Real Estate Intelligence & Public Records MCP Server',
    version: '1.0.0',
    description:
      'Extracts property specs, multi-year tax assessments, price cut history, and rental yield comps from Realtor.com and Idealista.'
  },
  endpoints: [
    { transport: 'streamable-http', url: '/mcp' },
    { transport: 'sse', url: '/sse' }
  ],
  capabilities: {
    tools: { listChanged: false }
  },
  tools: TOOLS
};

app.get(
  ['/.well-known/mcp/server-card.json', '/.well-known/mcp'],
  (_req: Request, res: Response) => {
    res.json(serverCard);
  }
);

// 3. SSE Transport Endpoint
app.get('/sse', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  res.write('retry: 1000\n');
  res.write(`data: ${JSON.stringify({ endpoint: '/mcp' })}\n\n`);

  const keepAlive = setInterval(() => {
    res.write(':\n\n');
  }, 15000);

  _req.on('close', () => {
    clearInterval(keepAlive);
  });
});

// 4. Streamable HTTP / JSON-RPC Handler
app.post(['/mcp', '/messages', '/message'], async (req: Request, res: Response) => {
  const reqBody = req.body || {};
  const { jsonrpc, id, method, params } = reqBody;

  try {
    // A. Handshake
    if (method === 'initialize') {
      return res.json({
        jsonrpc: '2.0',
        id: id ?? null,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: { listChanged: false }
          },
          serverInfo: serverCard.serverInfo
        }
      });
    }

    if (method === 'notifications/initialized') {
      return res.sendStatus(204);
    }

    if (method === 'ping') {
      return res.json({ jsonrpc: '2.0', id: id ?? null, result: {} });
    }

    // B. tools/list
    if (method === 'tools/list') {
      return res.json({
        jsonrpc: '2.0',
        id: id ?? null,
        result: {
          tools: TOOLS
        }
      });
    }

    // C. tools/call
    if (method === 'tools/call') {
      const toolName = params?.name;
      const toolArgs = params?.arguments || {};
      const toolMeta = params?._meta || reqBody?._meta || {};

      const callResult = await handleToolCall(toolName, toolArgs, toolMeta);

      return res.json({
        jsonrpc: '2.0',
        id: id ?? null,
        result: {
          content: callResult.content,
          isError: callResult.isError || false
        }
      });
    }

    // Unhandled Method
    return res.status(404).json({
      jsonrpc: '2.0',
      id: id ?? null,
      error: {
        code: -32601,
        message: `Method '${method}' not found`
      }
    });
  } catch (err: any) {
    return res.status(500).json({
      jsonrpc: '2.0',
      id: id ?? null,
      error: {
        code: -32603,
        message: `Internal server error: ${err.message}`
      }
    });
  }
});

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`[realestate-intel-mcp] Server running on http://0.0.0.0:${PORT}`);
  console.log(`[realestate-intel-mcp] Standby MCP endpoint: http://0.0.0.0:${PORT}/mcp`);
});
