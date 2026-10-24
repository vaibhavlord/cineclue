import { RoomState } from '../types/multiplayer';
import { MovieFilters } from '../types/movie';
import { syncRoomStateToFirestore } from './firebase';

export async function createRoom(
  hostName: string,
  filters: MovieFilters
): Promise<{ code: string; playerId: string; room: RoomState }> {
  const res = await fetch('/api/multiplayer/room/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostName, filters }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw new Error(data.error || 'Failed to create room.');
  }

  if (data.room) {
    await syncRoomStateToFirestore(data.room);
  }
  return data;
}

export async function joinRoom(
  code: string,
  playerName: string
): Promise<{ playerId: string; room: RoomState }> {
  const res = await fetch('/api/multiplayer/room/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, playerName }),
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error || 'Failed to join room.');
  }

  if (data.room) {
    await syncRoomStateToFirestore(data.room);
  }
  return data;
}

export async function startMatch(code: string, playerId: string): Promise<RoomState> {
  const res = await fetch('/api/multiplayer/room/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, playerId }),
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error || 'Failed to start match.');
  }

  if (data.room) {
    await syncRoomStateToFirestore(data.room);
  }
  return data.room;
}

export async function submitGuess(
  code: string,
  playerId: string,
  guess: string,
  movieIndex: number
): Promise<{ isCorrect: boolean; awarded: boolean; message?: string; room?: RoomState }> {
  const res = await fetch('/api/multiplayer/room/guess', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, playerId, guess, movieIndex }),
  });

  const data = await res.json();
  if (data.room) {
    await syncRoomStateToFirestore(data.room);
  }
  return data;
}

export async function leaveRoom(code: string, playerId: string): Promise<void> {
  try {
    const res = await fetch('/api/multiplayer/room/leave', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, playerId }),
    });
    const data = await res.json();
    if (data.room) {
      await syncRoomStateToFirestore(data.room);
    }
  } catch {
    // Ignore leave errors
  }
}

export async function fetchRoom(code: string): Promise<RoomState | null> {
  try {
    const res = await fetch(`/api/multiplayer/room/${code}`);
    if (res.ok) {
      const data = await res.json();
      return data.room || null;
    }
  } catch {
    // Ignore fetch error
  }
  return null;
}
