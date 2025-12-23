export interface Note {
  id: string;
  title: string;
  // The encrypted content is an object containing the ciphertext and IV
  encryptedContent: {
    iv: string;
    data: string;
  };
  language: string;
  createdAt: number;
  updatedAt: number;
}

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  // Salt is stored as a base64 string
  salt: string;
}

// In-memory store for the session's CryptoKey for better security
let sessionKey: CryptoKey | null = null;

const NOTES_KEY = "zks_notes";
const USER_KEY = "zks_user";

export const getNotes = (): Note[] => {
  try {
    const data = localStorage.getItem(NOTES_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("Failed to parse notes from localStorage", e);
    return [];
  }
};

export const saveNote = (note: Note): void => {
  const notes = getNotes();
  const existingIndex = notes.findIndex((n) => n.id === note.id);

  if (existingIndex >= 0) {
    notes[existingIndex] = note;
  } else {
    notes.push(note);
  }

  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
};

export const deleteNote = (id: string): void => {
  const notes = getNotes().filter((n) => n.id !== id);
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
};

export const getUser = (): User | null => {
  try {
    const data = localStorage.getItem(USER_KEY);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error("Failed to parse user from localStorage", e);
    return null;
  }
};

export const saveUser = (user: User): void => {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

/**
 * Retrieves the session's encryption key.
 * @returns The CryptoKey if it exists in the current session.
 */
export const getSessionKey = (): CryptoKey | null => {
  return sessionKey;
};

/**
 * Stores the session's encryption key in memory.
 * @param key The CryptoKey to save for the session.
 */
export const saveSessionKey = (key: CryptoKey): void => {
  sessionKey = key;
};

/**
 * Clears the session's encryption key from memory.
 */
export const clearSession = (): void => {
  sessionKey = null;
};

export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};
