import StarterKit from '@tiptap/starter-kit';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Link } from '@tiptap/extension-link';
import { Markdown } from '@tiptap/markdown';
import type { Extensions } from '@tiptap/core';

/**
 * The constrained extension set that keeps Markdown round-tripping lossless:
 * everything here has an exact Markdown representation the `@tiptap/markdown`
 * serializer understands. Highlight is deliberately excluded — the serializer
 * has no `==x==` support, so including it would break the "Markdown is the
 * source of truth" guarantee.
 */
export function editorExtensions(): Extensions {
  return [
    StarterKit.configure({ underline: false, link: false }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Link.configure({ openOnClick: false, autolink: true }),
    Markdown,
  ];
}
