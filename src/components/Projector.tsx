/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ProjectorState, Song, Background, ProjectorMessage } from '../types';
import { DEFAULT_SONGS, DEFAULT_BACKGROUNDS } from '../data';
import { getLocalState, getLocalSongs, getLocalBackgrounds, ProjectorHub } from '../utils/sync';
import { useResolvedVideoUrl } from '../utils/db';

const hexToRgba = (hex: string, opacityPercent: number) => {
  let clean = hex.replace('#', '');
  if (clean.length === 3) {
    clean = clean.split('').map(char => char + char).join('');
  }
  if (clean.length === 6) {
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacityPercent / 100})`;
  }
  return hex;
};

export default function Projector({ isPreviewMonitor = false }: { isPreviewMonitor?: boolean }) {
  const [state, setState] = useState<ProjectorState>(getLocalState);
  const [songs, setSongs] = useState<Song[]>(() => getLocalSongs(DEFAULT_SONGS));
  const [backgrounds, setBackgrounds] = useState<Background[]>(() => getLocalBackgrounds(DEFAULT_BACKGROUNDS));

  useEffect(() => {
    document.title = isPreviewMonitor ? 'VISTA PREVIA EN VIVO' : 'SISTEMA DE PROYECCIÓN';
  }, [isPreviewMonitor]);

  const [controllerVideoUrl, setControllerVideoUrl] = useState<string | null>(null);
  const [controllerBackgroundUrl, setControllerBackgroundUrl] = useState<string | null>(null);

  const localResolvedVideoUrl = useResolvedVideoUrl(state.activeVideoUrl);
  const resolvedVideoUrl = useMemo(() => {
    if (!state.activeVideoUrl) return null;
    if (state.activeVideoUrl.startsWith('db://')) {
      return localResolvedVideoUrl;
    }
    if (state.activeVideoUrl.startsWith('blob:')) {
      return localResolvedVideoUrl;
    }
    return state.activeVideoUrl;
  }, [state.activeVideoUrl, localResolvedVideoUrl]);

  const projectorVideoRef = useRef<HTMLVideoElement>(null);

  // Sync state transitions & video coordinators
  useEffect(() => {
    const video = projectorVideoRef.current;
    if (video) {
      video.muted = true;
      const targetUrl = controllerVideoUrl || resolvedVideoUrl;
      if (targetUrl) {
        if (state.isVideoPlaying) {
          video.play().catch(e => console.warn('Projector live background video play failed:', e));
        } else {
          video.pause();
        }
      }
    }
  }, [state.isVideoPlaying, controllerVideoUrl, resolvedVideoUrl]);

  // Sync current timeline
  useEffect(() => {
    const video = projectorVideoRef.current;
    if (video && state.videoCurrentTime !== undefined) {
      const delta = Math.abs(video.currentTime - state.videoCurrentTime);
      if (delta > 0.4) {
        video.currentTime = state.videoCurrentTime;
      }
    }
  }, [state.videoCurrentTime]);

  const hub = useMemo(() => new ProjectorHub(), []);

  // Sync communication
  useEffect(() => {
    const handleSyncState = (
      newState: ProjectorState,
      newSongs?: Song[],
      newBgs?: Background[],
      resVid?: string | null,
      resBg?: string | null
    ) => {
      setState(prev => {
        const keys1 = Object.keys(prev) as (keyof ProjectorState)[];
        const keys2 = Object.keys(newState) as (keyof ProjectorState)[];
        if (keys1.length !== keys2.length) return newState;
        for (const key of keys1) {
          if (prev[key] !== newState[key]) {
            return newState;
          }
        }
        return prev;
      });
      if (newSongs && Array.isArray(newSongs) && newSongs.length > 0) {
        setSongs(newSongs);
      }
      if (newBgs && Array.isArray(newBgs) && newBgs.length > 0) {
        setBackgrounds(newBgs);
      }
      if (resVid !== undefined) {
        setControllerVideoUrl(resVid);
      }
      if (resBg !== undefined) {
        setControllerBackgroundUrl(resBg);
      }
    };

    const unsubscribe = hub.subscribe((message: ProjectorMessage) => {
      if (message.type === 'STATE_CHANGED') {
        handleSyncState(
          message.state,
          message.songs,
          message.backgrounds,
          message.resolvedVideoUrl,
          message.resolvedBackgroundUrl
        );
      } else if (message.type === 'PING') {
        hub.broadcast({ type: 'PONG', hasActiveProjector: true });
      }
    });

    const pollInterval = setInterval(() => {
      try {
        let foundDirectSync = false;
        try {
          const opener = window.opener || (window.parent && window.parent !== window ? window.parent : null);
          if (opener) {
            const shared = (opener as any).__CHURCH_PROJECTOR_SHARED_DATA__;
            if (shared && shared.state) {
              handleSyncState(
                shared.state,
                shared.songs,
                shared.backgrounds,
                shared.resolvedVideoUrl,
                shared.resolvedBackgroundUrl
              );
              foundDirectSync = true;
            }
            if (isPreviewMonitor) {
              (opener as any).__CHURCH_PREVIEW_ACTIVE_TIMESTAMP__ = Date.now();
            } else {
              (opener as any).__CHURCH_PROJECTOR_ACTIVE_TIMESTAMP__ = Date.now();
            }
          }
        } catch (openerErr) {}

        if (!foundDirectSync) {
          const polledState = getLocalState();
          const polledSongs = getLocalSongs(DEFAULT_SONGS);
          const polledBackgrounds = getLocalBackgrounds(DEFAULT_BACKGROUNDS);
          handleSyncState(polledState, polledSongs, polledBackgrounds);
        }
      } catch (err) {
        console.error('Projector sync polling error:', err);
      }
    }, 150);

    hub.broadcast({ type: 'PONG', hasActiveProjector: !isPreviewMonitor, hasActivePreview: isPreviewMonitor });
    const pingInterval = setInterval(() => {
      hub.broadcast({ type: 'PONG', hasActiveProjector: !isPreviewMonitor, hasActivePreview: isPreviewMonitor });
      try {
        const opener = window.opener || (window.parent && window.parent !== window ? window.parent : null);
        if (opener) {
          if (isPreviewMonitor) {
            (opener as any).__CHURCH_PREVIEW_ACTIVE_TIMESTAMP__ = Date.now();
          } else {
            (opener as any).__CHURCH_PROJECTOR_ACTIVE_TIMESTAMP__ = Date.now();
          }
        }
      } catch (e) {}
    }, 1500);

    return () => {
      unsubscribe();
      clearInterval(pollInterval);
      clearInterval(pingInterval);
      hub.close();
    };
  }, [hub]);

  // Derived state items
  const activeSong = useMemo(() => {
    if (!state.activeSongId) return null;
    return songs.find(s => s.id === state.activeSongId) || null;
  }, [state.activeSongId, songs]);

  const activeBackground = useMemo(() => {
    if (state.activeBackgroundId === 'solid') {
      return {
        id: 'solid',
        name: 'Color Sólido',
        url: state.solidBackgroundColor || '#121214',
        type: 'image'
      } as Background;
    }
    return backgrounds.find(bg => bg.id === state.activeBackgroundId) || backgrounds[0];
  }, [state.activeBackgroundId, backgrounds, state.solidBackgroundColor]);

  const localResolvedBackgroundUrl = useResolvedVideoUrl(activeBackground?.url);

  // CLONE PREVIEW BACKGROUND IMAGE PATH RESOLUTION (Bulletproof matching)
  const safeBackgroundUrl = useMemo(() => {
    if (controllerBackgroundUrl) return controllerBackgroundUrl;
    if (!activeBackground?.url) return '';
    if (activeBackground.url.startsWith('db://') || activeBackground.url.startsWith('blob:')) {
      return localResolvedBackgroundUrl || '';
    }
    return activeBackground.url;
  }, [activeBackground, controllerBackgroundUrl, localResolvedBackgroundUrl]);

  const previewBgInline = useMemo(() => {
    if (state.activeBackgroundId === 'solid') {
      return { backgroundColor: state.solidBackgroundColor || '#121214' };
    }
    if (activeBackground?.type === 'gradient') {
      return { background: activeBackground?.url };
    }
    return { 
      backgroundImage: safeBackgroundUrl ? `url(${safeBackgroundUrl})` : 'none', 
      backgroundSize: 'cover', 
      backgroundPosition: 'center' 
    };
  }, [activeBackground, state.activeBackgroundId, state.solidBackgroundColor, safeBackgroundUrl]);

  // CLONE PREVIEW VIDEO PLAYBACK (Bulletproof matching)
  const mainPreviewVideoUrl = useMemo(() => {
    if (!state.activeVideoUrl) return null;
    return controllerVideoUrl || resolvedVideoUrl || null;
  }, [state.activeVideoUrl, controllerVideoUrl, resolvedVideoUrl]);

  const isCurrentlyPreviewDimmed = useMemo(() => {
    if (state.isForceDimmed !== null) return state.isForceDimmed;
    return !!(activeSong && !state.isHideLetters && activeSong.slides[state.activeSlideIndex]);
  }, [state.isForceDimmed, activeSong, state.isHideLetters, state.activeSlideIndex]);

  // Blackout override
  if (state.isBlackout) {
    return (
      <div id="projector-blackout-screen" className="fixed inset-0 bg-black cursor-none select-none z-[9999]" />
    );
  }

  // Adjust font size scaling helper
  const projectedFontSize = useMemo(() => {
    if (activeSong && activeSong.slides[state.activeSlideIndex]) {
      const text = activeSong.slides[state.activeSlideIndex];
      if (state.isAutoFontSize && text) {
        const len = text.length;
        if (len > 80) {
          const factor = Math.max(0.4, 80 / len);
          return Math.max(32, Math.floor(state.fontSize * factor));
        }
      }
    }
    return state.fontSize;
  }, [state.isAutoFontSize, activeSong, state.activeSlideIndex, state.fontSize]);

  return (
    <div 
      id="projector-container"
      className="fixed inset-0 bg-black overflow-hidden flex flex-col justify-center items-center select-none cursor-none z-50 text-center"
    >
      {/* 1. Underlying Background with exact cloned styles of the preview */}
      {activeBackground?.type === 'video' ? (
        <video
          src={safeBackgroundUrl || ''}
          className="absolute inset-0 w-full h-full object-cover transition-all duration-500 z-0"
          style={{ opacity: isCurrentlyPreviewDimmed ? 0.35 : 1 }}
          autoPlay
          muted
          loop
          playsInline
        />
      ) : (
        <div 
          className="absolute inset-0 transition-all duration-500 z-0"
          style={{
            ...previewBgInline,
            opacity: isCurrentlyPreviewDimmed ? 0.35 : 1
          }}
        />
      )}

      {/* 2. Actual video loop overlay if playing */}
      {mainPreviewVideoUrl && (
        <video
          ref={projectorVideoRef}
          key={mainPreviewVideoUrl}
          src={mainPreviewVideoUrl}
          className="absolute inset-0 w-full h-full object-cover z-10"
          style={{ opacity: isCurrentlyPreviewDimmed ? 0.35 : 1 }}
          autoPlay={state.isVideoPlaying}
          muted
          loop
          playsInline
        />
      )}

      {/* 3. Darkening contrast overlay */}
      <div 
        className={`absolute inset-0 bg-black/25 transition-opacity duration-500 z-20 ${
          isCurrentlyPreviewDimmed ? 'opacity-100' : 'opacity-0'
        }`} 
      />

      {/* 4. Weather info box (if enabled & config is available & no song is playing) */}
      {state.showWeatherOnProjector && !state.activeSongId && (state.weatherTemp || state.weatherDesc) && (
        <div 
          style={{
            zIndex: 40,
            fontSize: `${state.weatherFontSize || 35}px`,
            color: '#ef4444',
            fontWeight: 800,
            fontFamily: 'system-ui, -apple-system, sans-serif',
            textShadow: '0 2px 8px rgba(0,0,0,0.85), 0 1px 3px rgba(0,0,0,0.95)'
          }}
          className="absolute top-6 right-8 pointer-events-none select-none flex items-center gap-2 drop-shadow-xl font-sans"
        >
          <span>{state.weatherDesc ? state.weatherDesc.split(' ')[0] : '☀️'}</span>
          <span>{state.weatherTemp}</span>
        </div>
      )}

      {/* 5. Slides, Lyrics image/text exactly as structured in preview box but full dimensions */}
      <div style={{ zIndex: 30 }} className="relative w-full max-w-[95vw] mx-auto flex flex-col justify-center min-h-[60vh] pb-12 px-12 md:px-24">
        <AnimatePresence mode="wait">
          {!state.isHideLetters && activeSong && (activeSong.slides[state.activeSlideIndex] || (activeSong.slideImages && activeSong.slideImages[state.activeSlideIndex])) ? (
            <motion.div
              key={`${state.activeSongId}-${state.activeSlideIndex}`}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.25 }}
              className={`w-full leading-snug tracking-wide flex flex-col items-center justify-center`}
              style={{
                fontSize: `${projectedFontSize}px`,
                color: state.fontColor,
                fontWeight: state.isBold ? 700 : 500,
                textShadow: state.shadowEnabled 
                  ? '0px 4px 10px rgba(0, 0, 0, 0.95), 0px 2px 4px rgba(0, 0, 0, 0.9)' 
                  : 'none',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                textAlign: state.alignment
              }}
            >
              {/* Slide image if present */}
              {activeSong.slideImages && activeSong.slideImages[state.activeSlideIndex] && (
                <div className="flex justify-center items-center mb-6 select-none">
                  <img
                    referrerPolicy="no-referrer"
                    src={activeSong.slideImages[state.activeSlideIndex]}
                    alt="Ilustración de estrofa"
                    className="max-h-[50vh] w-auto max-w-[85vw] object-contain rounded-xl border border-white/20 shadow-2xl transition-all duration-300"
                  />
                </div>
              )}

              {/* Slide text if present */}
              {activeSong.slides[state.activeSlideIndex] && (
                <div className="w-full">
                  {activeSong.slides[state.activeSlideIndex].split('\n').map((line, lidx) => (
                    <div key={lidx} className="mb-2 last:mb-0">
                      {line}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* 6. Santoral católico legend overlay (if active & no active song is loaded) */}
      <AnimatePresence>
        {state.showSaintOnProjector && !state.activeSongId && state.saintName && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            style={{
              zIndex: 35,
              bottom: state.isTickerActive && state.tickerText ? `${Math.max(64, (state.tickerFontSize || 16) * 2.3) + 24}px` : '32px'
            }}
            className="absolute left-1/2 -translate-x-1/2 w-[90%] max-w-[850px] bg-black/85 backdrop-blur-md rounded-xl border border-yellow-500/40 px-6 py-4 shadow-[0_15px_40px_rgba(0,0,0,0.8)] flex flex-col md:flex-row items-center gap-3 md:gap-5 select-none pointer-events-none transition-all duration-300"
          >
            <div className="flex items-center gap-2.5 shrink-0 justify-center">
              <span className="text-2xl animate-pulse">😇</span>
              <div className="flex flex-col text-left">
                <span className="text-[12px] font-black tracking-wider uppercase font-sans leading-none">
                  <span className="text-white">SANTORAL </span>
                  <span className="text-yellow-400">DE HOY</span>
                </span>
                <span className="text-[9px] font-mono font-bold text-yellow-500/90 uppercase tracking-widest mt-1 leading-none">
                  CATÓLICO ARGENTINO
                </span>
              </div>
              <div className="h-8 w-[1px] bg-zinc-800 hidden md:block mx-3" />
            </div>

            <div className="flex-grow text-center md:text-left leading-snug">
              <div className="flex items-baseline gap-2 flex-wrap justify-center md:justify-start border-b border-zinc-800/60 pb-1 mb-1.5">
                <span className="text-[16px] font-black text-yellow-400 font-sans tracking-tight">
                  {state.saintName}
                </span>
                {state.saintType && (
                  <span className="text-[11px] text-yellow-300/90 font-bold italic">
                    — {state.saintType}
                  </span>
                )}
              </div>
              {state.saintBio && (
                <p className="text-[12.5px] text-zinc-300 font-medium font-sans leading-relaxed text-justify">
                  {state.saintBio}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 7. Cloned News styled bottom ticker scrolling bar */}
      {state.isTickerActive && state.tickerText && (
        <div 
          style={{ 
            backgroundColor: state.tickerHideBg ? 'transparent' : (state.tickerBgImg ? 'transparent' : hexToRgba(state.tickerColor, state.tickerOpacity ?? 80)),
            backgroundImage: state.tickerHideBg ? 'none' : (state.tickerBgImg ? `url(${state.tickerBgImg})` : 'none'),
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            zIndex: 40,
            height: `${Math.max(64, (state.tickerFontSize || 16) * 2.3)}px`
          }} 
          className={`absolute bottom-0 left-0 right-0 flex items-center font-sans overflow-hidden transition-all duration-300 ${
            state.tickerHideBg ? '' : 'shadow-[0_-5px_25px_rgba(0,0,0,0.6)] border-t border-white/10 backdrop-blur-md'
          }`}
        >
          <div className={`flex-grow overflow-hidden relative w-full h-full flex items-center select-none ${
            state.tickerHideBg ? '' : 'bg-black/10'
          }`}>
            <p 
              className="animate-marquee whitespace-nowrap font-bold tracking-wide select-none"
              style={{ 
                fontSize: `${state.tickerFontSize || 16}px`,
                color: state.tickerTextColor || '#ffffff',
                animationDuration: `${Math.max(4, 50 - (state.tickerSpeed || 5) * 4.5)}s`
              }}
            >
              {state.tickerText}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
