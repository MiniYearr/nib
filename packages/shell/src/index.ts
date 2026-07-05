export { AppShell, type AppShellProps } from './AppShell';
export { CommandPalette, paletteStyles } from './CommandPalette';
export { Icon, type IconName, type IconProps } from './icons';
export { SettingsModal, type SettingsModalProps } from './SettingsModal';
export { applyTheme, themeCss, useTheme, type ThemeName } from './theme';
export { PluginManager } from './PluginManager';
export { pluginManagerModule } from './plugin-manager-module';
export { SearchOverlay, type SearchOverlayProps } from './SearchOverlay';
export { TitleBar } from './TitleBar';
export type {
  CompanionParts,
  ModuleHostApi,
  ModuleOpenRequest,
  ModuleViewProps,
  RendererModule,
} from './module';
export type { CommandDescriptor, NibWindowApi } from '@nib/plugin-api';
