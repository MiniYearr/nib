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

/** A trusted in-repo module's renderer half, mounted inside the main window. */
export interface RendererModule {
  id: string;
  title: string;
  /** Short glyph shown in the sidebar until an icon system lands. */
  icon: string;
  /** Record types this module owns — search hits of these types route here. */
  recordTypes: string[];
  component: ComponentType<ModuleViewProps>;
}
