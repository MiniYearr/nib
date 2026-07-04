import type { NibEvent } from './context';
import type { SearchHit } from './records';

export interface CommandDescriptor {
  id: string;
  title: string;
  category?: string;
  moduleId: string;
}

/** The bridge surface the preload script exposes to renderer windows as `window.nib`. */
export interface NibWindowApi {
  commands: {
    list(): Promise<CommandDescriptor[]>;
    execute(id: string): Promise<void>;
  };
  search(query: string): Promise<SearchHit[]>;
  events: {
    on(pattern: string, handler: (event: NibEvent) => void): () => void;
  };
  runtime: {
    electron: string;
    chrome: string;
  };
}

declare global {
  interface Window {
    nib?: NibWindowApi;
  }
}
