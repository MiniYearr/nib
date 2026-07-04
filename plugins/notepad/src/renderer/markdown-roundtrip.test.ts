// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import { editorExtensions } from './markdown';

// ProseMirror's EditorView reads layout APIs jsdom doesn't implement.
if (typeof Range !== 'undefined') {
  Range.prototype.getBoundingClientRect ??= () =>
    ({ x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }) as DOMRect;
  Range.prototype.getClientRects ??= () => {
    const list = [] as unknown as DOMRectList;
    return list;
  };
}
document.elementFromPoint ??= () => null;

function toCanonical(markdown: string): string {
  const editor = new Editor({
    element: document.createElement('div'),
    extensions: editorExtensions(),
    content: markdown,
    contentType: 'markdown',
  });
  const result = editor.getMarkdown();
  editor.destroy();
  return result;
}

/**
 * The property the Rich ⇄ Source toggle depends on: the first parse/serialize
 * may normalize formatting (bullet chars, emphasis style), but from then on
 * every further round trip must be byte-identical — otherwise toggling views
 * would keep rewriting the note.
 */
function expectStable(markdown: string): string {
  const canonical = toCanonical(markdown);
  expect(toCanonical(canonical)).toBe(canonical);
  return canonical;
}

describe('markdown round trip through the rich editor', () => {
  it('headings and paragraphs', () => {
    const canonical = expectStable('# Title\n\nSome text.\n\n## Section\n\nMore text.');
    expect(canonical).toContain('# Title');
    expect(canonical).toContain('## Section');
    expect(canonical).toContain('Some text.');
  });

  it('emphasis, strikethrough, and inline code', () => {
    const canonical = expectStable('This is **bold**, *italic*, ~~gone~~, and `code`.');
    expect(canonical).toMatch(/\*\*bold\*\*/);
    expect(canonical).toMatch(/[*_]italic[*_]/);
    expect(canonical).toContain('~~gone~~');
    expect(canonical).toContain('`code`');
  });

  it('bullet and ordered lists including nesting', () => {
    const canonical = expectStable('- one\n- two\n  - two point one\n\n1. first\n2. second');
    expect(canonical).toMatch(/[-*] one/);
    expect(canonical).toMatch(/two point one/);
    expect(canonical).toMatch(/1\. first/);
  });

  it('task lists preserve checked state', () => {
    const canonical = expectStable('- [ ] open task\n- [x] done task');
    expect(canonical).toMatch(/\[ \] open task/);
    expect(canonical).toMatch(/\[x\] done task/);
  });

  it('fenced code blocks keep language and content', () => {
    const canonical = expectStable('```ts\nconst x: number = 1;\n```');
    expect(canonical).toContain('```ts');
    expect(canonical).toContain('const x: number = 1;');
  });

  it('blockquotes and horizontal rules', () => {
    const canonical = expectStable('> quoted wisdom\n\n---\n\nafter the rule');
    expect(canonical).toContain('> quoted wisdom');
    expect(canonical).toMatch(/---|\*\*\*/);
    expect(canonical).toContain('after the rule');
  });

  it('links keep their targets', () => {
    const canonical = expectStable('Visit [the site](https://example.com/a?b=1) today.');
    expect(canonical).toContain('[the site](https://example.com/a?b=1)');
  });

  it('a realistic mixed document is stable', () => {
    const canonical = expectStable(
      [
        '# Plan',
        '',
        'Intro with **bold** and a [link](https://nib.app).',
        '',
        '## Steps',
        '',
        '- [ ] draft the plan',
        '- [x] set up repo',
        '',
        '```json',
        '{ "a": 1 }',
        '```',
        '',
        '> Remember to rest.',
      ].join('\n'),
    );
    expect(canonical).toContain('# Plan');
    expect(canonical).toContain('"a": 1');
  });
});
