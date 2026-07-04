import { describe, expect, it } from 'vitest';
import type { NibRecord } from '@nib/plugin-api';
import {
  noteToMarkdownFile,
  notesToJson,
  parseMarkdownFile,
  parseNotesJson,
  slugify,
} from './markdown-io';

function note(overrides: Partial<NibRecord> = {}): NibRecord {
  return {
    id: 'id-1',
    type: 'note',
    moduleId: 'nib.notepad',
    title: 'Plain title',
    bodyMd: '# Heading\n\nBody text.\n',
    props: {},
    tags: ['a', 'b'],
    createdAt: 1_720_000_000_000,
    updatedAt: 1_720_000_100_000,
    deletedAt: null,
    ...overrides,
  };
}

describe('markdown file round trip', () => {
  it('preserves title, tags, dates, and body', () => {
    const original = note({ title: 'Tricky: "quoted", with commas', tags: ['x, y', 'plain'] });
    const parsed = parseMarkdownFile(noteToMarkdownFile(original));
    expect(parsed.title).toBe(original.title);
    expect(parsed.tags).toEqual(original.tags);
    expect(parsed.createdAt).toBe(original.createdAt);
    expect(parsed.updatedAt).toBe(original.updatedAt);
    expect(parsed.bodyMd).toBe(original.bodyMd);
  });

  it('treats a file without frontmatter as pure body', () => {
    const parsed = parseMarkdownFile('# Just markdown\n');
    expect(parsed.title).toBe('');
    expect(parsed.bodyMd).toBe('# Just markdown\n');
  });

  it('does not eat a body that starts with a horizontal rule', () => {
    const original = note({ bodyMd: 'intro\n\n---\n\nafter the rule\n' });
    const parsed = parseMarkdownFile(noteToMarkdownFile(original));
    expect(parsed.bodyMd).toBe(original.bodyMd);
  });
});

describe('json export round trip', () => {
  it('exports and re-imports notes', () => {
    const notes = [note(), note({ id: 'id-2', title: 'Second' })];
    const imported = parseNotesJson(notesToJson(notes));
    expect(imported).toHaveLength(2);
    expect(imported[1]!.title).toBe('Second');
    expect(imported[0]!.bodyMd).toBe(notes[0]!.bodyMd);
  });

  it('rejects foreign json', () => {
    expect(() => parseNotesJson('{"some":"thing"}')).toThrow(/not a Nib notes export/);
  });
});

describe('slugify', () => {
  it.each([
    ['Hello World!', 'hello-world'],
    ['  --- ', 'untitled'],
    ['Çok güzel bir not', 'çok-güzel-bir-not'],
  ])('%s -> %s', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });
});
