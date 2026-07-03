import { describe, expect, it } from 'vitest';
import { validateManifest, type ManifestValidation } from './manifest';

function validManifest(): Record<string, unknown> {
  return {
    id: 'nib.notepad',
    name: 'Notepad',
    version: '0.1.0',
    minAppVersion: '0.1.0',
    permissions: [],
    contributes: {
      commands: [
        { id: 'new-note', title: 'New note' },
        { id: 'toggle-source', title: 'Toggle Markdown source view' },
      ],
    },
  };
}

function errorsOf(result: ManifestValidation): string[] {
  if (result.ok) throw new Error('expected validation to fail');
  return result.errors;
}

describe('validateManifest', () => {
  it('accepts a complete manifest', () => {
    const result = validateManifest(validManifest());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.manifest.id).toBe('nib.notepad');
  });

  it('accepts an empty permissions array', () => {
    expect(validateManifest({ ...validManifest(), permissions: [] }).ok).toBe(true);
  });

  it('rejects non-object input', () => {
    expect(errorsOf(validateManifest('not a manifest'))).toEqual(['manifest must be a JSON object']);
  });

  it('rejects an invalid id', () => {
    const errors = errorsOf(validateManifest({ ...validManifest(), id: 'Not Valid!' }));
    expect(errors.some((e) => e.startsWith('id:'))).toBe(true);
  });

  it('rejects a non-semver version', () => {
    const errors = errorsOf(validateManifest({ ...validManifest(), version: '1.0' }));
    expect(errors.some((e) => e.startsWith('version:'))).toBe(true);
  });

  it('rejects missing permissions', () => {
    const manifest = validManifest();
    delete manifest.permissions;
    const errors = errorsOf(validateManifest(manifest));
    expect(errors.some((e) => e.startsWith('permissions:'))).toBe(true);
  });

  it('rejects duplicate command ids', () => {
    const manifest = validManifest();
    manifest.contributes = {
      commands: [
        { id: 'new-note', title: 'New note' },
        { id: 'new-note', title: 'New note again' },
      ],
    };
    const errors = errorsOf(validateManifest(manifest));
    expect(errors.some((e) => e.includes('duplicate "new-note"'))).toBe(true);
  });

  it('accumulates every error instead of stopping at the first', () => {
    const errors = errorsOf(validateManifest({}));
    expect(errors.length).toBeGreaterThanOrEqual(4);
  });
});
