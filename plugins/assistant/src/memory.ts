import type { NibPluginContext, NibRecord } from '@nib/plugin-api';
import { FACT_TYPE } from './shared';

/**
 * Facts are ordinary records of type "ai-fact" in the shared data layer:
 * the memory inspector is a records list, deletion is softDelete, keyword
 * recall is FTS — and the permission system governs access like anything
 * else. Vector recall can slot in later behind recallFacts.
 */

export const EXTRACTION_PROMPT =
  'You extract durable facts about the user from a conversation. Reply with ONLY a JSON ' +
  'array of at most 3 short strings, each a standalone fact worth remembering long-term ' +
  '(preferences, people, projects, recurring context). Reply [] if nothing qualifies.';

export function parseFacts(raw: string): string[] {
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start === -1 || end <= start) return [];
  try {
    const parsed: unknown = JSON.parse(raw.slice(start, end + 1));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((fact): fact is string => typeof fact === 'string' && fact.trim().length > 3)
      .map((fact) => fact.trim())
      .slice(0, 3);
  } catch {
    return [];
  }
}

export function rememberFact(
  ctx: NibPluginContext,
  fact: string,
  source: string,
): NibRecord | undefined {
  const existing = ctx.records.list({ type: FACT_TYPE, limit: 1000 });
  if (existing.some((record) => record.title.toLowerCase() === fact.toLowerCase())) {
    return undefined;
  }
  return ctx.records.create({ type: FACT_TYPE, title: fact, props: { source } });
}

/** Keyword recall via FTS, padded with the most recent facts up to `limit`. */
export function recallFacts(ctx: NibPluginContext, query: string, limit = 5): NibRecord[] {
  const hits = ctx.records.search(query, { types: [FACT_TYPE], limit });
  const facts = hits.map((hit) => hit.record);
  if (facts.length < limit) {
    for (const record of ctx.records.list({ type: FACT_TYPE, limit })) {
      if (facts.length >= limit) break;
      if (!facts.some((fact) => fact.id === record.id)) facts.push(record);
    }
  }
  return facts;
}
