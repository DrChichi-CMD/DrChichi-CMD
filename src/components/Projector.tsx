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

export default function Projector() {
  const [state, setState] = useState<ProjectorState>(getLocalState);
  const [songs, setSongs] = useState<Song[]>(() => getLocalSongs(DEFAULT_SONGS));
  const [backgrounds, setBackgrounds] = useState<Background[]>(() => getLocalBackgrounds(DEFAULT_BACKGROUNDS));

  const [controllerVideoUrl, setControllerVideoUrl] = useState<string | null>(null);
  const [controllerBackgroundUrl, setControllerBackgroundUrl] = useState<string | null>(null);

  const localResolvedVideoUrl = useResolvedVideoUrl(state.activeVideoUrl);
  const resolvedVideoUrl = state.activeVideoUrl 
    ? (controllerVideoUrl || localResolvedVideoUrl || state.activeVideoUrl) 
    : null;

  const projectorVideoRef = useRef<HTMLVideoElement>(null);

  const [wifiCams, setWifiCams] = useState<{ id: string; name: string; ip: string; status: 'online' | 'offline' }[]>(() => {
    try {
      const saved = localStorage.getItem('church_wifi_cams');
      return saved ? JSON.parse(saved) : [
        { id: 'wifi-gopro-altar', name: 'GoPro Hero 11 (Altar Wi-Fi)', ip: '10.5.5.9:8080/live/gopro', status: 'online' },
        { id: 'wifi-gopro-pulpito', name: 'GoPro Hero 10 (Púlpito Wi-Fi)', ip: '10.5.5.15:8080/live/pulpito', status: 'online' }
      ];
    } catch (e) {
      return [];
    }
  });

  // Effect to handle play/pause and muted state of background video Loop
  useEffect(() => {
    const video = projectorVideoRef.current;
    if (video) {
      video.muted = true; // Ensure it is programmatically muted to bypass autoplay blocking in all major browsers
      if (resolvedVideoUrl) {
        if (state.isVideoPlaying) {
          video.play().catch(e => console.warn('Projector background video play error:', e));
        } else {
          video.pause();
        }
      }
    }
  }, [state.isVideoPlaying, resolvedVideoUrl, projectorVideoRef.current]);

  // Effect to sync current timeline coordinates exactly
  useEffect(() => {
    const video = projectorVideoRef.current;
    if (video && state.videoCurrentTime !== undefined) {
      const delta = Math.abs(video.currentTime - state.videoCurrentTime);
      if (delta > 0.4) {
        video.currentTime = state.videoCurrentTime;
      }
    }
  }, [state.videoCurrentTime]);

  // Instantiate the sync hub
  const hub = useMemo(() => new ProjectorHub(), []);

  // Robust synchronization: Combined instant-events, direct memory window bus, & robust periodic localStorage-polling fallback
  useEffect(() => {
    const handleSyncState = (
      newState: ProjectorState,
      newSongs?: Song[],
      newBgs?: Background[],
      resVid?: string | null,
      resBg?: string | null
    ) => {
      setState(prev => {
        // Compare only critical structural fields to prevent unnecessary re-renders
        const changed = 
          prev.activeSongId !== newState.activeSongId ||
          prev.activeSlideIndex !== newState.activeSlideIndex ||
          prev.activeBackgroundId !== newState.activeBackgroundId ||
          prev.isBlackout !== newState.isBlackout ||
          prev.isHideLetters !== newState.isHideLetters ||
          prev.isForceDimmed !== newState.isForceDimmed ||
          prev.fontSize !== newState.fontSize ||
          prev.fontColor !== newState.fontColor ||
          prev.isBold !== newState.isBold ||
          prev.alignment !== newState.alignment ||
          prev.shadowEnabled !== newState.shadowEnabled ||
          prev.isCameraActive !== newState.isCameraActive ||
          prev.cameraDeviceId !== newState.cameraDeviceId ||
          prev.activeVideoId !== newState.activeVideoId ||
          prev.activeVideoUrl !== newState.activeVideoUrl ||
          prev.isTickerActive !== newState.isTickerActive ||
          prev.tickerText !== newState.tickerText ||
          prev.tickerColor !== newState.tickerColor ||
          prev.tickerFontSize !== newState.tickerFontSize ||
          prev.tickerBgImg !== newState.tickerBgImg ||
          prev.tickerSpeed !== newState.tickerSpeed ||
          prev.tickerOpacity !== newState.tickerOpacity ||
          prev.tickerTextColor !== newState.tickerTextColor ||
          prev.tickerHideBg !== newState.tickerHideBg ||
          prev.showWeatherOnProjector !== newState.showWeatherOnProjector ||
          prev.weatherTemp !== newState.weatherTemp ||
          prev.weatherDesc !== newState.weatherDesc ||
          prev.isAutoFontSize !== newState.isAutoFontSize;
        return changed ? newState : prev;
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

    // 1. Subscribe to BroadcastChannel & custom events
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

    // 2. Direct Window Bus and LocalStorage Polling (bypasses browser sandoxing iframe blocks of LocalStorage)
    const pollInterval = setInterval(() => {
      try {
        let foundDirectSync = false;
        
        // A. Primary direct window memory sync (extremely fast & immune to iframe sandbox limits)
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
            
            // Send direct memory heartbeat to the controller
            (opener as any).__CHURCH_PROJECTOR_ACTIVE_TIMESTAMP__ = Date.now();
          }
        } catch (openerErr) {
          // If cross-origin/sandbox error occurs, fail-safe to standard LocalStorage
        }

        // B. Secondary standard LocalStorage fallback
        if (!foundDirectSync) {
          const polledState = getLocalState();
          const polledSongs = getLocalSongs(DEFAULT_SONGS);
          const polledBackgrounds = getLocalBackgrounds(DEFAULT_BACKGROUNDS);
          handleSyncState(polledState, polledSongs, polledBackgrounds);
          try {
            const saved = localStorage.getItem('church_wifi_cams');
            if (saved) {
              setWifiCams(JSON.parse(saved));
            }
          } catch(e) {}
        }
      } catch (err) {
        console.error('Projector sync polling error:', err);
      }
    }, 150); // Polling at 150ms for ultra-responsive update feedback

    // 3. Heartbeat and handshaking live indicators
    hub.broadcast({ type: 'PONG', hasActiveProjector: true });
    const pingInterval = setInterval(() => {
      hub.broadcast({ type: 'PONG', hasActiveProjector: true });
      
      // Also register handshake in window opener if available
      try {
        const opener = window.opener || (window.parent && window.parent !== window ? window.parent : null);
        if (opener) {
          (opener as any).__CHURCH_PROJECTOR_ACTIVE_TIMESTAMP__ = Date.now();
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

  // Find active items
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
  const resolvedBackgroundUrl = (activeBackground && activeBackground.id === 'solid')
    ? (state.solidBackgroundColor || '#121214')
    : (controllerBackgroundUrl || localResolvedBackgroundUrl || activeBackground?.url || '');

  // Determine slide text
  const currentSlideText = useMemo(() => {
    if (!activeSong || state.isHideLetters) return '';
    const idx = state.activeSlideIndex;
    if (idx >= 0 && idx < activeSong.slides.length) {
      return activeSong.slides[idx];
    }
    return '';
  }, [activeSong, state.activeSlideIndex, state.isHideLetters]);

  // Determine slide image
  const currentSlideImg = useMemo(() => {
    if (!activeSong || state.isHideLetters) return '';
    const idx = state.activeSlideIndex;
    if (activeSong.slideImages && idx >= 0 && idx < activeSong.slideImages.length) {
      return activeSong.slideImages[idx] || '';
    }
    return '';
  }, [activeSong, state.activeSlideIndex, state.isHideLetters]);

  // Keep static backgrounds mounted underneath as a safety fallback layer so the screen never goes completely black during loading or transition gaps
  const isImageOrSolidHidden = false;

  // Automatic dimming logic:
  // Fades out background colors to low opacity when letters are present to maintain high contrast ("fondo clarito").
  // When no song is loaded or letters are hidden, background remains fully bright.
  const isDimmed = useMemo(() => {
    if (state.isForceDimmed !== null) {
      return state.isForceDimmed;
    }
    return !!(activeSong && !state.isHideLetters && currentSlideText.trim().length > 0);
  }, [state.isForceDimmed, activeSong, state.isHideLetters, currentSlideText]);

  // Dynamic automatic font size scaling helper
  const projectedFontSize = useMemo(() => {
    if (state.isAutoFontSize && currentSlideText) {
      const len = currentSlideText.length;
      if (len > 80) {
        const factor = Math.max(0.4, 80 / len);
        return Math.max(32, Math.floor(state.fontSize * factor));
      }
    }
    return state.fontSize;
  }, [state.isAutoFontSize, currentSlideText, state.fontSize]);

  // Inline styling for background depending on its type
  const backgroundStyle = useMemo(() => {
    if (!activeBackground) return {};
    if (state.activeBackgroundId === 'solid') {
      return { backgroundColor: state.solidBackgroundColor || '#121214' };
    }
    if (activeBackground.type === 'gradient') {
      return { background: activeBackground.url };
    } else {
      return { backgroundImage: `url(${resolvedBackgroundUrl || activeBackground.url})`, backgroundSize: 'cover', backgroundPosition: 'center' };
    }
  }, [activeBackground, state.activeBackgroundId, state.solidBackgroundColor, resolvedBackgroundUrl]);

  // Complete Blackout override
  if (state.isBlackout) {
    return (
      <div id="projector-blackout-screen" className="fixed inset-0 bg-black cursor-none select-none z-[9999]" />
    );
  }

  // Text Alignment classes
  const textAlignmentClass = {
    center: 'text-center',
    left: 'text-left',
    right: 'text-right'
  }[state.alignment] || 'text-center';

  return (
    <div 
      id="projector-container"
      className="fixed inset-0 bg-black overflow-hidden flex flex-col justify-center items-center select-none cursor-none z-50 px-12 md:px-24"
    >
      {/* 1. Underlying Background with animated transitions */}
      <AnimatePresence mode="popLayout">
        {!isImageOrSolidHidden && activeBackground && (
          activeBackground.type === 'video' ? (
            <motion.video
              key={activeBackground?.id || 'empty-bg'}
              src={resolvedBackgroundUrl || activeBackground.url}
              initial={{ opacity: 0 }}
              animate={{ opacity: isDimmed ? 0.35 : 1.0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
              className="absolute inset-0 w-full h-full object-cover z-0 transition-all duration-700"
              autoPlay
              muted
              loop
              playsInline
            />
          ) : (
            <motion.div
              key={activeBackground?.id || 'empty-bg'}
              style={backgroundStyle}
              initial={{ opacity: 0 }}
              animate={{ opacity: isDimmed ? 0.35 : 1.0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
              className="absolute inset-0 z-0 transition-all duration-700"
            />
          )
        )}
      </AnimatePresence>

      {/* Video Background / Main Loop if active */}
      {resolvedVideoUrl && (
        <video
          ref={projectorVideoRef}
          key={resolvedVideoUrl}
          src={resolvedVideoUrl}
          className="absolute inset-0 w-full h-full object-cover z-0"
          style={{ opacity: isDimmed ? 0.35 : 1.0 }}
          autoPlay={state.isVideoPlaying}
          muted
          loop
          playsInline
          onCanPlay={(e) => {
            if (state.isVideoPlaying) {
              e.currentTarget.play().catch(err => console.warn("Video play failed:", err));
            }
          }}
        />
      )}


      {/* Dim Overlay when faded to handle text contrast perfectly on colored slides */}
      <div 
        style={{ zIndex: 2 }}
        className={`absolute inset-0 bg-black/30 pointer-events-none transition-opacity duration-700 ${
          isDimmed ? 'opacity-100' : 'opacity-0'
        }`} 
      />

      {/* Weather overlay on top right corner in red with size 35 if configured and no active song is loaded */}
      {state.showWeatherOnProjector && !state.activeSongId && (state.weatherTemp || state.weatherDesc) && (
        <div 
          style={{
            zIndex: 50,
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

      {/* 2. Lyrics Overlay with custom fluid size and animations */}
      <div style={{ zIndex: 10 }} className="relative w-full max-w-[95vw] mx-auto flex flex-col justify-center min-h-[60vh] pb-12">
        <AnimatePresence mode="wait">
          {currentSlideText || currentSlideImg ? (
            <motion.div
              key={`${state.activeSongId}-${state.activeSlideIndex}`}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className={`w-full ${textAlignmentClass} leading-snug tracking-wide flex flex-col items-center justify-center`}
              style={{
                fontSize: `${projectedFontSize}px`,
                color: state.fontColor,
                fontWeight: state.isBold ? 700 : 500,
                textShadow: state.shadowEnabled 
                  ? '0px 4px 10px rgba(0, 0, 0, 0.95), 0px 2px 4px rgba(0, 0, 0, 0.9)' 
                  : 'none',
                fontFamily: 'system-ui, -apple-system, sans-serif'
              }}
            >
              {currentSlideImg && (
                <div className="flex justify-center items-center mb-4 select-none">
                  <img
                    referrerPolicy="no-referrer"
                    src={currentSlideImg}
                    alt="Ilustración de estrofa"
                    className="max-h-[45vh] w-auto max-w-[85vw] object-contain rounded-xl border border-white/20 shadow-2xl transition-all duration-300"
                  />
                </div>
              )}
              {currentSlideText ? (
                <div className="w-full">
                  {currentSlideText.split('\n').map((line, lIdx) => (
                    <div key={lIdx} className="mb-2 last:mb-0">
                      {line}
                    </div>
                  ))}
                </div>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* 3. News styled Lower third ticker banner */}
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
          {/* Ticker scrolling lane */}
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
