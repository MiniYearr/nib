import type { NibPluginModule } from '@nib/plugin-api';

interface OpenLibraryDoc {
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  number_of_pages_median?: number;
  cover_i?: number;
}

/** Keyless Open Library book lookup — covers + author + page count. */
const openLibraryPlugin: NibPluginModule = {
  manifest: {
    id: 'nib.media-openlibrary',
    name: 'Open Library lookup',
    version: '0.1.0',
    minAppVersion: '0.1.0',
    description: 'Book metadata and cover art from Open Library (no API key required).',
    permissions: ['network:openlibrary.org', 'network:covers.openlibrary.org'],
  },

  activate(ctx) {
    ctx.services.register('lookup', async (payload) => {
      const title = String((payload as { title?: unknown } | undefined)?.title ?? '').trim();
      if (!title) return [];
      const url =
        `https://openlibrary.org/search.json?q=${encodeURIComponent(title)}` +
        '&fields=title,author_name,first_publish_year,number_of_pages_median,cover_i&limit=6';
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!response.ok) return [];
      const json = (await response.json()) as { docs?: OpenLibraryDoc[] };
      return (json.docs ?? []).map((doc) => ({
        title: doc.title,
        author: doc.author_name?.[0],
        year: doc.first_publish_year,
        pages: doc.number_of_pages_median,
        coverUrl: doc.cover_i
          ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
          : undefined,
      }));
    });
  },
};

export default openLibraryPlugin;
