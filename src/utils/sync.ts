/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ProjectorState, Song, Background, ProjectorMessage } from '../types';
import { DEFAULT_SONGS, DEFAULT_BACKGROUNDS } from '../data';

const CHANNEL_NAME = 'church_projector_sync';
const STATE_KEY = 'church_projector_state';
const SONGS_KEY = 'church_projector_songs';
const BACKGROUNDS_KEY = 'church_projector_backgrounds';

export const INITIAL_STATE: ProjectorState = {
  activeSongId: null,
  activeSlideIndex: 0,
  activeBackgroundId: 'bg-preset-1',
  isBlackout: false,
  isHideLetters: false,
  isForceDimmed: null, // null means auto-dim based on whether song is loaded
  fontSize: 100,      // 100px default font size for better readability on projectors
  fontColor: '#ffffff',
  isBold: true,
  alignment: 'center',
  shadowEnabled: true,
  isCameraActive: false,
  cameraDeviceId: null,
  solidBackgroundColor: '#121214',
  activeVideoId: null,
  activeVideoUrl: null,
  isVideoPlaying: false,
  videoCurrentTime: 0,
  videoDuration: 0,
  isTickerActive: false,
  tickerText: '¡Bienvenidos a nuestra celebración litúrgica en vivo! — Proyector Católico',
  tickerColor: '#b91c1c', // red-700 / crimson style
  tickerTextColor: '#ffffff',
  tickerFontSize: 16,
  tickerBgImg: null,
  tickerSpeed: 5,
  tickerOpacity: 80,
  tickerHideBg: false,
  isRotationEnabled: false,
  rotationIntervalMinutes: 5,
  rotateBackgroundWithSongs: false,
  showWeatherOnProjector: false,
  weatherTemp: '',
  weatherDesc: '',
  weatherFontSize: 35,
  isAutoFontSize: false,
  showSaintOnProjector: false,
  saintName: '',
  saintType: '',
  saintBio: '',
};

// Pure utility functions to interact with LocalStorage safely (handles sandboxed iframe restrictions)
let memoryStorage: Record<string, string> = {};

function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    return memoryStorage[key] || null;
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    memoryStorage[key] = value;
  }
}

export function saveLocalState(state: ProjectorState): void {
  safeSetItem(STATE_KEY, JSON.stringify(state));
}

export function getLocalState(): ProjectorState {
  const saved = safeGetItem(STATE_KEY);
  if (saved) {
    try {
      return { ...INITIAL_STATE, ...JSON.parse(saved) };
    } catch {
      return INITIAL_STATE;
    }
  }
  return INITIAL_STATE;
}

export function saveLocalSongs(songs: Song[]): void {
  safeSetItem(SONGS_KEY, JSON.stringify(songs));
}

export function getLocalSongs(defaults: Song[]): Song[] {
  const saved = safeGetItem(SONGS_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      return defaults;
    }
  }
  return defaults;
}

export function saveLocalBackgrounds(bgs: Background[]): void {
  safeSetItem(BACKGROUNDS_KEY, JSON.stringify(bgs));
}

export function getLocalBackgrounds(defaults: Background[]): Background[] {
  const saved = safeGetItem(BACKGROUNDS_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      return defaults;
    }
  }
  return defaults;
}

// Broadcast communication class with fallback for sandboxed contexts
export class ProjectorHub {
  private channel: BroadcastChannel | null = null;
  private onMessageCallback: ((msg: ProjectorMessage) => void) | null = null;
  private storageEventListener: ((event: StorageEvent) => void) | null = null;
  private customEventListener: ((event: Event) => void) | null = null;

  constructor() {
    // 1. Try BroadcastChannel with robust security error shielding
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel(CHANNEL_NAME);
        this.channel.onmessage = (event) => {
          if (this.onMessageCallback) {
            this.onMessageCallback(event.data);
          }
        };
      } catch (e) {
        console.warn('BroadcastChannel creation was blocked by sandbox permissions. Falling back safely...', e);
        this.channel = null;
      }
    }

    // 2. Set up cross-window storage event fallback for dual-window support
    if (typeof window !== 'undefined') {
      this.storageEventListener = (event: StorageEvent) => {
        if ((event.key === STATE_KEY || event.key === SONGS_KEY || event.key === BACKGROUNDS_KEY) && this.onMessageCallback) {
          // Recreate state message from storage when changes happen
          try {
            const state = getLocalState();
            const songs = getLocalSongs(DEFAULT_SONGS);
            const backgrounds = getLocalBackgrounds(DEFAULT_BACKGROUNDS);
            this.onMessageCallback({
              type: 'STATE_CHANGED',
              state,
              songs,
              backgrounds
            });
          } catch (err) {
            console.error('Storage sync recovery failed', err);
          }
        }
      };

      window.addEventListener('storage', this.storageEventListener);

      // Same-tab / same-frame custom event notifier
      this.customEventListener = (event: Event) => {
        const customEv = event as CustomEvent<ProjectorMessage>;
        if (this.onMessageCallback && customEv.detail) {
          this.onMessageCallback(customEv.detail);
        }
      };
      window.addEventListener('church_projector_sync_event', this.customEventListener);
    }
  }

  public subscribe(callback: (msg: ProjectorMessage) => void): () => void {
    this.onMessageCallback = callback;
    return () => {
      this.onMessageCallback = null;
    };
  }

  public broadcast(msg: ProjectorMessage): void {
    // 1. Try standard BroadcastChannel
    if (this.channel) {
      try {
        this.channel.postMessage(msg);
      } catch (e) {
        // Suppress or handle silent postMessage exceptions
      }
    }

    // 2. Also dispatch as custom event for same-tab listeners
    if (typeof window !== 'undefined') {
      try {
        const event = new CustomEvent<ProjectorMessage>('church_projector_sync_event', {
          detail: msg
        });
        window.dispatchEvent(event);
      } catch (e) {
        // safe-catch
      }

      // If state changed, trigger storage fallback by rewriting key to fire storage-event
      if (msg.type === 'STATE_CHANGED') {
        try {
          saveLocalState(msg.state);
        } catch (e) {
          // safe-catch
        }
      }
    }
  }

  public close(): void {
    if (this.channel) {
      this.channel.close();
    }
    if (typeof window !== 'undefined') {
      if (this.storageEventListener) {
        window.removeEventListener('storage', this.storageEventListener);
      }
      if (this.customEventListener) {
        window.removeEventListener('church_projector_sync_event', this.customEventListener);
      }
    }
  }
}
