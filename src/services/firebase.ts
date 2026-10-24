import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  onSnapshot,
  setDoc,
  getDoc,
  Firestore,
} from 'firebase/firestore';
import { RoomState } from '../types/multiplayer';

function getEnv(key: string): string {
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key] || '';
  }
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
      return (import.meta as any).env[key] || '';
    }
  } catch {
    // Ignore
  }
  return '';
}

const firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY') || getEnv('FIREBASE_API_KEY'),
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN') || getEnv('FIREBASE_AUTH_DOMAIN'),
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID') || getEnv('FIREBASE_PROJECT_ID'),
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET') || getEnv('FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID') || getEnv('FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnv('VITE_FIREBASE_APP_ID') || getEnv('FIREBASE_APP_ID'),
};

export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.apiKey.trim().length > 0 &&
    firebaseConfig.projectId &&
    firebaseConfig.projectId.trim().length > 0
  );
}

let firestoreInstance: Firestore | null = null;

export function getFirestoreDb(): Firestore | null {
  if (!isFirebaseConfigured()) return null;
  if (!firestoreInstance) {
    try {
      const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      firestoreInstance = getFirestore(app);
    } catch (err) {
      console.warn('Firebase initialization error, using server sync fallback:', err);
      return null;
    }
  }
  return firestoreInstance;
}

/**
 * Subscribes to real-time room state updates.
 * Uses Firebase Firestore onSnapshot when configured, otherwise falls back to server polling.
 */
export function subscribeToMultiplayerRoom(
  code: string,
  onUpdate: (room: RoomState) => void,
  onError?: (err: any) => void
): () => void {
  const normCode = code.trim().toUpperCase();
  const db = getFirestoreDb();

  if (db) {
    try {
      const roomDocRef = doc(db, 'multiplayer_rooms', normCode);
      const unsubscribe = onSnapshot(
        roomDocRef,
        (snapshot) => {
          if (snapshot.exists()) {
            onUpdate(snapshot.data() as RoomState);
          }
        },
        (error) => {
          console.warn('Firestore onSnapshot error, falling back to server polling:', error);
          if (onError) onError(error);
        }
      );
      return unsubscribe;
    } catch (e) {
      console.warn('Firestore subscription failed, using server polling fallback:', e);
    }
  }

  // Fallback: Synchronize via server API polling (every 800ms)
  let active = true;
  const poll = async () => {
    if (!active) return;
    try {
      const res = await fetch(`/api/multiplayer/room/${normCode}`);
      if (res.ok) {
        const data = await res.json();
        if (data.room && active) {
          onUpdate(data.room);
        }
      }
    } catch {
      // Ignore transient network errors
    }
  };

  poll();
  const interval = setInterval(poll, 800);

  return () => {
    active = false;
    clearInterval(interval);
  };
}

/**
 * Pushes room state to Firestore when Firebase is configured.
 */
export async function syncRoomStateToFirestore(room: RoomState): Promise<void> {
  const db = getFirestoreDb();
  if (!db || !room || !room.code) return;

  try {
    const roomDocRef = doc(db, 'multiplayer_rooms', room.code.trim().toUpperCase());
    await setDoc(roomDocRef, room, { merge: true });
  } catch (err) {
    console.warn('Could not sync to Firestore:', err);
  }
}

/**
 * Fetches a room state from Firestore (used by serverless functions and client).
 */
export async function fetchRoomFromFirestore(code: string): Promise<RoomState | null> {
  const db = getFirestoreDb();
  if (!db || !code) return null;

  try {
    const roomDocRef = doc(db, 'multiplayer_rooms', code.trim().toUpperCase());
    const snap = await getDoc(roomDocRef);
    if (snap.exists()) {
      return snap.data() as RoomState;
    }
  } catch (err) {
    console.warn('Could not fetch room from Firestore:', err);
  }
  return null;
}

/**
 * Fetches secret titles for server-side verification from private collection.
 */
export async function fetchRoomSecretsFromFirestore(code: string): Promise<string[] | null> {
  const db = getFirestoreDb();
  if (!db || !code) return null;

  try {
    const secretDocRef = doc(db, 'multiplayer_secrets', code.trim().toUpperCase());
    const snap = await getDoc(secretDocRef);
    if (snap.exists()) {
      const data = snap.data();
      return Array.isArray(data.secretTitles) ? data.secretTitles : null;
    }
  } catch (err) {
    console.warn('Could not fetch secrets from Firestore:', err);
  }
  return null;
}

/**
 * Persists room state and secret titles to Firestore.
 */
export async function saveRoomToFirestore(
  state: RoomState,
  secretTitles?: string[]
): Promise<void> {
  const db = getFirestoreDb();
  if (!db || !state || !state.code) return;
  const normCode = state.code.trim().toUpperCase();

  try {
    const roomDocRef = doc(db, 'multiplayer_rooms', normCode);
    await setDoc(roomDocRef, state, { merge: true });

    if (secretTitles && secretTitles.length > 0) {
      const secretDocRef = doc(db, 'multiplayer_secrets', normCode);
      await setDoc(secretDocRef, { secretTitles, updatedAt: Date.now() }, { merge: true });
    }
  } catch (err) {
    console.warn('Could not save room to Firestore:', err);
  }
}
