import type { NibPluginModule } from '@nib/plugin-api';

interface AniListMedia {
  title: { romaji?: string; english?: string };
  seasonYear?: number;
  coverImage?: { large?: string };
  siteUrl?: string;
}

const QUERY = `
  query ($search: String) {
    Page(perPage: 5) {
      media(search: $search, type: ANIME) {
        title { romaji english }
        seasonYear
        coverImage { large }
        siteUrl
      }
    }
  }
`;

/** Keyless AniList GraphQL lookup — the first plugin to declare a network permission. */
const anilistPlugin: NibPluginModule = {
  manifest: {
    id: 'nib.media-anilist',
    name: 'AniList lookup',
    version: '0.1.0',
    minAppVersion: '0.1.0',
    description: 'Anime metadata and cover art from AniList (no API key required).',
    permissions: ['network:graphql.anilist.co'],
  },

  activate(ctx) {
    ctx.services.register('lookup', async (payload) => {
      const title = String((payload as { title?: unknown } | undefined)?.title ?? '').trim();
      if (!title) return [];
      const response = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query: QUERY, variables: { search: title } }),
      });
      if (!response.ok) return [];
      const json = (await response.json()) as {
        data?: { Page?: { media?: AniListMedia[] } };
      };
      return (json.data?.Page?.media ?? []).map((media) => ({
        source: 'anilist',
        kind: 'anime',
        title: media.title.english ?? media.title.romaji ?? title,
        year: media.seasonYear,
        coverUrl: media.coverImage?.large,
        url: media.siteUrl,
      }));
    });
  },
};

export default anilistPlugin;
