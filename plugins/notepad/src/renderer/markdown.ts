import StarterKit from '@tiptap/starter-kit';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Markdown } from '@tiptap/markdown';
import type { Extensions } from '@tiptap/core';

/**
 * The constrained extension set that keeps Markdown round-tripping lossless:
 * everything here has an exact Markdown representation. Underline is disabled
 * (no Markdown syntax for it); tables and more arrive only with serializers.
 */
export function editorExtensions(): Extensions {
  return [
    StarterKit.configure({ underline: false }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Markdown,
  ];
}
