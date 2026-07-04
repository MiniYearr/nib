import type { NibRecord } from '@nib/plugin-api';

/**
 * Frontmatter values are JSON-encoded (still valid YAML for these shapes), so
 * titles with colons/quotes and tags with commas survive the round trip.
 */
export function noteToMarkdownFile(note: NibRecord): string {
  const lines = [
    '---',
    `title: ${JSON.stringify(note.title)}`,
    `tags: ${JSON.stringify(note.tags)}`,
    `created: ${JSON.stringify(new Date(note.createdAt).toISOString())}`,
    `updated: ${JSON.stringify(new Date(note.updatedAt).toISOString())}`,
    '---',
    '',
  ];
  return lines.join('\n') + note.bodyMd + (note.bodyMd.endsWith('\n') ? '' : '\n');
}

export interface ParsedMarkdownFile {
  title: string;
  tags: string[];
  createdAt?: number;
  updatedAt?: number;
  bodyMd: string;
}

export function parseMarkdownFile(text: string): ParsedMarkdownFile {
  const result: ParsedMarkdownFile = { title: '', tags: [], bodyMd: text };
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!match) return result;

  result.bodyMd = text.slice(match[0].length).replace(/^\r?\n/, '');
  for (const line of match[1]!.split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    const rawValue = line.slice(separator + 1).trim();
    try {
      const value: unknown = JSON.parse(rawValue);
      if (key === 'title' && typeof value === 'string') result.title = value;
      else if (key === 'tags' && Array.isArray(value)) {
        result.tags = value.filter((tag): tag is string => typeof tag === 'string');
      } else if (key === 'created' && typeof value === 'string') {
        result.createdAt = Date.parse(value) || undefined;
      } else if (key === 'updated' && typeof value === 'string') {
        result.updatedAt = Date.parse(value) || undefined;
      }
    } catch {
      // Foreign frontmatter lines (unquoted YAML) are skipped rather than fatal.
    }
  }
  return result;
}

export interface NotesExport {
  app: 'nib';
  kind: 'notes-export';
  version: 1;
  exportedAt: string;
  notes: Pick<
    NibRecord,
    'id' | 'title' | 'bodyMd' | 'props' | 'tags' | 'createdAt' | 'updatedAt'
  >[];
}

export function notesToJson(notes: NibRecord[]): string {
  const payload: NotesExport = {
    app: 'nib',
    kind: 'notes-export',
    version: 1,
    exportedAt: new Date().toISOString(),
    notes: notes.map(({ id, title, bodyMd, props, tags, createdAt, updatedAt }) => ({
      id,
      title,
      bodyMd,
      props,
      tags,
      createdAt,
      updatedAt,
    })),
  };
  return JSON.stringify(payload, null, 2);
}

export function parseNotesJson(text: string): NotesExport['notes'] {
  const parsed: unknown = JSON.parse(text);
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    (parsed as NotesExport).kind !== 'notes-export' ||
    !Array.isArray((parsed as NotesExport).notes)
  ) {
    throw new Error('not a Nib notes export file');
  }
  return (parsed as NotesExport).notes.filter(
    (note) => typeof note.title === 'string' && typeof note.bodyMd === 'string',
  );
}

export function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'untitled'
  );
}
