import { dialog } from 'electron';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { NibPluginContext, NibPluginModule } from '@nib/plugin-api';
import {
  noteToMarkdownFile,
  notesToJson,
  parseMarkdownFile,
  parseNotesJson,
  slugify,
} from './markdown-io';

import { MODULE_ID, NOTE_TYPE } from './shared';

export { MODULE_ID, NOTE_TYPE };

async function exportMarkdown(ctx: NibPluginContext): Promise<void> {
  const picked = await dialog.showOpenDialog({
    title: 'Export notes as Markdown into…',
    properties: ['openDirectory', 'createDirectory'],
  });
  const directory = picked.filePaths[0];
  if (picked.canceled || !directory) return;

  const notes = ctx.records.list({ type: NOTE_TYPE, limit: 10_000 });
  const usedNames = new Set<string>();
  for (const note of notes) {
    let name = slugify(note.title);
    if (usedNames.has(name)) name = `${name}-${note.id.slice(-8)}`;
    usedNames.add(name);
    await writeFile(join(directory, `${name}.md`), noteToMarkdownFile(note), 'utf8');
  }
  ctx.log.info(`exported ${notes.length} notes to ${directory}`);
}

async function exportJson(ctx: NibPluginContext): Promise<void> {
  const picked = await dialog.showSaveDialog({
    title: 'Export notes as JSON',
    defaultPath: 'nib-notes.json',
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (picked.canceled || !picked.filePath) return;
  const notes = ctx.records.list({ type: NOTE_TYPE, limit: 10_000 });
  await writeFile(picked.filePath, notesToJson(notes), 'utf8');
  ctx.log.info(`exported ${notes.length} notes to ${picked.filePath}`);
}

async function importJson(ctx: NibPluginContext): Promise<void> {
  const picked = await dialog.showOpenDialog({
    title: 'Import notes from JSON export',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile'],
  });
  const file = picked.filePaths[0];
  if (picked.canceled || !file) return;

  const notes = parseNotesJson(await readFile(file, 'utf8'));
  for (const note of notes) {
    ctx.records.create({
      type: NOTE_TYPE,
      title: note.title,
      bodyMd: note.bodyMd,
      tags: note.tags,
      props: {
        ...note.props,
        imported: { originalId: note.id, createdAt: note.createdAt, updatedAt: note.updatedAt },
      },
    });
  }
  ctx.log.info(`imported ${notes.length} notes from ${file}`);
}

async function importMarkdown(ctx: NibPluginContext): Promise<void> {
  const picked = await dialog.showOpenDialog({
    title: 'Import all .md files from a folder',
    properties: ['openDirectory'],
  });
  const directory = picked.filePaths[0];
  if (picked.canceled || !directory) return;

  const entries = await readdir(directory, { withFileTypes: true });
  let count = 0;
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.md')) continue;
    const parsed = parseMarkdownFile(await readFile(join(directory, entry.name), 'utf8'));
    ctx.records.create({
      type: NOTE_TYPE,
      title: parsed.title || entry.name.replace(/\.md$/i, ''),
      bodyMd: parsed.bodyMd,
      tags: parsed.tags,
      props: {
        imported: { file: entry.name, createdAt: parsed.createdAt, updatedAt: parsed.updatedAt },
      },
    });
    count += 1;
  }
  ctx.log.info(`imported ${count} notes from ${directory}`);
}

const notepadPlugin: NibPluginModule = {
  manifest: {
    id: MODULE_ID,
    name: 'Notepad',
    version: '0.1.0',
    minAppVersion: '0.1.0',
    description: 'Markdown notes with tabs, version history, and export/import.',
    permissions: [`records:read:${NOTE_TYPE}`, `records:write:${NOTE_TYPE}`],
    contributes: {
      recordTypes: [{ type: NOTE_TYPE, title: 'Note' }],
      commands: [
        { id: 'new-note', title: 'New note' },
        { id: 'export-markdown', title: 'Export notes as Markdown folder' },
        { id: 'export-json', title: 'Export notes as JSON' },
        { id: 'import-markdown', title: 'Import Markdown folder' },
        { id: 'import-json', title: 'Import notes from JSON' },
      ],
    },
  },

  activate(ctx) {
    ctx.commands.register({
      id: 'new-note',
      title: 'New note',
      category: 'Notepad',
      run() {
        const note = ctx.records.create({ type: NOTE_TYPE, title: '', bodyMd: '' });
        ctx.log.info(`created note ${note.id}`);
      },
    });
    ctx.commands.register({
      id: 'export-markdown',
      title: 'Export notes as Markdown folder',
      category: 'Notepad',
      run: () => exportMarkdown(ctx),
    });
    ctx.commands.register({
      id: 'export-json',
      title: 'Export notes as JSON',
      category: 'Notepad',
      run: () => exportJson(ctx),
    });
    ctx.commands.register({
      id: 'import-markdown',
      title: 'Import Markdown folder',
      category: 'Notepad',
      run: () => importMarkdown(ctx),
    });
    ctx.commands.register({
      id: 'import-json',
      title: 'Import notes from JSON',
      category: 'Notepad',
      run: () => importJson(ctx),
    });
  },
};

export default notepadPlugin;
