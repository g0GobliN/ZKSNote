export interface Note {
  id: string;
  title: string;
  encryptedContent: string;
  language: string;
  createdAt: number;
  updatedAt: number;
}

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  salt: string;
}

const NOTES_KEY = 'zks_notes';
const USER_KEY = 'zks_user';
const SESSION_KEY = 'zks_session';

export const getNotes = (): Note[] => {
  const data = localStorage.getItem(NOTES_KEY);
  return data ? JSON.parse(data) : [];
};

export const saveNote = (note: Note): void => {
  const notes = getNotes();
  const existingIndex = notes.findIndex(n => n.id === note.id);
  
  if (existingIndex >= 0) {
    notes[existingIndex] = note;
  } else {
    notes.push(note);
  }
  
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
};

export const deleteNote = (id: string): void => {
  const notes = getNotes().filter(n => n.id !== id);
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
};

export const getUser = (): User | null => {
  const data = localStorage.getItem(USER_KEY);
  return data ? JSON.parse(data) : null;
};

export const saveUser = (user: User): void => {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const getSession = (): { encryptionKey: string } | null => {
  const data = sessionStorage.getItem(SESSION_KEY);
  return data ? JSON.parse(data) : null;
};

export const saveSession = (encryptionKey: string): void => {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ encryptionKey }));
};

export const clearSession = (): void => {
  sessionStorage.removeItem(SESSION_KEY);
};

export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};
