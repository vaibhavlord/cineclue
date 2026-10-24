import React, { useState, useEffect } from 'react';
import { RoomState } from '../types/multiplayer';
import { MovieFilters } from '../types/movie';
import {
  createRoom,
  joinRoom,
  startMatch,
  leaveRoom,
} from '../services/multiplayerService';
import {
  subscribeToMultiplayerRoom,
  isFirebaseConfigured,
  ensureFirebaseConfig,
} from '../services/firebase';
import {
  Users,
  Copy,
  Check,
  Play,
  ArrowLeft,
  SlidersHorizontal,
  Flame,
  Radio,
  Share2,
  AlertCircle,
  Info,
  ExternalLink,
  X,
} from 'lucide-react';
import { playProjectorClick } from '../utils/audio';

interface MultiplayerLobbyProps {
  currentFilters: MovieFilters;
  onOpenFilters: () => void;
  onBackToTitle: () => void;
  onMatchStarted: (room: RoomState, myPlayerId: string) => void;
  initialRoomCode?: string;
}

export const MultiplayerLobby: React.FC<MultiplayerLobbyProps> = ({
  currentFilters,
  onOpenFilters,
  onBackToTitle,
  onMatchStarted,
  initialRoomCode = '',
}) => {
  const [modeTab, setModeTab] = useState<'create' | 'join'>('create');
  const [playerName, setPlayerName] = useState<string>(() => {
    return localStorage.getItem('cineclue_mp_name') || '';
  });
  const [joinCodeInput, setJoinCodeInput] = useState<string>(initialRoomCode.toUpperCase());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [showFirebaseModal, setShowFirebaseModal] = useState<boolean>(false);
  const [firebaseReady, setFirebaseReady] = useState<boolean>(() => isFirebaseConfigured());

  // Check and load Firebase config from serverless endpoint if needed
  useEffect(() => {
    ensureFirebaseConfig().then((ready) => {
      setFirebaseReady(ready);
    });
  }, []);

  // Active in-lobby room state
  const [currentRoom, setCurrentRoom] = useState<RoomState | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string>('');

  // Persist player name
  const updatePlayerName = (name: string) => {
    setPlayerName(name);
    try {
      localStorage.setItem('cineclue_mp_name', name);
    } catch {
      // Ignore
    }
  };

  // If initialRoomCode is provided, switch to join tab
  useEffect(() => {
    if (initialRoomCode) {
      setModeTab('join');
      setJoinCodeInput(initialRoomCode.toUpperCase());
    }
  }, [initialRoomCode]);

  // Subscribe to real-time room updates once in a room
  useEffect(() => {
    if (!currentRoom?.code) return;

    const unsubscribe = subscribeToMultiplayerRoom(
      currentRoom.code,
      (updatedRoom) => {
        setCurrentRoom(updatedRoom);
        if (updatedRoom.status === 'playing') {
          onMatchStarted(updatedRoom, myPlayerId);
        }
      },
      (err) => {
        console.warn('Real-time sync notice:', err);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [currentRoom?.code, myPlayerId, onMatchStarted]);

  const handleCreateRoom = async () => {
    playProjectorClick();
    setErrorMessage('');
    setIsLoading(true);
    try {
      const name = playerName.trim() || 'Player 1';
      updatePlayerName(name);
      const res = await createRoom(name, currentFilters);
      setMyPlayerId(res.playerId);
      setCurrentRoom(res.room);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create room.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    playProjectorClick();
    setErrorMessage('');
    const code = joinCodeInput.trim().toUpperCase();
    if (!code || code.length < 4) {
      setErrorMessage('Please enter a valid 6-character room code.');
      return;
    }

    setIsLoading(true);
    try {
      const name = playerName.trim() || 'Player 2';
      updatePlayerName(name);
      const res = await joinRoom(code, name);
      setMyPlayerId(res.playerId);
      setCurrentRoom(res.room);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to join room.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartMatch = async () => {
    if (!currentRoom || !myPlayerId) return;
    playProjectorClick();
    setErrorMessage('');
    setIsLoading(true);
    try {
      const updated = await startMatch(currentRoom.code, myPlayerId);
      setCurrentRoom(updated);
      onMatchStarted(updated, myPlayerId);
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not start match.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeaveLobby = async () => {
    playProjectorClick();
    if (currentRoom && myPlayerId) {
      await leaveRoom(currentRoom.code, myPlayerId);
    }
    setCurrentRoom(null);
    setMyPlayerId('');
    setErrorMessage('');
  };

  const handleCopyCode = () => {
    if (!currentRoom?.code) return;
    navigator.clipboard.writeText(currentRoom.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    if (!currentRoom?.code) return;
    const url = `${window.location.origin}${window.location.pathname}?room=${currentRoom.code}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const playersList = currentRoom ? Object.values(currentRoom.players) : [];
  const isHost = currentRoom && currentRoom.hostId === myPlayerId;
  const canStart = isHost && playersList.length === 2;

  const filterSummary = [
    ...(currentFilters.countries.length > 0 ? currentFilters.countries : ['All Countries']),
    ...(currentFilters.decades.length > 0 ? currentFilters.decades : ['All Decades']),
  ].join(' • ');

  // ----------------------------------------------------
  // VIEW A: LOBBY SCREEN (WHEN ROOM IS JOINED / CREATED)
  // ----------------------------------------------------
  if (currentRoom) {
    return (
      <div className="min-h-screen w-full bg-[#141413] text-[#FDF5E1] flex flex-col justify-between select-none">
        {/* Top Header */}
        <header className="w-full border-b border-white/[0.08]">
          <div className="max-w-[1180px] mx-auto px-6 sm:px-10 h-[72px] flex items-center justify-between">
            <button
              onClick={handleLeaveLobby}
              className="flex items-center gap-2 text-sm text-[#8E8A82] hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Leave Lobby</span>
            </button>

            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#EC5A49] animate-pulse" />
              <span className="font-mono-code text-xs text-[#EC5A49] tracking-widest uppercase">
                1V1 ONLINE LOBBY
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowFirebaseModal(true)}
              className="text-xs font-mono-code flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-colors cursor-pointer"
              style={{
                backgroundColor: firebaseReady ? 'rgba(234, 241, 138, 0.1)' : 'rgba(236, 90, 73, 0.15)',
                borderColor: firebaseReady ? 'rgba(234, 241, 138, 0.3)' : 'rgba(236, 90, 73, 0.4)',
                color: firebaseReady ? '#EAF18A' : '#EC5A49',
              }}
              title="Firebase Connection Status"
            >
              <Radio className="w-3 h-3" />
              <span>{firebaseReady ? 'Firestore Connected' : 'Setup Firebase'}</span>
            </button>
          </div>
        </header>

        {/* Main Lobby Container */}
        <main className="flex-1 max-w-[860px] mx-auto w-full px-6 py-8 flex flex-col justify-center">
          <div className="bg-[#1C1C1B] border border-white/[0.1] rounded-[24px] p-6 sm:p-10 shadow-2xl relative overflow-hidden">
            {/* Top Room Code Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
              <div>
                <span className="font-mono-code text-[11px] uppercase tracking-widest text-[#8E8A82]">
                  SHARE THIS CODE TO INVITE
                </span>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="font-cinema text-4xl sm:text-5xl text-[#FDF5E1] tracking-wider select-all">
                    {currentRoom.code}
                  </span>
                  <button
                    onClick={handleCopyCode}
                    className="p-2 rounded-xl bg-[#282827] hover:bg-[#333332] text-neutral-300 hover:text-white transition-colors flex items-center gap-1.5 text-xs cursor-pointer border border-white/10"
                    title="Copy Room Code"
                  >
                    {copiedCode ? <Check className="w-4 h-4 text-[#EAF18A]" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                  </button>
                  <button
                    onClick={handleCopyLink}
                    className="p-2 rounded-xl bg-[#282827] hover:bg-[#333332] text-neutral-300 hover:text-white transition-colors flex items-center gap-1.5 text-xs cursor-pointer border border-white/10"
                    title="Copy Invite Link"
                  >
                    {copiedLink ? <Check className="w-4 h-4 text-[#EAF18A]" /> : <Share2 className="w-4 h-4" />}
                    <span>{copiedLink ? 'Link Copied' : 'Share Link'}</span>
                  </button>
                </div>
              </div>

              {/* Match Rules Badge */}
              <div className="text-left sm:text-right">
                <span className="font-mono-code text-[11px] uppercase tracking-widest text-[#EC5A49]">
                  MATCH FORMAT
                </span>
                <p className="text-sm text-[#FDF5E1] font-medium mt-1">
                  60s Speed Duel &bull; 1 Pt per First Solve
                </p>
                <p className="text-xs text-[#8E8A82] mt-0.5">
                  {filterSummary}
                </p>
              </div>
            </div>

            {/* Players Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-8">
              {/* Slot 1: Host */}
              <div className="rounded-2xl p-5 bg-[#252524] border border-white/10 flex flex-col justify-between min-h-[140px] relative">
                <div className="flex items-center justify-between">
                  <span className="font-mono-code text-[11px] tracking-widest uppercase text-[#EC5A49] font-bold">
                    HOST / PLAYER 1
                  </span>
                  <span className="w-2.5 h-2.5 rounded-full bg-[#EAF18A]" />
                </div>
                <div>
                  <h3 className="font-cinema text-3xl text-white truncate">
                    {playersList[0]?.name || 'Player 1'}
                  </h3>
                  <p className="text-xs text-[#8E8A82] mt-1">
                    {playersList[0]?.id === myPlayerId ? '(You)' : 'Opponent'} &bull; Ready
                  </p>
                </div>
              </div>

              {/* Slot 2: Challenger */}
              <div className={`rounded-2xl p-5 border flex flex-col justify-between min-h-[140px] relative ${
                playersList.length >= 2
                  ? 'bg-[#252524] border-white/10'
                  : 'bg-[#181817] border-dashed border-white/15'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="font-mono-code text-[11px] tracking-widest uppercase text-[#C2B6EF] font-bold">
                    CHALLENGER / PLAYER 2
                  </span>
                  {playersList.length >= 2 ? (
                    <span className="w-2.5 h-2.5 rounded-full bg-[#EAF18A]" />
                  ) : (
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
                  )}
                </div>

                <div>
                  {playersList.length >= 2 ? (
                    <>
                      <h3 className="font-cinema text-3xl text-white truncate">
                        {playersList[1]?.name || 'Player 2'}
                      </h3>
                      <p className="text-xs text-[#8E8A82] mt-1">
                        {playersList[1]?.id === myPlayerId ? '(You)' : 'Opponent'} &bull; Joined & Ready
                      </p>
                    </>
                  ) : (
                    <>
                      <h3 className="text-lg font-medium text-neutral-400 flex items-center gap-2">
                        <Users className="w-5 h-5 text-neutral-500 animate-bounce" />
                        <span>Waiting for opponent...</span>
                      </h3>
                      <p className="text-xs text-[#8E8A82] mt-1">
                        Give code <strong className="text-white">{currentRoom.code}</strong> to player 2
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="mb-4 p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs">
                {errorMessage}
              </div>
            )}

            {/* Action Bar */}
            <div className="pt-4 border-t border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-[#8E8A82]">
                {playersList.length < 2
                  ? 'Match will unlock once Player 2 joins with this code.'
                  : isHost
                  ? 'Both players are ready! Click Start to begin the 60-second battle.'
                  : 'Waiting for host to launch the battle...'}
              </div>

              {isHost ? (
                <button
                  type="button"
                  disabled={!canStart || isLoading}
                  onClick={handleStartMatch}
                  className={`w-full sm:w-auto px-8 h-[54px] rounded-2xl flex items-center justify-center gap-2.5 font-cinema text-2xl tracking-wider uppercase transition-all cursor-pointer ${
                    canStart
                      ? 'bg-[#EC5A49] hover:bg-[#F26655] text-[#141413] shadow-[0_4px_0_0_#873329] active:translate-y-[2px]'
                      : 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-white/5'
                  }`}
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>{isLoading ? 'Starting...' : 'Start 60s Battle'}</span>
                </button>
              ) : (
                <div className="flex items-center gap-2 text-sm text-[#C2B6EF] font-mono-code animate-pulse">
                  <span>Waiting for host to start...</span>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ----------------------------------------------------
  // VIEW B: CREATE OR JOIN ENTRY SCREEN
  // ----------------------------------------------------
  return (
    <div className="min-h-screen w-full bg-[#141413] text-[#FDF5E1] flex flex-col justify-between select-none">
      {/* Top Header */}
      <header className="w-full border-b border-white/[0.08]">
        <div className="max-w-[1180px] mx-auto px-6 sm:px-10 h-[72px] flex items-center justify-between">
          <button
            onClick={onBackToTitle}
            className="flex items-center gap-2 text-sm text-[#8E8A82] hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Menu</span>
          </button>

          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-[#EC5A49]" />
            <span className="font-cinema text-xl text-[#EC5A49] tracking-wider uppercase">
              1V1 MULTIPLAYER DUEL
            </span>
          </div>

          <div className="w-20" />
        </div>
      </header>

      {/* Main Form Container */}
      <main className="flex-1 max-w-[620px] mx-auto w-full px-6 py-8 flex flex-col justify-center">
        <div className="bg-[#1C1C1B] border border-white/[0.1] rounded-[24px] p-6 sm:p-9 shadow-2xl">
          {/* Header */}
          <div className="text-center mb-6">
            <span className="font-mono-code text-[11px] uppercase tracking-widest text-[#EC5A49] font-bold">
              REAL-TIME CINEPHILE HEAD-TO-HEAD
            </span>
            <h1 className="font-cinema text-4xl sm:text-5xl text-white mt-1">
              PROVE WHO KNOWS FILM BEST
            </h1>
            <p className="text-sm text-[#9A948A] mt-2 max-w-md mx-auto">
              Same film. Same clues. 60 seconds on the clock. First to buzz in with the right title scores.
            </p>

            {!firebaseReady && (
              <div className="mt-4 p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-200 text-xs text-left flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-semibold text-white block">Firebase Setup Required for Online Multiplayer</span>
                  <span className="text-[11px] text-amber-200/80 mt-0.5 block">
                    Connecting two devices across the internet requires a free Firebase Firestore project for real-time room sync.
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowFirebaseModal(true)}
                    className="mt-1.5 text-[11px] font-bold text-amber-300 hover:text-white underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>View Quick 2-Min Setup Guide</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 p-1 bg-[#141414] rounded-2xl border border-white/10 mb-6">
            <button
              type="button"
              onClick={() => {
                playProjectorClick();
                setModeTab('create');
                setErrorMessage('');
              }}
              className={`py-3 rounded-xl font-mono-code text-xs font-bold tracking-wider uppercase transition-colors cursor-pointer ${
                modeTab === 'create'
                  ? 'bg-[#292928] text-white shadow-sm'
                  : 'text-[#8E8A82] hover:text-white'
              }`}
            >
              Create New Room
            </button>
            <button
              type="button"
              onClick={() => {
                playProjectorClick();
                setModeTab('join');
                setErrorMessage('');
              }}
              className={`py-3 rounded-xl font-mono-code text-xs font-bold tracking-wider uppercase transition-colors cursor-pointer ${
                modeTab === 'join'
                  ? 'bg-[#292928] text-white shadow-sm'
                  : 'text-[#8E8A82] hover:text-white'
              }`}
            >
              Join with Code
            </button>
          </div>

          {/* Player Name Input */}
          <div className="mb-5">
            <label className="block font-mono-code text-[11px] uppercase tracking-widest text-[#C9C3B8] mb-2 font-medium">
              Your Player Name
            </label>
            <input
              type="text"
              maxLength={20}
              placeholder="e.g. CinemaMaster"
              value={playerName}
              onChange={(e) => updatePlayerName(e.target.value)}
              className="w-full h-12 px-4 rounded-xl bg-[#141414] border border-white/15 text-white placeholder-neutral-500 focus:outline-none focus:border-[#EC5A49] font-medium transition-colors"
            />
          </div>

          {/* TAB 1: CREATE ROOM */}
          {modeTab === 'create' && (
            <div className="space-y-5">
              {/* Active Movie Filters Box */}
              <div className="p-4 rounded-xl bg-[#141414] border border-white/10 flex items-center justify-between">
                <div>
                  <span className="font-mono-code text-[10px] uppercase tracking-wider text-[#8E8A82] block">
                    MOVIE ARCHIVE POOL
                  </span>
                  <span className="text-xs text-white font-medium mt-0.5 block truncate max-w-[260px]">
                    {filterSummary}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onOpenFilters}
                  className="px-3 py-1.5 rounded-lg bg-[#262626] hover:bg-[#333333] border border-white/10 text-xs text-neutral-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Change</span>
                </button>
              </div>

              {errorMessage && (
                <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs">
                  {errorMessage}
                </div>
              )}

              <button
                type="button"
                disabled={isLoading}
                onClick={handleCreateRoom}
                className="w-full h-14 rounded-2xl bg-[#EC5A49] hover:bg-[#F26655] text-[#141413] font-cinema text-2xl tracking-wider uppercase transition-all shadow-[0_4px_0_0_#873329] active:translate-y-[2px] flex items-center justify-center gap-2 cursor-pointer"
              >
                <Users className="w-5 h-5 fill-current" />
                <span>{isLoading ? 'Creating Room...' : 'Create 1v1 Room'}</span>
              </button>
            </div>
          )}

          {/* TAB 2: JOIN ROOM */}
          {modeTab === 'join' && (
            <div className="space-y-5">
              <div>
                <label className="block font-mono-code text-[11px] uppercase tracking-widest text-[#C9C3B8] mb-2 font-medium">
                  Room Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="e.g. CLUE42"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                  className="w-full h-14 px-4 rounded-xl bg-[#141414] border border-white/15 text-white font-cinema text-3xl tracking-widest text-center uppercase placeholder-neutral-600 focus:outline-none focus:border-[#EC5A49] transition-colors"
                />
              </div>

              {errorMessage && (
                <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs">
                  {errorMessage}
                </div>
              )}

              <button
                type="button"
                disabled={isLoading}
                onClick={handleJoinRoom}
                className="w-full h-14 rounded-2xl bg-[#C2B6EF] hover:bg-[#D5CCFA] text-[#141413] font-cinema text-2xl tracking-wider uppercase transition-all shadow-[0_4px_0_0_#594F82] active:translate-y-[2px] flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>{isLoading ? 'Joining Room...' : 'Enter Battle Room'}</span>
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Firebase Quick Setup Modal */}
      {showFirebaseModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1C1C1B] border border-white/10 rounded-2xl max-w-lg w-full p-6 sm:p-7 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <div className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-[#EC5A49]" />
                <h3 className="font-cinema text-2xl text-white">FIREBASE 2-MIN SETUP</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowFirebaseModal(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs text-[#C2BCB0] leading-relaxed">
              <div className="p-3.5 rounded-xl bg-[#141414] border border-white/5">
                <span className="font-bold text-white block mb-1">1. Create a Free Firebase Project</span>
                <span>Go to <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer" className="text-[#EC5A49] underline font-medium">console.firebase.google.com</a> and click <strong>Add project</strong>.</span>
              </div>

              <div className="p-3.5 rounded-xl bg-[#141414] border border-white/5">
                <span className="font-bold text-white block mb-1">2. Enable Cloud Firestore Database</span>
                <span>In the sidebar, navigate to <strong>Build &gt; Firestore Database</strong>, click <strong>Create database</strong>, and select <strong>Start in test mode</strong>.</span>
              </div>

              <div className="p-3.5 rounded-xl bg-[#141414] border border-white/5">
                <span className="font-bold text-white block mb-1">3. Register a Web App &amp; Copy Keys</span>
                <span>Click the <strong>Web (&lt;/&gt;)</strong> icon under "Get started by adding Firebase to your app". Copy the 6 configuration keys.</span>
              </div>

              <div className="p-3.5 rounded-xl bg-[#141414] border border-white/5">
                <span className="font-bold text-white block mb-1">4. Add Environment Variables</span>
                <span>Add these keys to your <strong>.env</strong> file (for local testing) and to your <strong>Vercel Project Settings &gt; Environment Variables</strong> (for production):</span>
                <pre className="mt-2 p-2.5 rounded-lg bg-black text-[#EAF18A] font-mono-code text-[10px] overflow-x-auto select-all">
VITE_FIREBASE_API_KEY="AIzaSy..."
VITE_FIREBASE_AUTH_DOMAIN="your-app.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="your-app"
VITE_FIREBASE_STORAGE_BUCKET="your-app.firebasestorage.app"
VITE_FIREBASE_MESSAGING_SENDER_ID="123456789"
VITE_FIREBASE_APP_ID="1:123456789:web:abcdef"
                </pre>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowFirebaseModal(false)}
              className="mt-6 w-full h-11 rounded-xl bg-[#EC5A49] hover:bg-[#F26655] text-[#141413] font-cinema text-lg uppercase tracking-wider transition-colors cursor-pointer"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
