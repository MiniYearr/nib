import type { RendererModule } from '@nib/shell';
import { FACT_TYPE, MODULE_ID } from '../shared';
import { AssistantView } from './AssistantView';

export const assistantModule: RendererModule = {
  id: MODULE_ID,
  title: 'Assistant',
  icon: '✦',
  recordTypes: [FACT_TYPE],
  component: AssistantView,
};
