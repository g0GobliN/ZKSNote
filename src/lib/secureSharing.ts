import {
  deriveKey,
  encryptData,
  decryptData,
  generateSalt,
  generateToken,
  arrayBufferToBase64,
  base64ToArrayBuffer,
} from "./encryption";

interface SecureShareOptions {
  expiresInDays?: number;
  password?: string;
}

// Define a specific type for the data being shared
export interface SharePayload {
  title: string;
  content: string;
  snippets: { id: string; code: string; language: string }[];
}

/**
 * Creates a secure, shareable link for a piece of data.
 * @param data The data to be shared.
 * @param options Options for sharing, like expiration and password protection.
 * @returns A promise that resolves to the share link and the raw key (for non-password shares).
 */
export const createSecureShareLink = async (
  data: SharePayload,
  options: SecureShareOptions = {},
): Promise<{ link: string; key: string }> => {
  const { expiresInDays = 7, password } = options;

  // 1. Generate a new, random key to encrypt the main data.
  const dataKey = await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );

  // 2. Prepare the data payload.
  const payload = {
    version: "2.0", // Updated version for SubtleCrypto
    timestamp: new Date().toISOString(),
    expiresAt: Date.now() + expiresInDays * 24 * 60 * 60 * 1000,
    data,
  };

  // 3. Encrypt the payload with the data key.
  const { encryptedData, iv } = await encryptData(
    JSON.stringify(payload),
    dataKey,
  );

  // 4. Prepare the key for the URL.
  let keyForUrl: string;

  if (password) {
    // If password protected, encrypt the data key with a key derived from the password.
    const salt = generateSalt();
    const passwordKey = await deriveKey(password, salt);

    // Export the raw data key to be encrypted.
    const rawDataKey = await window.crypto.subtle.exportKey("raw", dataKey);

    // Encrypt the raw data key. We need a temporary encryption function for ArrayBuffers.
    const keyIv = window.crypto.getRandomValues(new Uint8Array(12));
    const encryptedKeyBuffer = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: keyIv },
      passwordKey,
      rawDataKey,
    );

    // Format for URL: base64(salt):base64(iv):base64(encryptedKey)
    keyForUrl = [
      arrayBufferToBase64(salt),
      arrayBufferToBase64(keyIv),
      arrayBufferToBase64(encryptedKeyBuffer),
    ].join(":");
  } else {
    // If not password protected, simply export the raw key and encode it.
    const rawDataKey = await window.crypto.subtle.exportKey("raw", dataKey);
    keyForUrl = arrayBufferToBase64(rawDataKey);
  }

  // 5. Build the final URL.
  const params = new URLSearchParams();
  params.set("v", "2"); // Version parameter
  params.set("d", encryptedData);
  params.set("i", iv);
  params.set("k", keyForUrl);

  return {
    link: `${window.location.origin}/share#${params.toString()}`,
    key: keyForUrl, // This is the exported key, possibly encrypted.
  };
};

/**
 * Decrypts data from a secure share link.
 * @param encryptedData The base64-encoded encrypted data.
 * @param iv The base64-encoded IV for the data.
 * @param keyMaterial The key, either raw (base64) or encrypted (salt:iv:key).
 * @param password An optional password if the link is password-protected.
 * @returns A promise that resolves to the original shared data.
 */
export const decryptSecureShare = async (
  encryptedData: string,
  iv: string,
  keyMaterial: string,
  password?: string,
): Promise<SharePayload> => {
  try {
    let dataKey: CryptoKey;

    if (password) {
      // If password protected, decrypt the keyMaterial to get the data key.
      const [saltB64, keyIvB64, encryptedKeyB64] = keyMaterial.split(":");
      if (!saltB64 || !keyIvB64 || !encryptedKeyB64) {
        throw new Error("Invalid password-protected key format.");
      }

      const salt = base64ToArrayBuffer(saltB64);
      const keyIv = base64ToArrayBuffer(keyIvB64);
      const encryptedKey = base64ToArrayBuffer(encryptedKeyB64);

      const passwordKey = await deriveKey(password, salt);

      const rawDataKey = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: keyIv },
        passwordKey,
        encryptedKey,
      );

      dataKey = await window.crypto.subtle.importKey(
        "raw",
        rawDataKey,
        { name: "AES-GCM" },
        true,
        ["encrypt", "decrypt"],
      );
    } else {
      // If not password protected, the keyMaterial is the raw data key.
      const rawDataKey = base64ToArrayBuffer(keyMaterial);
      dataKey = await window.crypto.subtle.importKey(
        "raw",
        rawDataKey,
        { name: "AES-GCM" },
        true,
        ["encrypt", "decrypt"],
      );
    }

    // Decrypt the main payload.
    const decrypted = await decryptData(encryptedData, dataKey, iv);
    const { version, expiresAt, data } = JSON.parse(decrypted);

    // Check version and expiration.
    if (version !== "2.0") {
      console.warn(
        `Version mismatch: expected 2.0, got ${version}. Attempting to proceed.`,
      );
    }

    if (expiresAt && Date.now() > new Date(expiresAt).getTime()) {
      throw new Error("This link has expired.");
    }

    return data;
  } catch (error) {
    console.error("Decryption failed:", error);
    throw new Error("Failed to decrypt. Invalid password or corrupted data.");
  }
};

/**
 * Helper function to parse the share URL hash.
 * @param url The full share URL.
 * @returns An object containing the URL parameters.
 */
export const parseShareUrl = (url: string) => {
  try {
    const hash = new URL(url).hash.substring(1);
    const params = new URLSearchParams(hash);

    return {
      version: params.get("v"),
      encryptedData: params.get("d"),
      iv: params.get("i"),
      key: params.get("k"),
    };
  } catch (error) {
    throw new Error("Invalid share URL");
  }
};
