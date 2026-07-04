import sodium from 'libsodium-wrappers-sumo';

/**
 * Argon2id (INTERACTIVE limits — the WASM build cannot allocate the MODERATE
 * 256 MiB working set) derives keys; XChaCha20-Poly1305 AEAD seals payloads.
 * KDF parameters are stored per vault so future hardening won't strand old
 * diaries. Packed format: [24-byte nonce][ciphertext+tag].
 */

let ready = false;

export async function initCrypto(): Promise<void> {
  await sodium.ready;
  ready = true;
}

function lib(): typeof sodium {
  if (!ready) throw new Error('crypto not initialized — call initCrypto() first');
  return sodium;
}

export interface KdfParams {
  saltB64: string;
  opslimit: number;
  memlimit: number;
}

export function generateKdfParams(): KdfParams {
  const s = lib();
  return {
    saltB64: s.to_base64(s.randombytes_buf(s.crypto_pwhash_SALTBYTES)),
    opslimit: s.crypto_pwhash_OPSLIMIT_INTERACTIVE,
    memlimit: s.crypto_pwhash_MEMLIMIT_INTERACTIVE,
  };
}

export function deriveKey(password: string, params: KdfParams): Uint8Array {
  const s = lib();
  return s.crypto_pwhash(
    s.crypto_aead_xchacha20poly1305_ietf_KEYBYTES,
    password,
    s.from_base64(params.saltB64),
    params.opslimit,
    params.memlimit,
    s.crypto_pwhash_ALG_ARGON2ID13,
  );
}

export function seal(key: Uint8Array, plaintext: Uint8Array | string): Uint8Array {
  const s = lib();
  const nonce = s.randombytes_buf(s.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  const cipher = s.crypto_aead_xchacha20poly1305_ietf_encrypt(
    plaintext,
    null,
    null,
    nonce,
    key,
  );
  const packed = new Uint8Array(nonce.length + cipher.length);
  packed.set(nonce);
  packed.set(cipher, nonce.length);
  return packed;
}

/** Throws on a wrong key or tampered ciphertext. */
export function open(key: Uint8Array, packed: Uint8Array): Uint8Array {
  const s = lib();
  const nonceBytes = s.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES;
  const nonce = packed.slice(0, nonceBytes);
  const cipher = packed.slice(nonceBytes);
  return s.crypto_aead_xchacha20poly1305_ietf_decrypt(null, cipher, null, nonce, key);
}

export function sealJson(key: Uint8Array, value: unknown): Uint8Array {
  return seal(key, JSON.stringify(value));
}

export function openJson<T>(key: Uint8Array, packed: Uint8Array): T {
  return JSON.parse(new TextDecoder().decode(open(key, packed))) as T;
}

const KEY_CHECK_SENTINEL = 'nib-diary-key-check-v1';

export function makeKeyCheck(key: Uint8Array): string {
  return lib().to_base64(seal(key, KEY_CHECK_SENTINEL));
}

export function verifyKeyCheck(key: Uint8Array, checkB64: string): boolean {
  try {
    const opened = open(key, lib().from_base64(checkB64));
    return new TextDecoder().decode(opened) === KEY_CHECK_SENTINEL;
  } catch {
    return false;
  }
}

export function toBase64(bytes: Uint8Array): string {
  return lib().to_base64(bytes);
}

export function fromBase64(text: string): Uint8Array {
  return lib().from_base64(text);
}

export function zeroKey(key: Uint8Array): void {
  key.fill(0);
}
