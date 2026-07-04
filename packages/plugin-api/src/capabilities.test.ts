import { describe, expect, it } from 'vitest';
import {
  describePermission,
  hostAllowed,
  isSensitivePermission,
  networkDomains,
} from './capabilities';

describe('networkDomains', () => {
  it('extracts network scopes only', () => {
    expect(
      networkDomains(['records:read:note', 'network:api.tvmaze.com', 'network:graphql.anilist.co']),
    ).toEqual(['api.tvmaze.com', 'graphql.anilist.co']);
  });
});

describe('hostAllowed', () => {
  const grants = ['network:api.tvmaze.com'];

  it('allows exact host and subdomains', () => {
    expect(hostAllowed(grants, 'https://api.tvmaze.com/search/shows?q=x')).toBe(true);
    expect(hostAllowed(grants, 'https://cdn.api.tvmaze.com/img.jpg')).toBe(true);
  });

  it('blocks other hosts and lookalikes', () => {
    expect(hostAllowed(grants, 'https://evil.com/steal')).toBe(false);
    expect(hostAllowed(grants, 'https://notapi.tvmaze.com.evil.com/')).toBe(false);
    expect(hostAllowed(grants, 'https://api-tvmaze.com/')).toBe(false);
  });

  it('blocks everything with no network grants and rejects junk urls', () => {
    expect(hostAllowed([], 'https://api.tvmaze.com/')).toBe(false);
    expect(hostAllowed(grants, 'not a url')).toBe(false);
  });
});

describe('isSensitivePermission', () => {
  it.each([
    ['diary:read', true],
    ['network:api.tvmaze.com', true],
    ['records:write:note', true],
    ['records:read:*', true],
    ['events:subscribe:*', true],
    ['*', true],
    ['records:read:note', false],
    ['events:subscribe:task.completed', false],
    ['scheduler', false],
  ])('%s -> %s', (scope, expected) => {
    expect(isSensitivePermission(scope)).toBe(expected);
  });
});

describe('describePermission', () => {
  it('renders friendly text', () => {
    expect(describePermission('records:read:note')).toBe('Read “note” records');
    expect(describePermission('records:write:task')).toContain('Create, edit and delete');
    expect(describePermission('network:api.tvmaze.com')).toBe('Connect to api.tvmaze.com');
    expect(describePermission('diary:read')).toContain('diary');
  });
});
