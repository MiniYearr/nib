import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { OverlayApp } from '@nib/plugin-assistant/overlay';

const root = document.getElementById('root');
if (!root) throw new Error('overlay.html is missing the #root element');

createRoot(root).render(
  <StrictMode>
    <OverlayApp />
  </StrictMode>,
);
