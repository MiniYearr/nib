// E2E fixture. Two commands prove the sandbox boundary:
//  - write-note: uses a GRANTED permission, so a note appears in the notepad.
//  - probe-forbidden: attempts a write it was NOT granted; the broker rejects
//    it, and the plugin records that denial as a note (proving both that the
//    call failed and that the plugin is still alive and permissioned normally).

nib.commands.register('write-note', 'Probe: write an allowed note', async () => {
  await nib.records.create({ type: 'note', title: 'Note from the sandbox', bodyMd: 'hello' });
});

nib.commands.register('probe-forbidden', 'Probe: attempt a forbidden write', async () => {
  try {
    await nib.records.create({ type: 'task', title: 'should never exist' });
    await nib.records.create({ type: 'note', title: 'LEAK: forbidden write succeeded' });
  } catch {
    await nib.records.create({ type: 'note', title: 'BLOCKED: task write was denied' });
  }
});

nib.log('sandbox probe activated');
