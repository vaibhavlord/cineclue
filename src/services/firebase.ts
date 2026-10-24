import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, onSnapshot, setDoc, Firestore } from 'firebase/firestore';
import { RoomState } from '../types/multiplayer';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
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
