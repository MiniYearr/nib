import type { NibPluginModule } from '@nib/plugin-api';

interface TvMazeResult {
  show: {
    name: string;
    premiered?: string;
    image?: { medium?: string; original?: string };
    url?: string;
  };
}

/** Keyless TVmaze show lookup. */
const tvmazePlugin: NibPluginModule = {
  manifest: {
    id: 'nib.media-tvmaze',
    name: 'TVmaze lookup',
    version: '0.1.0',
    minAppVersion: '0.1.0',
    description: 'TV show metadata and cover art from TVmaze (no API key required).',
    permissions: ['network:api.tvmaze.com'],
  },

  activate(ctx) {
    ctx.services.register('lookup', async (payload) => {
      const title = String((payload as { title?: unknown } | undefined)?.title ?? '').trim();
      if (!title) return [];
      const response = await fetch(
        `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(title)}`,
      );
      if (!response.ok) return [];
      const results = (await response.json()) as TvMazeResult[];
      return results.slice(0, 5).map(({ show }) => ({
        source: 'tvmaze',
        kind: 'show',
        title: show.name,
        year: show.premiered ? Number(show.premiered.slice(0, 4)) : undefined,
        coverUrl: show.image?.original ?? show.image?.medium,
        url: show.url,
      }));
    });
  },
};

export default tvmazePlugin;
