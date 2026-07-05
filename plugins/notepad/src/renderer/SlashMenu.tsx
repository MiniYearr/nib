import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { Icon } from '@nib/shell';

interface SlashItem {
  icon: string;
  label: string;
  run(editor: Editor, range: { from: number; to: number }): void;
}

const ITEMS: SlashItem[] = [
  { icon: 'heading-1', label: 'Heading 1', run: (e, r) => e.chain().focus().deleteRange(r).toggleHeading({ level: 1 }).run() },
  { icon: 'heading', label: 'Heading 2', run: (e, r) => e.chain().focus().deleteRange(r).toggleHeading({ level: 2 }).run() },
  { icon: 'list', label: 'Bullet list', run: (e, r) => e.chain().focus().deleteRange(r).toggleBulletList().run() },
  { icon: 'list-ordered', label: 'Numbered list', run: (e, r) => e.chain().focus().deleteRange(r).toggleOrderedList().run() },
  { icon: 'list-checks', label: 'Task list', run: (e, r) => e.chain().focus().deleteRange(r).toggleTaskList().run() },
  { icon: 'quote', label: 'Quote', run: (e, r) => e.chain().focus().deleteRange(r).toggleBlockquote().run() },
  { icon: 'code', label: 'Code block', run: (e, r) => e.chain().focus().deleteRange(r).toggleCodeBlock().run() },
];

interface SlashState {
  query: string;
  range: { from: number; to: number };
  coords: { left: number; top: number };
}

/**
 * A caret-anchored "/" command menu implemented on top of editor transactions
 * (no suggestion plugin / tippy, which keeps it CSP-clean and self-contained).
 */
export function SlashMenu({ editor }: { editor: Editor }) {
  const [state, setState] = useState<SlashState | null>(null);
  const [index, setIndex] = useState(0);
  const stateRef = useRef<SlashState | null>(null);
  const indexRef = useRef(0);
  stateRef.current = state;
  indexRef.current = index;

  const filtered = state
    ? ITEMS.filter((item) => item.label.toLowerCase().includes(state.query.toLowerCase()))
    : [];
  const filteredRef = useRef(filtered);
  filteredRef.current = filtered;

  useEffect(() => {
    const recompute = () => {
      const { selection } = editor.state;
      if (!selection.empty) return setState(null);
      const $from = editor.state.selection.$from;
      const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, '￼');
      const match = /(?:^|\s)\/([a-z0-9]*)$/i.exec(textBefore);
      if (!match) return setState(null);
      const slashOffset = match.index + (match[0].startsWith('/') ? 0 : 1);
      const from = $from.start() + slashOffset;
      const to = $from.pos;
      const coords = editor.view.coordsAtPos(from);
      setState({ query: match[1] ?? '', range: { from, to }, coords: { left: coords.left, top: coords.bottom } });
      setIndex(0);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const current = stateRef.current;
      if (!current) return;
      const items = filteredRef.current;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setIndex((i) => (items.length ? (i + 1) % items.length : 0));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setIndex((i) => (items.length ? (i - 1 + items.length) % items.length : 0));
      } else if (event.key === 'Enter') {
        event.preventDefault();
        const item = items[indexRef.current];
        if (item) {
          item.run(editor, current.range);
          setState(null);
        }
      } else if (event.key === 'Escape') {
        event.preventDefault();
        setState(null);
      }
    };

    editor.on('transaction', recompute);
    editor.view.dom.addEventListener('keydown', onKeyDown, true);
    return () => {
      editor.off('transaction', recompute);
      editor.view.dom.removeEventListener('keydown', onKeyDown, true);
    };
  }, [editor]);

  if (!state || filtered.length === 0) return null;

  return (
    <div className="nib-slash" style={{ left: state.coords.left, top: state.coords.top + 4 }}>
      {filtered.map((item, i) => (
        <button
          key={item.label}
          className="nib-slash-item"
          data-active={i === index}
          onMouseEnter={() => setIndex(i)}
          onMouseDown={(event) => {
            event.preventDefault();
            item.run(editor, state.range);
            setState(null);
          }}
        >
          <Icon name={item.icon} size={15} />
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
