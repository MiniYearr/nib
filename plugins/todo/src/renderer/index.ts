import type { RendererModule } from '@nib/shell';
import { MODULE_ID, TASK_TYPE } from '../shared';
import { TodoView } from './TodoView';

export const todoModule: RendererModule = {
  id: MODULE_ID,
  title: 'To-do',
  icon: 'check-square',
  recordTypes: [TASK_TYPE],
  component: TodoView,
};
