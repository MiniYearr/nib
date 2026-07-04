import type { NibPluginModule } from '@nib/plugin-api';

/**
 * Dogfoods the plugin API while the real modules are being built — the first
 * package to go through the manifest → permissions → activate pipeline.
 */
const samplePlugin: NibPluginModule = {
  manifest: {
    id: 'nib.sample',
    name: 'Sample',
    version: '0.1.0',
    minAppVersion: '0.1.0',
    description: 'Demonstrates commands, records, events, and scheduling through nib.*',
    permissions: [
      'records:read:note',
      'records:write:note',
      'events:subscribe:record.*',
      'scheduler',
    ],
    contributes: {
      commands: [
        { id: 'create-sample-note', title: 'Sample: Create sample note' },
        { id: 'log-note-count', title: 'Sample: Log note count' },
      ],
    },
  },

  activate(ctx) {
    ctx.commands.register({
      id: 'create-sample-note',
      title: 'Sample: Create sample note',
      category: 'Sample',
      run() {
        const note = ctx.records.create({
          type: 'note',
          title: `Sample note ${new Date().toLocaleTimeString()}`,
          bodyMd: 'Created through the `nib.*` plugin API.',
          tags: ['sample'],
        });
        ctx.log.info(`created note ${note.id}`);
      },
    });

    ctx.commands.register({
      id: 'log-note-count',
      title: 'Sample: Log note count',
      category: 'Sample',
      run() {
        ctx.log.info(`there are ${ctx.records.list({ type: 'note' }).length} notes`);
      },
    });

    ctx.events.on('record.created', (event) => {
      ctx.log.info(`observed ${event.type} from ${event.source}`);
    });
  },
};

export default samplePlugin;
