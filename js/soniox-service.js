/**
 * SonioxService
 * Wraps @soniox/speech-to-text-web Client loaded via CDN
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
    this.audioContext = null;
    this.analyser = null;
    this.wakeLock = null;

    // Listeners map
    this.listeners = {
      stateChange: [],
      partialResult: [],
      started: [],
      finished: [],
      error: [],
      audioLevel: []
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

    this.clearTokens();

    // Create client instance with API key
    this.client = new SonioxClient({
      apiKey: this.apiKey,
      keepAlive: true,
      keepAliveInterval: 5000,
    });

    // Acquire wake lock to keep screen on while recording (mobile/tablet/laptop)
    this._requestWakeLock();

    // Set up microphone audio stream & visualizer
    try {
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

      this.activeStream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints
      });

      this._setupAudioAnalyser(this.activeStream);
    } catch (err) {
      this._releaseWakeLock();
      const errorObj = {
        status: 'microphone_access_denied',
        message: `Microphone error: ${err.name} - ${err.message}. Please allow microphone access in browser settings.`
      };
      this.emit('error', errorObj);
      throw err;
    }

    const startOptions = {
      model: config.model || 'stt-rt-preview',
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

  _setupAudioAnalyser(stream) {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;

      this.audioContext = new AudioContextClass();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.6;
      source.connect(this.analyser);
    } catch (err) {
      console.warn('[SonioxService] Audio visualizer setup failed:', err);
    }
  }

  getAudioData(dataArray) {
    if (this.analyser && this.audioContext && this.audioContext.state === 'running') {
      this.analyser.getByteFrequencyData(dataArray);
      return true;
    }
    return false;
  }

  _cleanupMedia() {
    if (this.activeStream) {
      try {
        this.activeStream.getTracks().forEach((track) => track.stop());
      } catch (e) {}
      this.activeStream = null;
    }
    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch (e) {}
      this.audioContext = null;
      this.analyser = null;
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
