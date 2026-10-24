import { RoomState } from '../types/multiplayer';
import { MovieFilters } from '../types/movie';
import { syncRoomStateToFirestore } from './firebase';
import {
  createMultiplayerRoom,
  joinMultiplayerRoom,
  startMultiplayerMatch,
  submitMultiplayerGuess,
  leaveMultiplayerRoom,
  getMultiplayerRoom,
} from '../game/multiplayerManager';

export async function createRoom(
  hostName: string,
  filters: MovieFilters
): Promise<{ code: string; playerId: string; room: RoomState }> {
  try {
    const res = await fetch('/api/multiplayer/room/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostName, filters }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.code && data?.room) {
        await syncRoomStateToFirestore(data.room);
        return data;
      }
    }
  } catch (err) {
    console.warn('API createRoom failed, activating direct Firestore sync:', err);
  }

  // Direct Firestore Fallback (bulletproof across all serverless & edge hosts)
  const result = await createMultiplayerRoom(hostName, filters);
  await syncRoomStateToFirestore(result.room);
  return result;
}

export async function joinRoom(
  code: string,
  playerName: string
): Promise<{ playerId: string; room: RoomState }> {
  const normCode = code.trim().toUpperCase();

  try {
    const res = await fetch('/api/multiplayer/room/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: normCode, playerName }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.playerId && data?.room) {
        await syncRoomStateToFirestore(data.room);
        return data;
      }
    }
  } catch (err) {
    console.warn('API joinRoom failed, activating direct Firestore sync:', err);
  }

  const result = await joinMultiplayerRoom(normCode, playerName);
  if ('error' in result) {
    throw new Error(result.error);
  }

  await syncRoomStateToFirestore(result.room);
  return result;
}

export async function startMatch(
  code: string,
  playerId: string,
  knownRoom?: RoomState
): Promise<RoomState> {
  const normCode = code.trim().toUpperCase();

  // If host already has both players in their synchronized room state, persist to Firestore first
  if (knownRoom && Object.keys(knownRoom.players || {}).length >= 2) {
    await syncRoomStateToFirestore(knownRoom);
  }

  try {
    const res = await fetch('/api/multiplayer/room/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: normCode, playerId }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.room) {
        await syncRoomStateToFirestore(data.room);
        return data.room;
      }
    }
  } catch (err) {
    console.warn('API startMatch failed, activating direct Firestore sync:', err);
  }

  const result = await startMultiplayerMatch(normCode, playerId);
  if ('error' in result) {
    throw new Error(result.error);
  }

  await syncRoomStateToFirestore(result.room);
  return result.room;
}

export async function submitGuess(
  code: string,
  playerId: string,
  guess: string,
  movieIndex: number
): Promise<{ isCorrect: boolean; awarded: boolean; message?: string; room?: RoomState }> {
  const normCode = code.trim().toUpperCase();

  try {
    const res = await fetch('/api/multiplayer/room/guess', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: normCode, playerId, guess, movieIndex }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.room) {
        await syncRoomStateToFirestore(data.room);
      }
      return data;
    }
  } catch (err) {
    console.warn('API submitGuess failed, activating direct Firestore sync:', err);
  }

  const result = await submitMultiplayerGuess(normCode, playerId, guess, movieIndex);
  if (result.room) {
    await syncRoomStateToFirestore(result.room);
  }
  return result;
}

export async function leaveRoom(code: string, playerId: string): Promise<void> {
  const normCode = code.trim().toUpperCase();

  try {
    const res = await fetch('/api/multiplayer/room/leave', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: normCode, playerId }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.room) {
        await syncRoomStateToFirestore(data.room);
        return;
      }
    }
  } catch {
    // Fall back to direct
  }

  try {
    const result = await leaveMultiplayerRoom(normCode, playerId);
    if ('room' in result && result.room) {
      await syncRoomStateToFirestore(result.room);
    }
  } catch {
    // Ignore leave error
  }
}

export async function fetchRoom(code: string): Promise<RoomState | null> {
  const normCode = code.trim().toUpperCase();

  try {
    const res = await fetch(`/api/multiplayer/room/${normCode}`);
    if (res.ok) {
      const data = await res.json();
      if (data?.room) return data.room;
    }
  } catch {
    // Fall back to direct
  }

  try {
    const result = await getMultiplayerRoom(normCode);
    if ('error' in result) return null;
    return result.room || null;
  } catch {
    return null;
  }
}
