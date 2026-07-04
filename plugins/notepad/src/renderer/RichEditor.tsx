import { EditorContent, useEditor } from '@tiptap/react';
import { useRef } from 'react';
import { editorExtensions } from './markdown';

export interface RichEditorProps {
  initialMarkdown: string;
  onMarkdownChange(markdown: string): void;
}

export function RichEditor({ initialMarkdown, onMarkdownChange }: RichEditorProps) {
  const onChangeRef = useRef(onMarkdownChange);
  onChangeRef.current = onMarkdownChange;

  const editor = useEditor({
    extensions: editorExtensions(),
    content: initialMarkdown,
    contentType: 'markdown',
    onUpdate({ editor: current }) {
      onChangeRef.current(current.getMarkdown());
    },
  });

  return <EditorContent editor={editor} className="nib-rich-editor" />;
}
