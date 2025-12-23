// src/lib/encryption.ts

// Helper functions for string/buffer conversions
export const stringToArrayBuffer = (str: string): ArrayBuffer => {
  return new TextEncoder().encode(str).buffer;
};

export const arrayBufferToString = (buffer: ArrayBuffer): string => {
  return new TextDecoder().decode(buffer);
};

export const arrayBufferToBase64 = (
  buffer: ArrayBuffer | Uint8Array,
): string => {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return window.btoa(String.fromCharCode(...bytes));
};

export const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

/**
 * Derives an encryption key from a password and salt using PBKDF2.
 * @param password The user's password.
 * @param salt A random salt (should be stored and reused for the same password).
 * @param iterations The number of iterations (higher is more secure).
 * @returns A CryptoKey object for use with AES-GCM.
 */
export const deriveKey = async (
  password: string,
  salt: BufferSource,
  iterations = 250000,
): Promise<CryptoKey> => {
  const saltU8 =
    salt instanceof Uint8Array ? salt : new Uint8Array(salt as ArrayBuffer);

  const baseKey = await crypto.subtle.importKey(
    "raw",
    stringToArrayBuffer(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
};

/**
 * Generates a random salt.
 * @param length The length of the salt in bytes.
 * @returns A Uint8Array containing the random salt.
 */
export const generateSalt = (length = 16): Uint8Array => {
  return window.crypto.getRandomValues(new Uint8Array(length));
};

/**
 * Encrypts data using AES-GCM.
 * @param data The string data to encrypt.
 * @param key The CryptoKey to use for encryption.
 * @returns An object containing the base64-encoded encrypted data and the iv.
 */
export const encryptData = async (
  data: string,
  key: CryptoKey,
): Promise<{ encryptedData: string; iv: string }> => {
  const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for AES-GCM
  const encodedData = stringToArrayBuffer(data);

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    encodedData,
  );

  return {
    encryptedData: arrayBufferToBase64(encryptedBuffer),
    iv: arrayBufferToBase64(iv),
  };
};

/**
 * Decrypts data using AES-GCM.
 * @param encryptedData The base64-encoded encrypted data.
 * @param key The CryptoKey to use for decryption.
 * @param iv The base64-encoded initialization vector.
 * @returns The decrypted string data.
 */
export const decryptData = async (
  encryptedData: string,
  key: CryptoKey,
  iv: string,
): Promise<string> => {
  try {
    const encryptedBuffer = base64ToArrayBuffer(encryptedData);
    const ivBuffer = new Uint8Array(base64ToArrayBuffer(iv));

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: ivBuffer,
      },
      key,
      encryptedBuffer,
    );

    return arrayBufferToString(decryptedBuffer);
  } catch (error) {
    console.error("Decryption error:", error);
    throw new Error(
      "Failed to decrypt data. The key may be incorrect or the data may have been tampered with.",
    );
  }
};

/**
 * Hashes a password for storage comparison (not for encryption).
 * Uses PBKDF2, returning a hash and the salt used.
 * @param password The password to hash.
 * @param salt An optional salt. A new one is generated if not provided.
 * @returns The base64-encoded hash and salt.
 */
export const hashPassword = async (
  password: string,
  salt?: Uint8Array,
): Promise<{ hash: string; salt: string }> => {
  const saltToUse = salt || generateSalt();
  const safeSalt = new Uint8Array(saltToUse).buffer;

  const key = await deriveKey(password, safeSalt);
  const rawKey = await crypto.subtle.exportKey("raw", key);

  return {
    hash: arrayBufferToBase64(rawKey),
    salt: arrayBufferToBase64(saltToUse),
  };
};

/**
 * Generates a secure random token for share links.
 * @param length The desired length of the token.
 * @returns A URL-safe random string.
 */
export const generateToken = (length = 64): string => {
  const charset =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const values = new Uint8Array(length);
  window.crypto.getRandomValues(values);
  return Array.from(values, (x) => charset[x % charset.length]).join("");
};
