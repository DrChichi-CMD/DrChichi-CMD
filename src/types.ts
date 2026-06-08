/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Song {
  id: string;
  title: string;
  author?: string;
  lyrics: string;
  slides: string[]; // split by slides/verses
  isVideo?: boolean;
  videoUrl?: string;
  slideImages?: string[]; // Optional images for each slide (e.g., base64 or URLs)
}

export interface Background {
  id: string;
  name: string;
  url: string; // can be base64 image, unsplash url, or gradient style string
  type: 'image' | 'gradient' | 'video';
  isCustom?: boolean;
}

export interface ProjectorState {
  activeSongId: string | null;
  activeSlideIndex: number;
  activeBackgroundId: string | null;
  isBlackout: boolean;          // Complete black screen override
  isHideLetters: boolean;       // Hide lyric text but keep background
  isForceDimmed: boolean | null; // null = auto dim when lyrics loaded, true = force dim, false = force normal
  fontSize: number;             // font size level (e.g., 24 - 120px)
  fontColor: string;            // hex or tailwind text color
  isBold: boolean;
  alignment: 'center' | 'left' | 'right';
  shadowEnabled: boolean;
  
  // Real-time Camera backgrounds (USB devices / Mobile cameras)
  isCameraActive: boolean;
  cameraDeviceId: string | null;

  // Solid background color control
  solidBackgroundColor: string;

  // Selected video overlay/background loops
  activeVideoId: string | null;
  activeVideoUrl: string | null;
  isVideoPlaying: boolean;
  videoCurrentTime?: number;
  videoDuration?: number;

  // Background auto-rotation settings
  isRotationEnabled?: boolean;
  rotationIntervalMinutes?: number;
  rotateBackgroundWithSongs?: boolean;

  // News style ticker banners for custom announcements
  isTickerActive: boolean;
  tickerText: string;
  tickerColor: string;
  tickerTextColor?: string;
  tickerFontSize?: number;
  tickerBgImg?: string | null;
  tickerSpeed?: number;
  tickerOpacity?: number;
  tickerHideBg?: boolean;

  // Weather display sync fields
  showWeatherOnProjector?: boolean;
  weatherTemp?: string;
  weatherDesc?: string;
  weatherFontSize?: number;
  isAutoFontSize?: boolean;
}

// Broadcast message interface for syncing controller with projector window
export type ProjectorMessage = 
  | { 
      type: 'STATE_CHANGED'; 
      state: ProjectorState; 
      songs: Song[]; 
      backgrounds: Background[];
      resolvedVideoUrl?: string | null;
      resolvedBackgroundUrl?: string | null;
    }
  | { type: 'PING' }
  | { type: 'PONG'; hasActiveProjector: boolean };
