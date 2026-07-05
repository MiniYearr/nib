import { useEffect, useRef } from 'react';
import type { Editor } from '@tiptap/core';
import { EditorContent, useEditor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import { Icon } from '@nib/shell';
import { editorExtensions } from './markdown';
import { SlashMenu } from './SlashMenu';

export interface RichEditorProps {
  initialMarkdown: string;
  onMarkdownChange(markdown: string): void;
  onEditor(editor: Editor | null): void;
}

export function RichEditor({ initialMarkdown, onMarkdownChange, onEditor }: RichEditorProps) {
  const onChangeRef = useRef(onMarkdownChange);
  onChangeRef.current = onMarkdownChange;
  const onEditorRef = useRef(onEditor);
  onEditorRef.current = onEditor;

  const editor = useEditor({
    extensions: editorExtensions(),
    content: initialMarkdown,
    contentType: 'markdown',
    onUpdate({ editor: current }) {
      onChangeRef.current(current.getMarkdown());
    },
  });

  useEffect(() => {
    onEditorRef.current(editor);
    return () => onEditorRef.current(null);
  }, [editor]);

  return (
    <div className="nib-rich-editor">
      <EditorContent editor={editor} />
      {editor && (
        <>
          <BubbleMenu editor={editor} className="nib-bubble">
            <button title="Bold" onClick={() => editor.chain().focus().toggleBold().run()}>
              <Icon name="bold" size={14} />
            </button>
            <button title="Italic" onClick={() => editor.chain().focus().toggleItalic().run()}>
              <Icon name="italic" size={14} />
            </button>
            <button title="Strikethrough" onClick={() => editor.chain().focus().toggleStrike().run()}>
              <Icon name="strikethrough" size={14} />
            </button>
            <button title="Inline code" onClick={() => editor.chain().focus().toggleCode().run()}>
              <Icon name="code" size={14} />
            </button>
          </BubbleMenu>
          <SlashMenu editor={editor} />
        </>
      )}
    </div>
  );
}
