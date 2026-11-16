/**
 * SonioxService
 * Wraps @soniox/speech-to-text-web Client loaded via CDN
 * Optimized for mobile speech-to-text and live translation.
 */
import { SonioxClient, isActiveState } from 'https://unpkg.com/@soniox/speech-to-text-web?module';

const END_TOKEN = '<end>';

export class SonioxService {
  constructor() {
    this.client = null;
    this.apiKey = localStorage.getItem('soniox_api_key') || '';
    this.state = 'Init';
    this.finalTokens = [];
    this.nonFinalTokens = [];
    this.activeStream = null;
    this.wakeLock = null;

    // Listeners map
    this.listeners = {
      stateChange: [],
      partialResult: [],
      started: [],
      finished: [],
      error: []
    };
  }

  setApiKey(key) {
    this.apiKey = (key || '').trim();
    if (this.apiKey) {
      localStorage.setItem('soniox_api_key', this.apiKey);
    } else {
      localStorage.removeItem('soniox_api_key');
    }
  }

  getApiKey() {
    return this.apiKey;
  }

  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
  }

  emit(event, data) {
    if (this.listeners[event]) {
      for (const cb of this.listeners[event]) {
        try {
          cb(data);
        } catch (err) {
          console.error(`[SonioxService] Listener error on ${event}:`, err);
        }
      }
    }
  }

  getState() {
    return this.state;
  }

  isActive() {
    return isActiveState(this.state);
  }

  clearTokens() {
    this.finalTokens = [];
    this.nonFinalTokens = [];
  }

  async startTranscription(config = {}) {
    if (!this.apiKey) {
      const err = new Error('Please enter your Soniox API Key in Settings to start transcription.');
      this.emit('error', { status: 'api_key_missing', message: err.message });
      throw err;
    }

    if (this.isActive()) {
      this.cancel();
    }

    // Only clear previous tokens if not explicitly resuming/appending
    if (!config.append) {
      this.clearTokens();
    } else {
      this.nonFinalTokens = [];
    }

    // Create client instance with API key
    this.client = new SonioxClient({
      apiKey: this.apiKey,
      keepAlive: true,
      keepAliveInterval: 5000,
    });

    // Acquire wake lock to keep screen on while recording
    this._requestWakeLock();

    // Set up audio stream (microphone, system audio, or both mixed)
    try {
      this.activeStream = await this._acquireAudioStream(config);
    } catch (err) {
      this._cleanupMedia();
      this._releaseWakeLock();
      const errorObj = err.status
        ? { status: err.status, message: err.message }
        : {
            status: 'microphone_access_denied',
            message: `Microphone error: ${err.name} - ${err.message}. Please allow microphone access in browser settings.`
          };
      this.emit('error', errorObj);
      throw err;
    }

    const startOptions = {
      model: config.model || 'stt-rt-v6',
      enableSpeakerDiarization: config.enableSpeakerDiarization ?? true,
      enableLanguageIdentification: config.enableLanguageIdentification ?? true,
      enableEndpointDetection: config.enableEndpointDetection ?? true,
      stream: this.activeStream,

      onStarted: () => {
        this.emit('started');
      },

      onStateChange: ({ newState, oldState }) => {
        this.state = newState;
        this.emit('stateChange', { newState, oldState });
      },

      onPartialResult: (result) => {
        const newFinals = [];
        const newNonFinals = [];

        if (Array.isArray(result.tokens)) {
          for (const token of result.tokens) {
            // Filter out internal endpoint marker tokens
            if (token.text === END_TOKEN) {
              continue;
            }

            if (token.is_final) {
              newFinals.push(token);
            } else {
              newNonFinals.push(token);
            }
          }
        }

        if (newFinals.length > 0) {
          this.finalTokens.push(...newFinals);
        }
        this.nonFinalTokens = newNonFinals;

        this.emit('partialResult', {
          result,
          newFinals,
          newNonFinals,
          finalTokens: this.finalTokens,
          nonFinalTokens: this.nonFinalTokens,
          allTokens: [...this.finalTokens, ...this.nonFinalTokens]
        });
      },

      onFinished: () => {
        this._cleanupMedia();
        this._releaseWakeLock();
        this.emit('finished');
      },

      onError: (status, message, errorCode) => {
        this._cleanupMedia();
        this._releaseWakeLock();
        this.emit('error', { status, message, errorCode });
      }
    };

    if (config.languageHints && Array.isArray(config.languageHints) && config.languageHints.length > 0) {
      startOptions.languageHints = config.languageHints;
    }

    if (config.context && (config.context.terms?.length || config.context.general?.length)) {
      startOptions.context = config.context;
    }

    if (config.translation) {
      startOptions.translation = config.translation;
    }

    try {
      await this.client.start(startOptions);
    } catch (err) {
      this._cleanupMedia();
      this._releaseWakeLock();
      this.emit('error', { status: 'client_start_failed', message: err.message });
      throw err;
    }
  }

  stop() {
    if (this.client && this.isActive()) {
      try {
        this.client.stop();
      } catch (err) {
        console.warn('[SonioxService] Stop error:', err);
      }
    }
    this._cleanupMedia();
    this._releaseWakeLock();
  }

  cancel() {
    if (this.client) {
      try {
        this.client.cancel();
      } catch (err) {
        console.warn('[SonioxService] Cancel error:', err);
      }
    }
    this._cleanupMedia();
    this._releaseWakeLock();
  }

  finalize() {
    if (this.client && this.isActive()) {
      try {
        this.client.finalize();
      } catch (err) {
        console.warn('[SonioxService] Finalize error:', err);
      }
    }
  }

  static isSystemAudioSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
  }

  async _getMicStream(config) {
    const audioConstraints = {
      echoCancellation: config.echoCancellation ?? true,
      noiseSuppression: config.noiseSuppression ?? true,
      autoGainControl: config.autoGainControl ?? true,
      channelCount: 1,
      sampleRate: 44100
    };
    if (config.deviceId) {
      audioConstraints.deviceId = { exact: config.deviceId };
    }
    return navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
  }

  async _getSystemStream() {
    if (!SonioxService.isSystemAudioSupported()) {
      const e = new Error('System audio capture is not supported in this browser. Use a desktop Chromium browser (Chrome/Edge).');
      e.status = 'system_audio_unsupported';
      throw e;
    }
    let displayStream;
    try {
      // Video is required by most browsers; it is discarded (not sent to Soniox).
      displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        },
        systemAudio: 'include',
        selfBrowserSurface: 'exclude',
        preferCurrentTab: false
      });
    } catch (err) {
      const e = new Error(`System audio error: ${err.name} - ${err.message}. Sharing was cancelled or blocked.`);
      e.status = 'system_audio_denied';
      throw e;
    }

    if (displayStream.getAudioTracks().length === 0) {
      displayStream.getTracks().forEach((t) => t.stop());
      const e = new Error('No audio was shared. When choosing what to share, pick a tab or entire screen and enable "Share audio" / "Share system audio".');
      e.status = 'system_audio_missing';
      throw e;
    }
    return displayStream;
  }

  /**
   * Returns an audio-only MediaStream for the requested source.
   * config.audioSource: 'mic' (default) | 'system' | 'both'
   */
  async _acquireAudioStream(config) {
    const source = config.audioSource || 'mic';
    this._extraStreams = [];

    if (source === 'mic') {
      return this._getMicStream(config);
    }

    const displayStream = await this._getSystemStream();
    this._extraStreams.push(displayStream);

    // If the user clicks the browser's "Stop sharing" bar, stop transcription.
    displayStream.getTracks().forEach((t) => {
      t.addEventListener('ended', () => {
        if (this.isActive()) this.stop();
      });
    });

    if (source === 'system') {
      // Audio-only stream; the video track stays alive (sharing continues) but isn't recorded.
      return new MediaStream(displayStream.getAudioTracks());
    }

    // 'both': mix microphone + system audio into a single track
    const micStream = await this._getMicStream(config);
    this._extraStreams.push(micStream);

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    this._audioContext = new AudioCtx();
    const destination = this._audioContext.createMediaStreamDestination();
    this._audioContext.createMediaStreamSource(new MediaStream(displayStream.getAudioTracks())).connect(destination);
    this._audioContext.createMediaStreamSource(micStream).connect(destination);
    if (this._audioContext.state === 'suspended') {
      try { await this._audioContext.resume(); } catch (e) {}
    }
    return destination.stream;
  }

  _cleanupMedia() {
    if (this.activeStream) {
      try {
        this.activeStream.getTracks().forEach((track) => track.stop());
      } catch (e) {}
      this.activeStream = null;
    }
    if (this._extraStreams) {
      for (const s of this._extraStreams) {
        try {
          s.getTracks().forEach((track) => track.stop());
        } catch (e) {}
      }
      this._extraStreams = [];
    }
    if (this._audioContext) {
      try { this._audioContext.close(); } catch (e) {}
      this._audioContext = null;
    }
  }

  async _requestWakeLock() {
    if ('wakeLock' in navigator && navigator.wakeLock.request) {
      try {
        this.wakeLock = await navigator.wakeLock.request('screen');
        this.wakeLock.addEventListener('release', () => {
          this.wakeLock = null;
        });
      } catch (err) {
        console.warn('[SonioxService] Screen wake lock not granted:', err);
      }
    }
  }

  _releaseWakeLock() {
    if (this.wakeLock) {
      try {
        this.wakeLock.release();
      } catch (e) {}
      this.wakeLock = null;
    }
  }
}
