import type { CompanionParts, RendererModule } from '@nib/shell';
import { FACT_TYPE, MODULE_ID } from '../shared';
import { AssistantView } from './AssistantView';
import { NibDock } from './NibDock';
import { NibStage } from './NibStage';

export const assistantModule: RendererModule = {
  id: MODULE_ID,
  title: 'Assistant',
  icon: 'sparkles',
  recordTypes: [FACT_TYPE],
  component: AssistantView,
};

/** The on-screen Nib companion: a sidebar dock + an in-window wandering stage. */
export const nibCompanion: CompanionParts = {
  Dock: NibDock,
  Stage: NibStage,
};
