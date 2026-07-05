import type { RendererModule } from '@nib/shell';
import { DIARY_TYPE, MODULE_ID } from '../shared';
import { DiaryView } from './DiaryView';

export const diaryModule: RendererModule = {
  id: MODULE_ID,
  title: 'Diary',
  icon: 'book-open',
  recordTypes: [DIARY_TYPE],
  component: DiaryView,
};
