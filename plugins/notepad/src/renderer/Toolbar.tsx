import { useState } from 'react';
import type { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import { Icon } from '@nib/shell';

export interface ToolbarProps {
  editor: Editor | null;
  mode: 'rich' | 'source';
  onModeChange(mode: 'rich' | 'source'): void;
  onToggleHistory(): void;
  historyOpen: boolean;
}

interface Flags {
  h1: boolean;
  h2: boolean;
  bold: boolean;
  italic: boolean;
  strike: boolean;
  code: boolean;
  bullet: boolean;
  ordered: boolean;
  task: boolean;
  quote: boolean;
  codeBlock: boolean;
  link: boolean;
}

const EMPTY_FLAGS: Flags = {
  h1: false,
  h2: false,
  bold: false,
  italic: false,
  strike: false,
  code: false,
  bullet: false,
  ordered: false,
  task: false,
  quote: false,
  codeBlock: false,
  link: false,
};

export function Toolbar({ editor, mode, onModeChange, onToggleHistory, historyOpen }: ToolbarProps) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState('');

  const flags =
    useEditorState({
      editor,
      selector: ({ editor: e }): Flags =>
        e
          ? {
              h1: e.isActive('heading', { level: 1 }),
              h2: e.isActive('heading', { level: 2 }),
              bold: e.isActive('bold'),
              italic: e.isActive('italic'),
              strike: e.isActive('strike'),
              code: e.isActive('code'),
              bullet: e.isActive('bulletList'),
              ordered: e.isActive('orderedList'),
              task: e.isActive('taskList'),
              quote: e.isActive('blockquote'),
              codeBlock: e.isActive('codeBlock'),
              link: e.isActive('link'),
            }
          : EMPTY_FLAGS,
    }) ?? EMPTY_FLAGS;

  const disabled = mode === 'source' || !editor;
  const run = (fn: (chain: ReturnType<Editor['chain']>) => ReturnType<Editor['chain']>) => {
    if (editor) fn(editor.chain().focus()).run();
  };

  const applyLink = () => {
    if (!editor) return;
    const url = linkValue.trim();
    if (url) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    } else {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    }
    setLinkOpen(false);
    setLinkValue('');
  };

  const Btn = ({
    name,
    title,
    active,
    onClick,
  }: {
    name: string;
    title: string;
    active?: boolean;
    onClick(): void;
  }) => (
    <button
      className="nib-tb-btn"
      data-active={active}
      title={title}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon name={name} size={15} />
    </button>
  );

  return (
    <div className="nib-tb">
      <div className="nib-tb-modes" role="group" aria-label="Editor mode">
        <button data-active={mode === 'rich'} onClick={() => onModeChange('rich')}>
          Rich
        </button>
        <button data-active={mode === 'source'} onClick={() => onModeChange('source')}>
          Markdown
        </button>
      </div>
      <div className="nib-tb-divider" />
      <div className="nib-tb-group">
        <Btn
          name="heading-1"
          title="Heading 1"
          active={flags.h1}
          onClick={() => run((c) => c.toggleHeading({ level: 1 }))}
        />
        <Btn
          name="heading"
          title="Heading 2"
          active={flags.h2}
          onClick={() => run((c) => c.toggleHeading({ level: 2 }))}
        />
        <Btn name="bold" title="Bold" active={flags.bold} onClick={() => run((c) => c.toggleBold())} />
        <Btn
          name="italic"
          title="Italic"
          active={flags.italic}
          onClick={() => run((c) => c.toggleItalic())}
        />
        <Btn
          name="strikethrough"
          title="Strikethrough"
          active={flags.strike}
          onClick={() => run((c) => c.toggleStrike())}
        />
        <Btn
          name="code"
          title="Inline code"
          active={flags.code}
          onClick={() => run((c) => c.toggleCode())}
        />
        <Btn
          name="list"
          title="Bullet list"
          active={flags.bullet}
          onClick={() => run((c) => c.toggleBulletList())}
        />
        <Btn
          name="list-ordered"
          title="Numbered list"
          active={flags.ordered}
          onClick={() => run((c) => c.toggleOrderedList())}
        />
        <Btn
          name="list-checks"
          title="Task list"
          active={flags.task}
          onClick={() => run((c) => c.toggleTaskList())}
        />
        <Btn
          name="quote"
          title="Quote"
          active={flags.quote}
          onClick={() => run((c) => c.toggleBlockquote())}
        />
        <Btn
          name="link"
          title="Link"
          active={flags.link || linkOpen}
          onClick={() => {
            if (disabled) return;
            setLinkValue(editor?.getAttributes('link').href ?? '');
            setLinkOpen((open) => !open);
          }}
        />
      </div>
      {linkOpen && (
        <div className="nib-tb-link">
          <input
            autoFocus
            placeholder="https://…  (empty to remove)"
            value={linkValue}
            onChange={(event) => setLinkValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') applyLink();
              if (event.key === 'Escape') setLinkOpen(false);
            }}
          />
          <button onClick={applyLink}>Apply</button>
        </div>
      )}
      <div className="nib-tb-spacer" />
      <button className="nib-tb-history" data-active={historyOpen} onClick={onToggleHistory}>
        <Icon name="history" size={14} />
        History
      </button>
    </div>
  );
}
