import CryptoJS from 'crypto-js';

// Derive encryption key from password using PBKDF2
export const deriveKey = (password: string, salt: string, iterations = 100000): string => {
  const key = CryptoJS.PBKDF2(password, salt, {
    keySize: 256 / 32,
    iterations,
    hasher: CryptoJS.algo.SHA256
  });
  return key.toString();
};

// Generate a random salt
export const generateSalt = (length = 16): string => {
  return CryptoJS.lib.WordArray.random(length).toString();
};

// Generate a secure random key
export const generateKey = (length = 32): string => {
  return CryptoJS.lib.WordArray.random(length).toString();
};

// Encrypt content with a key
export const encryptData = async (data: string, key: string): Promise<{ encryptedData: string; iv: string }> => {
  const iv = generateSalt(12);
  const encrypted = CryptoJS.AES.encrypt(data, key, {
    iv: CryptoJS.enc.Hex.parse(iv),
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });
  return {
    encryptedData: encrypted.toString(),
    iv
  };
};

// Decrypt content with a key and IV
export const decryptData = async (encryptedData: string, key: string, iv: string): Promise<string> => {
  try {
    const decrypted = CryptoJS.AES.decrypt(encryptedData, key, {
      iv: CryptoJS.enc.Hex.parse(iv),
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    return decrypted.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
};

// Encrypt content using AES-256 (legacy, for backward compatibility)
export const encryptContent = (content: string, key: string): string => {
  return CryptoJS.AES.encrypt(content, key).toString();
};

// Decrypt content using AES-256 (legacy, for backward compatibility)
export const decryptContent = (encryptedContent: string, key: string): string | null => {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedContent, key);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    return decrypted || null;
  } catch {
    return null;
  }
};

// Hash password for storage comparison (not for encryption)
export const hashPassword = (password: string, salt?: string): { hash: string; salt: string } => {
  const saltToUse = salt || generateSalt();
  const hash = CryptoJS.PBKDF2(password, saltToUse, {
    keySize: 256 / 32,
    iterations: 100000,
    hasher: CryptoJS.algo.SHA256
  }).toString();
  
  return { hash, salt: saltToUse };
};

// Generate a secure random token for share links
export const generateToken = (length = 32): string => {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const values = new Uint8Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, x => charset[x % charset.length]).join('');
};
