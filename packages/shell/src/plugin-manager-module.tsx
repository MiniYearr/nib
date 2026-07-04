import type { RendererModule } from './module';
import { PluginManager } from './PluginManager';

/** Built-in module: the manager for enabling, granting, and installing plugins. */
export const pluginManagerModule: RendererModule = {
  id: 'nib.plugins',
  title: 'Plugins',
  icon: '🧩',
  recordTypes: [],
  component: PluginManager,
};
