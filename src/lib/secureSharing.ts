import { 
  encryptData, 
  decryptData, 
  generateKey, 
  generateSalt, 
  generateToken 
} from './encryption';

interface SecureShareOptions {
  expiresInDays?: number;
  password?: string;
}

export const createSecureShareLink = async (
  data: any,
  options: SecureShareOptions = {}
): Promise<{ link: string; key: string }> => {
  const {
    expiresInDays = 7,
    password
  } = options;

  // Generate a secure encryption key
  const key = generateKey();
  
  // Prepare the data to be encrypted
  const payload = {
    version: '1.0',
    timestamp: new Date().toISOString(),
    expiresAt: Date.now() + (expiresInDays * 24 * 60 * 60 * 1000),
    data
  };

  // Encrypt the data
  const { encryptedData, iv } = await encryptData(JSON.stringify(payload), key);
  
  // If password is provided, encrypt the key
  let encryptedKey = key;
  if (password) {
    const salt = generateSalt();
    const derivedKey = await encryptData(key, password + salt);
    encryptedKey = `${salt}:${derivedKey.encryptedData}:${derivedKey.iv}`;
  }

  // Create a unique token for this share
  const token = generateToken(32);
  
  // Build the URL
  const params = new URLSearchParams();
  params.set('t', token);
  params.set('d', btoa(encryptedData));
  params.set('i', btoa(iv));
  
  // Only include key in URL if not password protected
  if (!password) {
    params.set('k', btoa(encryptedKey));
  }

  return {
    link: `${window.location.origin}/share#${params.toString()}`,
    key: encryptedKey
  };
};

export const decryptSecureShare = async (
  encryptedData: string,
  iv: string,
  encryptedKey: string,
  password?: string
): Promise<any> => {
  try {
    // If password is provided, decrypt the key first
    let key = atob(encryptedKey);
    
    if (password) {
      const [salt, encKey, keyIv] = key.split(':');
      if (!salt || !encKey || !keyIv) {
        throw new Error('Invalid key format');
      }
      
      key = await decryptData(encKey, password + salt, keyIv);
    }

    // Decrypt the data
    const decrypted = await decryptData(atob(encryptedData), key, atob(iv));
    const { version, expiresAt, data } = JSON.parse(decrypted);

    // Check version compatibility
    if (version !== '1.0') {
      throw new Error('Unsupported version');
    }

    // Check if the link has expired
    if (expiresAt && Date.now() > new Date(expiresAt).getTime()) {
      throw new Error('This link has expired');
    }

    return data;
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt. Invalid password or corrupted data.');
  }
};

// Helper function to parse share URL
export const parseShareUrl = (url: string) => {
  try {
    const hash = new URL(url).hash.substring(1);
    const params = new URLSearchParams(hash);
    
    return {
      token: params.get('t'),
      encryptedData: params.get('d'),
      iv: params.get('i'),
      key: params.get('k')
    };
  } catch (error) {
    throw new Error('Invalid share URL');
  }
};
