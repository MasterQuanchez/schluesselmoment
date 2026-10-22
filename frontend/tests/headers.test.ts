/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function cspFromHeaders(text: string): string {
  const match = /Content-Security-Policy:\s*(.+)/.exec(text);
  if (!match?.[1]) throw new Error('CSP fehlt in public/_headers');
  return match[1].trim();
}

function cspFromVercel(text: string): string {
  const json = JSON.parse(text) as {
    headers: Array<{ headers: Array<{ key: string; value: string }> }>;
  };
  for (const group of json.headers) {
    const csp = group.headers.find((header) => header.key === 'Content-Security-Policy');
    if (csp) return csp.value;
  }
  throw new Error('CSP fehlt in vercel.json');
}

describe('security headers', () => {
  it('CSP in _headers and vercel.json is identical', () => {
    const headers = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8');
    const vercel = readFileSync(new URL('../vercel.json', import.meta.url), 'utf8');
    expect(cspFromVercel(vercel)).toBe(cspFromHeaders(headers));
  });
});
