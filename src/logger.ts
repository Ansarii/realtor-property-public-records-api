/**
 * Global Log Sanitizer & Choke Point for realestate-intel-mcp
 * Intercepts all stdout/stderr streams to structurally guarantee zero credential leakage.
 */

export function sanitize(input: any): any {
  if (typeof input !== 'string') {
    if (input instanceof Error) {
      input = input.stack || input.message || String(input);
    } else if (typeof input === 'object' && input !== null) {
      try {
        input = JSON.stringify(input);
      } catch {
        input = String(input);
      }
    } else {
      return input;
    }
  }

  let sanitized = input;

  // 1. URL userinfo (e.g. http://groups-RESIDENTIAL,session-123:password@proxy.apify.com:8000)
  sanitized = sanitized.replace(/\/\/[^@\s/]+@/g, '//***:***@');

  // 2. Labeled token / key / credential patterns (case-insensitive)
  sanitized = sanitized.replace(
    /(Bearer\s+|token[:= ]\s*|api[_\-]?key[:= ]\s*|secret[:= ]\s*|pass(word)?[:= ]\s*|credential[:= ]\s*|authorization[:= ]\s*|private[_\-]?key[:= ]\s*|privkey[:= ]\s*)[^\s,;'"}\]]{6,}/gi,
    '$1***'
  );

  // 3. Known vendor token prefixes (OpenAI sk-, Anthropic sk-ant-, Apify apify_api_, AWS AKIA)
  sanitized = sanitized.replace(/sk-[a-zA-Z0-9_\-]{14,}/g, 'sk-***');
  sanitized = sanitized.replace(/sk-ant-[a-zA-Z0-9_\-]{14,}/g, 'sk-ant-***');
  sanitized = sanitized.replace(/apify_api_[a-zA-Z0-9]{14,}/g, 'apify_api_***');
  sanitized = sanitized.replace(/AKIA[0-9A-Z]{16}/g, 'AKIA***');

  // 4. Basic Auth base64 blobs
  sanitized = sanitized.replace(/Basic\s+[A-Za-z0-9+/=]{12,}/gi, 'Basic ***');

  // 5. High-entropy alphanumeric strings (32+ chars), preserving public EVM addresses & tx hashes
  sanitized = sanitized.replace(
    /(^|[\s"'=:,;])([a-zA-Z0-9_\-]{32,})($|[\s"'=:,;])/g,
    (match: string, prefix: string, token: string, suffix: string) => {
      if (/^0x[a-fA-F0-9]{40}$/i.test(token) || /^0x[a-fA-F0-9]{64}$/i.test(token)) {
        return match;
      }
      return `${prefix}***[REDACTED_SECRET]***${suffix}`;
    }
  );

  return sanitized;
}

let installed = false;

export function installGlobalLogSanitizer() {
  if (installed) return;
  installed = true;

  // 1. High-level console interception
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  const originalInfo = console.info;

  console.log = (...args: any[]) => originalLog(...args.map(sanitize));
  console.warn = (...args: any[]) => originalWarn(...args.map(sanitize));
  console.error = (...args: any[]) => originalError(...args.map(sanitize));
  console.info = (...args: any[]) => originalInfo(...args.map(sanitize));

  // 2. Low-level process stream interception
  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  const originalStderrWrite = process.stderr.write.bind(process.stderr);

  process.stdout.write = (chunk: any, encoding?: any, callback?: any): boolean => {
    if (typeof chunk === 'string') {
      chunk = sanitize(chunk);
    } else if (Buffer.isBuffer(chunk)) {
      chunk = Buffer.from(sanitize(chunk.toString('utf-8')), 'utf-8');
    }
    return originalStdoutWrite(chunk, encoding, callback);
  };

  process.stderr.write = (chunk: any, encoding?: any, callback?: any): boolean => {
    if (typeof chunk === 'string') {
      chunk = sanitize(chunk);
    } else if (Buffer.isBuffer(chunk)) {
      chunk = Buffer.from(sanitize(chunk.toString('utf-8')), 'utf-8');
    }
    return originalStderrWrite(chunk, encoding, callback);
  };
}
