import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppShell } from '@nib/shell';
import { notepadModule } from '@nib/plugin-notepad/renderer';
import { todoModule } from '@nib/plugin-todo/renderer';

const root = document.getElementById('root');
if (!root) throw new Error('renderer index.html is missing the #root element');

createRoot(root).render(
  <StrictMode>
    <AppShell modules={[notepadModule, todoModule]} />
  </StrictMode>,
);
