import type { RendererModule } from '@nib/shell';
import { MODULE_ID, NOTE_TYPE } from '../shared';
import { NotepadView } from './NotepadView';

export const notepadModule: RendererModule = {
  id: MODULE_ID,
  title: 'Notepad',
  icon: '✎',
  recordTypes: [NOTE_TYPE],
  component: NotepadView,
};
