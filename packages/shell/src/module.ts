import type { ComponentType } from 'react';
import type { NibRecord } from '@nib/plugin-api';

export interface ModuleHostApi {
  /** Route a record to the module that owns its type and focus that module. */
  openRecord(record: NibRecord): void;
}

export interface ModuleOpenRequest {
  record: NibRecord;
  /** Increments per request so modules can react to repeat opens of the same record. */
  nonce: number;
}

export interface ModuleViewProps {
  host: ModuleHostApi;
  openRequest?: ModuleOpenRequest;
}

/**
 * The on-screen companion, split so the shell can place the dock in the sidebar
 * and the wandering "stage" over the main content area while the assistant
 * package owns each part's chat/state.
 */
export interface CompanionParts {
  /** Sidebar chip; `onPop` sends Nib out to wander the window. */
  Dock: ComponentType<{ onPop(): void; collapsed: boolean }>;
  /** In-window wandering sprite + chat; `onDock` returns it to the sidebar. */
  Stage: ComponentType<{ onDock(): void }>;
}

/** A trusted in-repo module's renderer half, mounted inside the main window. */
export interface RendererModule {
  id: string;
  title: string;
  /** Icon name from the shell icon set (see `icons.tsx`), e.g. "file-text". */
  icon: string;
  /** Record types this module owns — search hits of these types route here. */
  recordTypes: string[];
  component: ComponentType<ModuleViewProps>;
}
