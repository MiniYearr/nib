// A Nib plugin is plain JavaScript that runs in a sandbox: no Node, no
// filesystem, no network unless you declare it. Your only doorway into the
// app is the global `nib` object, whose methods return Promises.
//
// Everything here is gated by the permissions in nib-plugin.json that the
// user actually granted at install. Ask for the least you need.

nib.log('word-count plugin activated');

nib.commands.register('count-words', 'Word Count: tally words in all notes', async () => {
  // records.read:note was requested; if the user granted it this returns notes,
  // otherwise it comes back empty — your plugin can never see what it wasn't given.
  const notes = await nib.records.list({ type: 'note' });
  const words = notes.reduce((total, note) => {
    const text = `${note.title} ${note.bodyMd}`.trim();
    return total + (text ? text.split(/\s+/).length : 0);
  }, 0);

  nib.log(`counted ${words} words across ${notes.length} notes`);

  // Emit a namespaced event other parts of the app (or the assistant) can hear.
  nib.events.emit('com.example.word-count.counted', { notes: notes.length, words });
});
