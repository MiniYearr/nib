import { useEffect, useRef } from 'react';
import { basicSetup, EditorView } from 'codemirror';
import { markdown } from '@codemirror/lang-markdown';

export interface SourceEditorProps {
  initialValue: string;
  onChange(value: string): void;
}

const sourceTheme = EditorView.theme({
  '&': { height: '100%', fontSize: '13.5px', backgroundColor: 'transparent' },
  '.cm-content': {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    caretColor: 'var(--nib-accent)',
    padding: '16px 0',
  },
  '.cm-cursor': { borderLeftColor: 'var(--nib-accent)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-gutters': { display: 'none' },
  '.cm-activeLine': { backgroundColor: 'rgba(191, 107, 68, 0.05)' },
});

export function SourceEditor({ initialValue, onChange }: SourceEditorProps) {
  const container = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!container.current) return;
    const view = new EditorView({
      doc: initialValue,
      parent: container.current,
      extensions: [
        basicSetup,
        markdown(),
        EditorView.lineWrapping,
        sourceTheme,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChangeRef.current(update.state.doc.toString());
        }),
      ],
    });
    return () => view.destroy();
    // The parent remounts this component (key) whenever the note or mode
    // changes, so the initial doc only needs to be read once.
  }, []);

  return <div ref={container} className="nib-source-editor" />;
}
