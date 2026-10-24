import { RoomState, MultiplayerMovieSafe, MultiplayerPlayer } from '../types/multiplayer';
import { MovieFilters, Movie } from '../types/movie';
import { MOVIE_DATABASE } from '../data/movies';
import { checkTitleMatch, matchesMovieFilters } from './rules';
import {
  fetchRoomFromFirestore,
  fetchRoomSecretsFromFirestore,
  saveRoomToFirestore,
} from '../services/firebase';

export interface InternalRoomRecord {
  state: RoomState;
  secretTitles: string[];
}

const rooms = new Map<string, InternalRoomRecord>();

// Generate short, human-friendly 6-character room code (e.g. "CLUE88")
export function generateRoomCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // exclude ambiguous 0, 1, I, O
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function sanitizeMovieForClient(movie: Movie): MultiplayerMovieSafe {
  // Strip out secret title so client cannot inspect DOM or network
  return {
    id: movie.id,
    year: movie.year,
    decade: movie.decade,
    country: movie.country,
    director: movie.director,
    genres: movie.genres,
    difficulty: movie.difficulty,
    emojiCryptogram: movie.emojiCryptogram,
    tagline: {
      prompt: movie.tagline.prompt,
      blank: movie.tagline.blank,
      full: movie.tagline.full,
    },
    quote: {
      dialogue: movie.quote.dialogue,
      speakerRole: movie.quote.speakerRole,
      context: movie.quote.context,
    },
    minimalistArt: movie.minimalistArt,
    castDossier: movie.castDossier,
    boxOfficeTrivia: movie.boxOfficeTrivia,
    screenshots: movie.screenshots,
    posterUrl: movie.posterUrl,
    backdropUrl: movie.backdropUrl,
  };
}

async function getInternalRoomRecord(code: string): Promise<InternalRoomRecord | null> {
  const normCode = code.trim().toUpperCase();
  const cached = rooms.get(normCode);

  // Always query Firestore first for authoritative, real-time room state across all devices
  try {
    const [remoteState, remoteSecrets] = await Promise.all([
      fetchRoomFromFirestore(normCode),
      fetchRoomSecretsFromFirestore(normCode),
    ]);

    if (remoteState) {
      const secretTitles =
        remoteSecrets ||
        cached?.secretTitles ||
        remoteState.movieList.map((m) => m.tagline?.blank || '');

      const record: InternalRoomRecord = {
        state: remoteState,
        secretTitles,
      };
      rooms.set(normCode, record);
      return record;
    }
  } catch (err) {
    console.warn('Could not query Firestore for room:', err);
  }

  // Fallback to in-memory cached record if Firestore is unreachable
  if (cached) return cached;

  return null;
}

async function persistRoomRecord(record: InternalRoomRecord): Promise<void> {
  const normCode = record.state.code.trim().toUpperCase();
  rooms.set(normCode, record);
  try {
    await saveRoomToFirestore(record.state, record.secretTitles);
  } catch (err) {
    console.warn('Could not persist room record to Firestore:', err);
  }
}

export async function createMultiplayerRoom(
  hostName: string,
  filters: MovieFilters = { countries: [], decades: [] }
): Promise<{ code: string; playerId: string; room: RoomState }> {
  // Clean up stale rooms older than 2 hours
  const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
  for (const [c, r] of rooms.entries()) {
    if (r.state.createdAt < twoHoursAgo) {
      rooms.delete(c);
    }
  }

  let code = generateRoomCode();
  while (rooms.has(code)) {
    code = generateRoomCode();
  }

  const hostId = `player_${Math.random().toString(36).substring(2, 9)}`;

  // Filter movies and select 30 distinct non-repeating candidates
  const matching = MOVIE_DATABASE.filter((m) => matchesMovieFilters(m, filters));
  const pool = matching.length >= 10 ? matching : MOVIE_DATABASE;

  // Shuffle pool using Fisher-Yates
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const selectedMovies = shuffled.slice(0, 30);
  const secretTitles = selectedMovies.map((m) => m.title);
  const safeMovies = selectedMovies.map(sanitizeMovieForClient);

  const hostPlayer: MultiplayerPlayer = {
    id: hostId,
    name: hostName.trim() || 'Player 1',
    score: 0,
    isHost: true,
    connected: true,
    joinedAt: Date.now(),
  };

  const roomState: RoomState = {
    code,
    createdAt: Date.now(),
    status: 'lobby',
    hostId,
    players: {
      [hostId]: hostPlayer,
    },
    filters,
    matchDurationSeconds: 60,
    matchStartTime: null,
    matchEndTime: null,
    currentMovieIndex: 0,
    currentMovieSolvedBy: null,
    currentMovieSolvedTitle: null,
    solvedHistory: [],
    movieList: safeMovies,
    winnerId: null,
    isTie: false,
    recentEvent: {
      type: 'join',
      message: `${hostPlayer.name} created the room.`,
      playerId: hostId,
      timestamp: Date.now(),
    },
  };

  const internalRecord: InternalRoomRecord = {
    state: roomState,
    secretTitles,
  };

  await persistRoomRecord(internalRecord);

  return {
    code,
    playerId: hostId,
    room: roomState,
  };
}

export async function joinMultiplayerRoom(
  code: string,
  playerName: string
): Promise<{ playerId: string; room: RoomState } | { error: string }> {
  const normCode = code.trim().toUpperCase();
  const record = await getInternalRoomRecord(normCode);
  if (!record) {
    return { error: 'Room not found. Check the code and try again.' };
  }

  const { state } = record;
  if (state.status !== 'lobby') {
    return { error: 'Match is already in progress or has ended.' };
  }

  const existingPlayers = Object.values(state.players);
  if (existingPlayers.length >= 2) {
    return { error: 'Room is full (maximum 2 players).' };
  }

  const playerId = `player_${Math.random().toString(36).substring(2, 9)}`;
  const newPlayer: MultiplayerPlayer = {
    id: playerId,
    name: playerName.trim() || 'Player 2',
    score: 0,
    isHost: false,
    connected: true,
    joinedAt: Date.now(),
  };

  state.players[playerId] = newPlayer;
  state.recentEvent = {
    type: 'join',
    message: `${newPlayer.name} joined the room!`,
    playerId,
    timestamp: Date.now(),
  };

  await persistRoomRecord(record);

  return {
    playerId,
    room: state,
  };
}

export async function startMultiplayerMatch(
  code: string,
  playerId: string
): Promise<{ room: RoomState } | { error: string }> {
  const normCode = code.trim().toUpperCase();
  const record = await getInternalRoomRecord(normCode);
  if (!record) {
    return { error: 'Room not found.' };
  }

  const { state } = record;
  if (state.hostId !== playerId) {
    return { error: 'Only the host can start the match.' };
  }

  const players = Object.values(state.players);
  if (players.length < 2) {
    return { error: 'Cannot start until both players have joined.' };
  }

  if (state.status !== 'lobby') {
    return { error: 'Match has already started.' };
  }

  const now = Date.now();
  state.status = 'playing';
  state.matchStartTime = now;
  state.matchEndTime = now + state.matchDurationSeconds * 1000;
  state.currentMovieIndex = 0;
  state.currentMovieSolvedBy = null;
  state.currentMovieSolvedTitle = null;
  state.winnerId = null;
  state.isTie = false;
  state.recentEvent = {
    type: 'start',
    message: 'The 60-second battle has begun!',
    timestamp: now,
  };

  await persistRoomRecord(record);

  return { room: state };
}

export async function submitMultiplayerGuess(
  code: string,
  playerId: string,
  guess: string,
  movieIndex: number
): Promise<{
  isCorrect: boolean;
  awarded: boolean;
  room?: RoomState;
  message?: string;
}> {
  const normCode = code.trim().toUpperCase();
  const record = await getInternalRoomRecord(normCode);
  if (!record) {
    return { isCorrect: false, awarded: false, message: 'Room not found.' };
  }

  const { state, secretTitles } = record;

  // Check if time expired
  if (checkAndFinalizeRoom(state)) {
    await persistRoomRecord(record);
    return { isCorrect: false, awarded: false, room: state, message: 'Time is up!' };
  }

  if (state.status !== 'playing') {
    return { isCorrect: false, awarded: false, room: state, message: 'Match is not active.' };
  }

  const player = state.players[playerId];
  if (!player) {
    return { isCorrect: false, awarded: false, message: 'Player not recognized.' };
  }

  // Anti-race condition lock:
  // If the movie has already advanced, this guess arrived too late
  if (movieIndex !== state.currentMovieIndex) {
    return {
      isCorrect: false,
      awarded: false,
      room: state,
      message: 'Movie was already solved by your opponent!',
    };
  }

  const targetTitle = secretTitles[movieIndex];
  if (!targetTitle) {
    return { isCorrect: false, awarded: false, room: state, message: 'Invalid movie.' };
  }

  const isMatch = checkTitleMatch(guess, targetTitle);
  if (!isMatch) {
    return { isCorrect: false, awarded: false, room: state, message: 'Incorrect guess.' };
  }

  // Atomically award 1 point to first player to submit correct answer
  player.score += 1;
  state.currentMovieSolvedBy = playerId;
  state.currentMovieSolvedTitle = targetTitle;

  state.solvedHistory.push({
    movieIndex,
    title: targetTitle,
    year: state.movieList[movieIndex]?.year || 2000,
    solvedByPlayerId: playerId,
    solvedByPlayerName: player.name,
    timestamp: Date.now(),
  });

  state.recentEvent = {
    type: 'solve',
    message: `${player.name} guessed "${targetTitle}"! (+1 pt)`,
    playerId,
    timestamp: Date.now(),
  };

  // Advance to next movie
  state.currentMovieIndex += 1;
  state.currentMovieSolvedBy = null;

  // If pool exhausted early, end match
  if (state.currentMovieIndex >= state.movieList.length) {
    finalizeRoomState(state);
  }

  await persistRoomRecord(record);

  return {
    isCorrect: true,
    awarded: true,
    room: state,
    message: `Correct! You scored 1 point for ${targetTitle}.`,
  };
}

export async function leaveMultiplayerRoom(
  code: string,
  playerId: string
): Promise<{ room?: RoomState }> {
  const normCode = code.trim().toUpperCase();
  const record = await getInternalRoomRecord(normCode);
  if (!record) return {};

  const { state } = record;
  const leavingPlayer = state.players[playerId];

  if (state.status === 'playing') {
    // Other player wins by forfeit
    state.status = 'abandoned';
    state.abandonedReason = `${leavingPlayer?.name || 'A player'} left the match.`;
    const remaining = Object.values(state.players).find((p) => p.id !== playerId);
    if (remaining) {
      state.winnerId = remaining.id;
    }
    state.recentEvent = {
      type: 'leave',
      message: `${leavingPlayer?.name || 'A player'} disconnected.`,
      playerId,
      timestamp: Date.now(),
    };
  } else if (state.status === 'lobby') {
    delete state.players[playerId];
    if (Object.keys(state.players).length === 0) {
      rooms.delete(normCode);
      return {};
    }
    // If host left, assign remaining player as host
    const remaining = Object.values(state.players)[0];
    if (remaining) {
      remaining.isHost = true;
      state.hostId = remaining.id;
    }
  }

  await persistRoomRecord(record);

  return { room: state };
}

export async function getMultiplayerRoom(code: string): Promise<{ room?: RoomState; error?: string }> {
  const normCode = code.trim().toUpperCase();
  const record = await getInternalRoomRecord(normCode);
  if (!record) {
    return { error: 'Room not found.' };
  }

  const finalized = checkAndFinalizeRoom(record.state);
  if (finalized) {
    await persistRoomRecord(record);
  }

  return { room: record.state };
}

function checkAndFinalizeRoom(state: RoomState): boolean {
  if (state.status === 'playing' && state.matchEndTime && Date.now() >= state.matchEndTime) {
    finalizeRoomState(state);
    return true;
  }
  return false;
}

function finalizeRoomState(state: RoomState): void {
  state.status = 'ended';
  const players = Object.values(state.players);
  if (players.length >= 2) {
    const [p1, p2] = players;
    if (p1.score > p2.score) {
      state.winnerId = p1.id;
      state.isTie = false;
    } else if (p2.score > p1.score) {
      state.winnerId = p2.id;
      state.isTie = false;
    } else {
      state.winnerId = null;
      state.isTie = true;
    }
  }
  state.recentEvent = {
    type: 'timeout',
    message: 'Time is up! Match concluded.',
    timestamp: Date.now(),
  };
}

// For unit testing purposes
export function _resetMultiplayerRooms(): void {
  rooms.clear();
}
export function _getInternalRoom(code: string): InternalRoomRecord | undefined {
  return rooms.get(code.trim().toUpperCase());
}
