/**
 * Soniox Translator PWA
 * Mobile-first Speech-to-Text & Live Translation Application
 */
import { SonioxService } from './soniox-service.js';
import { UIManager } from './ui-manager.js';
import { PWAInstaller } from './pwa-install.js';

// Language Map
const LANGUAGE_NAMES = {
  any: 'Any',
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  zh: 'Chinese',
  ja: 'Japanese',
  ko: 'Korean',
  it: 'Italian',
  pt: 'Portuguese',
  ru: 'Russian',
  ar: 'Arabic',
  hi: 'Hindi',
};

// Initialize services
const soniox = new SonioxService();
const ui = new UIManager();
const pwa = new PWAInstaller();

// State
let recordingState = 'idle'; // 'idle' | 'recording' | 'paused'
let appSettings = {
  model: 'stt-rt-preview',
  sourceLanguage: 'any',
  targetLanguage: 'en',
  enableSpeakerDiarization: true,
  enableLanguageIdentification: true,
  enableEndpointDetection: true,
  deviceId: '',
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  languageHints: [],
  customTerms: ''
};

// DOM Elements
const elements = {
  // Translation Panes
  origTranslateContainer: document.getElementById('origTranslateContainer'),
  targetTranslateContainer: document.getElementById('targetTranslateContainer'),
  transPaneTitle: document.getElementById('transPaneTitle'),
  transPlaceholderText: document.getElementById('transPlaceholderText'),
  // Options Popover Menu
  paneOptionsBtn: document.getElementById('paneOptionsBtn'),
  paneOptionsMenu: document.getElementById('paneOptionsMenu'),
  menuRotateBtn: document.getElementById('menuRotateBtn'),
  menuCopyOrigBtn: document.getElementById('menuCopyOrigBtn'),
  menuCopyTransBtn: document.getElementById('menuCopyTransBtn'),
  menuCopyTransLabel: document.getElementById('menuCopyTransLabel'),
  menuTextSizeBtn: document.getElementById('menuTextSizeBtn'),
  // Language Selector Bar
  languageSelectorBar: document.getElementById('languageSelectorBar'),
  sourceLangPill: document.getElementById('sourceLangPill'),
  sourceLangLabel: document.getElementById('sourceLangLabel'),
  targetLangPill: document.getElementById('targetLangPill'),
  targetLangLabel: document.getElementById('targetLangLabel'),
  // Controls
  controlsIdle: document.getElementById('controlsIdle'),
  controlsRecording: document.getElementById('controlsRecording'),
  controlsPaused: document.getElementById('controlsPaused'),
  btnOpenSettings: document.getElementById('btnOpenSettings'),
  btnStartListening: document.getElementById('btnStartListening'),
  btnSaveToHistory: document.getElementById('btnSaveToHistory'),
  btnPauseRecording: document.getElementById('btnPauseRecording'),
  btnDiscardRecording: document.getElementById('btnDiscardRecording'),
  btnResumeRecording: document.getElementById('btnResumeRecording'),
  btnDoneRecording: document.getElementById('btnDoneRecording'),
  // Timers
  timerIdle: document.getElementById('timerIdle'),
  timerRunning: document.getElementById('timerRunning'),
  timerPaused: document.getElementById('timerPaused'),
  // Bottom Tab Bar
  bottomTabBar: document.getElementById('bottomTabBar'),
  tabHistory: document.getElementById('tabHistory'),
  tabTranslator: document.getElementById('tabTranslator'),
  // Modals
  settingsModalEl: document.getElementById('settingsModal'),
  languageModalEl: document.getElementById('languageModal'),
  exportModalEl: document.getElementById('exportModal'),
  historyModalEl: document.getElementById('historyModal'),
  textSizeModalEl: document.getElementById('textSizeModal'),
  textSizeValueDisplay: document.getElementById('textSizeValueDisplay'),
  textSizeSlider: document.getElementById('textSizeSlider'),
  btnPresetSmall: document.getElementById('btnPresetSmall'),
  btnPresetDefault: document.getElementById('btnPresetDefault'),
  btnPresetLarge: document.getElementById('btnPresetLarge'),
  // Settings Inputs
  apiKeyInput: document.getElementById('apiKeyInput'),
  saveApiKeyBtn: document.getElementById('saveApiKeyBtn'),
  toggleApiKeyVisibility: document.getElementById('toggleApiKeyVisibility'),
  micSelect: document.getElementById('micSelect'),
  modelSelect: document.getElementById('modelSelect'),
  settingDiarization: document.getElementById('settingDiarization'),
  settingLangId: document.getElementById('settingLangId'),
  settingEndpoint: document.getElementById('settingEndpoint'),
  settingEcho: document.getElementById('settingEcho'),
  settingNoise: document.getElementById('settingNoise'),
  settingGain: document.getElementById('settingGain'),
  settingLangHints: document.getElementById('settingLangHints'),
  settingCustomTerms: document.getElementById('settingCustomTerms'),
  // Language Modal Selects
  selectSourceLang: document.getElementById('selectSourceLang'),
  selectTargetLang: document.getElementById('selectTargetLang'),
  applyLanguageBtn: document.getElementById('applyLanguageBtn'),
  // Export Buttons
  exportTxtBtn: document.getElementById('exportTxtBtn'),
  exportSrtBtn: document.getElementById('exportSrtBtn'),
  exportJsonBtn: document.getElementById('exportJsonBtn'),
  // History Elements
  historyListContainer: document.getElementById('historyListContainer'),
  clearHistoryBtn: document.getElementById('clearHistoryBtn'),
};

// Bootstrap Modal Instances
let modals = {};

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
  if (window.bootstrap) {
    if (elements.settingsModalEl) modals.settings = new window.bootstrap.Modal(elements.settingsModalEl);
    if (elements.languageModalEl) modals.language = new window.bootstrap.Modal(elements.languageModalEl);
    if (elements.exportModalEl) modals.export = new window.bootstrap.Modal(elements.exportModalEl);
    if (elements.historyModalEl) modals.history = new window.bootstrap.Modal(elements.historyModalEl);
    if (elements.textSizeModalEl) modals.textSize = new window.bootstrap.Modal(elements.textSizeModalEl);
  }

  loadStoredSettings();
  ui.init();
  pwa.init();
  updateLanguageUI();
  setupEventListeners();
  setupSonioxCallbacks();
  await enumerateAudioDevices();

  if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
    navigator.mediaDevices.addEventListener('devicechange', enumerateAudioDevices);
  }

  // Check if API key is configured
  if (!soniox.getApiKey()) {
    setTimeout(() => {
      ui.showToast('Please enter your Soniox API Key in Settings', 'info');
    }, 800);
  }
});

// --- Settings Management ---
function loadStoredSettings() {
  const saved = localStorage.getItem('soniox_translator_settings');
  if (saved) {
    try {
      appSettings = { ...appSettings, ...JSON.parse(saved) };
    } catch (e) {}
  }

  if (elements.apiKeyInput) elements.apiKeyInput.value = soniox.getApiKey();
  if (elements.modelSelect) elements.modelSelect.value = appSettings.model;
  if (elements.settingDiarization) elements.settingDiarization.checked = appSettings.enableSpeakerDiarization;
  if (elements.settingLangId) elements.settingLangId.checked = appSettings.enableLanguageIdentification;
  if (elements.settingEndpoint) elements.settingEndpoint.checked = appSettings.enableEndpointDetection;
  if (elements.settingEcho) elements.settingEcho.checked = appSettings.echoCancellation;
  if (elements.settingNoise) elements.settingNoise.checked = appSettings.noiseSuppression;
  if (elements.settingGain) elements.settingGain.checked = appSettings.autoGainControl;
  if (elements.settingLangHints) elements.settingLangHints.value = (appSettings.languageHints || []).join(', ');
  if (elements.settingCustomTerms) elements.settingCustomTerms.value = appSettings.customTerms || '';

  if (elements.selectSourceLang) elements.selectSourceLang.value = appSettings.sourceLanguage || 'any';
  if (elements.selectTargetLang) elements.selectTargetLang.value = appSettings.targetLanguage || 'en';
}

function saveCurrentSettings() {
  appSettings.model = elements.modelSelect?.value || 'stt-rt-preview';
  appSettings.enableSpeakerDiarization = !!elements.settingDiarization?.checked;
  appSettings.enableLanguageIdentification = !!elements.settingLangId?.checked;
  appSettings.enableEndpointDetection = !!elements.settingEndpoint?.checked;
  appSettings.echoCancellation = !!elements.settingEcho?.checked;
  appSettings.noiseSuppression = !!elements.settingNoise?.checked;
  appSettings.autoGainControl = !!elements.settingGain?.checked;
  appSettings.deviceId = elements.micSelect?.value || '';

  const hintsVal = elements.settingLangHints?.value || '';
  appSettings.languageHints = hintsVal.split(',').map(s => s.trim()).filter(Boolean);
  appSettings.customTerms = elements.settingCustomTerms?.value || '';

  localStorage.setItem('soniox_translator_settings', JSON.stringify(appSettings));
}

function updateLanguageUI() {
  const srcName = LANGUAGE_NAMES[appSettings.sourceLanguage] || 'Any';
  const trgName = LANGUAGE_NAMES[appSettings.targetLanguage] || 'English';

  if (elements.sourceLangLabel) elements.sourceLangLabel.textContent = srcName;
  if (elements.targetLangLabel) elements.targetLangLabel.textContent = trgName;

  if (elements.transPaneTitle) elements.transPaneTitle.textContent = `${trgName.toUpperCase()} TRANSLATION`;
  if (elements.menuCopyTransLabel) elements.menuCopyTransLabel.textContent = `Copy ${trgName}`;
  if (elements.transPlaceholderText) elements.transPlaceholderText.textContent = `Conversation in ${trgName} will appear here...`;
}

// --- Audio Devices ---
async function enumerateAudioDevices() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter(d => d.kind === 'audioinput');

    if (elements.micSelect) {
      elements.micSelect.innerHTML = '<option value="">Default Microphone</option>';
      audioInputs.forEach((device, idx) => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.textContent = device.label || `Microphone ${idx + 1}`;
        if (device.deviceId === appSettings.deviceId) {
          option.selected = true;
        }
        elements.micSelect.appendChild(option);
      });
    }
  } catch (err) {
    console.warn('[Audio] Device enumeration failed:', err);
  }
}

// --- Recording State Machine ---
function setRecordingState(newState) {
  recordingState = newState;

  if (newState === 'idle') {
    elements.controlsIdle?.classList.remove('d-none');
    elements.controlsRecording?.classList.add('d-none');
    elements.controlsPaused?.classList.add('d-none');

    elements.languageSelectorBar?.classList.remove('d-none');
    elements.bottomTabBar?.classList.remove('d-none');

    ui.updateTimerDisplay(elements.timerIdle);
  } else if (newState === 'recording') {
    elements.controlsIdle?.classList.add('d-none');
    elements.controlsRecording?.classList.remove('d-none');
    elements.controlsPaused?.classList.add('d-none');

    // Hide language selector & bottom nav to maximize focus (Screenshot 3)
    elements.languageSelectorBar?.classList.add('d-none');
    elements.bottomTabBar?.classList.add('d-none');

    ui.startTimer(elements.timerRunning);
  } else if (newState === 'paused') {
    elements.controlsIdle?.classList.add('d-none');
    elements.controlsRecording?.classList.add('d-none');
    elements.controlsPaused?.classList.remove('d-none');

    // Show language selector & bottom nav when paused (Screenshot 1)
    elements.languageSelectorBar?.classList.remove('d-none');
    elements.bottomTabBar?.classList.remove('d-none');

    ui.pauseTimer();
    ui.updateTimerDisplay(elements.timerPaused);
  }
}

// --- Start, Pause, Resume, Discard, Done ---
async function startTranslation(isResume = false) {
  if (!soniox.getApiKey()) {
    ui.showToast('Please enter your Soniox API Key in Settings first.', 'warning');
    if (modals.settings) modals.settings.show();
    return;
  }

  const config = {
    model: appSettings.model,
    enableSpeakerDiarization: appSettings.enableSpeakerDiarization,
    enableLanguageIdentification: appSettings.enableLanguageIdentification,
    enableEndpointDetection: appSettings.enableEndpointDetection,
    echoCancellation: appSettings.echoCancellation,
    noiseSuppression: appSettings.noiseSuppression,
    autoGainControl: appSettings.autoGainControl,
    deviceId: appSettings.deviceId || undefined,
    append: isResume,
    translation: {
      type: 'one_way',
      target_language: appSettings.targetLanguage || 'en'
    }
  };

  // Add source language hints if specified
  const hints = [...(appSettings.languageHints || [])];
  if (appSettings.sourceLanguage && appSettings.sourceLanguage !== 'any') {
    if (!hints.includes(appSettings.sourceLanguage)) {
      hints.unshift(appSettings.sourceLanguage);
    }
  }
  if (hints.length > 0) {
    config.languageHints = hints;
  }

  if (appSettings.customTerms && appSettings.customTerms.trim()) {
    const terms = appSettings.customTerms.split(',').map(s => s.trim()).filter(Boolean);
    if (terms.length > 0) {
      config.context = { terms };
    }
  }

  try {
    if (!isResume) {
      ui.resetTimer(elements.timerRunning);
    }
    setRecordingState('recording');
    await soniox.startTranscription(config);
  } catch (err) {
    console.error('Failed to start transcription:', err);
    setRecordingState('idle');
  }
}

function pauseTranslation() {
  if (soniox.isActive()) {
    soniox.stop();
  }
  setRecordingState('paused');
  ui.showToast('Recording paused', 'info');
}

function resumeTranslation() {
  startTranslation(true);
}

function discardTranslation() {
  if (soniox.isActive()) {
    soniox.cancel();
  }
  soniox.clearTokens();
  ui.resetTimer(elements.timerIdle);
  renderPanes();
  setRecordingState('idle');
  ui.showToast('Session discarded', 'info');
}

function doneTranslation() {
  if (soniox.isActive()) {
    soniox.finalize();
  }
  saveSessionToHistory();
  ui.resetTimer(elements.timerIdle);
  setRecordingState('idle');
  ui.showToast('Translation completed & saved to History!', 'success');
}

// --- History Persistence ---
function saveCurrentRecordingToHistory() {
  const all = [...soniox.finalTokens, ...soniox.nonFinalTokens];
  const origTokens = all.filter(t => t.translation_status !== 'translation');
  const transTokens = all.filter(t => t.translation_status === 'translation');

  const origText = origTokens.map(t => t.text).join('').trim();
  const transText = transTokens.map(t => t.text).join('').trim();

  if (!origText && !transText) {
    ui.showToast('No recording to save yet. Record some speech first.', 'warning');
    return;
  }

  const session = {
    id: Date.now(),
    date: new Date().toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    sourceLang: LANGUAGE_NAMES[appSettings.sourceLanguage] || 'Any',
    targetLang: LANGUAGE_NAMES[appSettings.targetLanguage] || 'English',
    origText,
    transText
  };

  try {
    const history = JSON.parse(localStorage.getItem('soniox_history') || '[]');
    if (history.length > 0 && history[0].origText === origText && history[0].transText === transText) {
      ui.showToast('Already saved to History!', 'info');
      return;
    }
    history.unshift(session);
    localStorage.setItem('soniox_history', JSON.stringify(history.slice(0, 50)));

    // Button feedback
    if (elements.btnSaveToHistory) {
      const originalHtml = elements.btnSaveToHistory.innerHTML;
      elements.btnSaveToHistory.innerHTML = '<i class="bi bi-check-lg text-white"></i>';
      setTimeout(() => {
        elements.btnSaveToHistory.innerHTML = originalHtml;
      }, 1500);
    }

    ui.showToast('Recording saved to History!', 'success');
  } catch (e) {
    console.warn('Failed to save session to history:', e);
    ui.showToast('Failed to save to history', 'danger');
  }
}

function saveSessionToHistory() {
  const all = [...soniox.finalTokens, ...soniox.nonFinalTokens];
  if (all.length === 0) return;

  const origTokens = all.filter(t => t.translation_status !== 'translation');
  const transTokens = all.filter(t => t.translation_status === 'translation');

  const origText = origTokens.map(t => t.text).join('').trim();
  const transText = transTokens.map(t => t.text).join('').trim();

  if (!origText && !transText) return;

  const session = {
    id: Date.now(),
    date: new Date().toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    sourceLang: LANGUAGE_NAMES[appSettings.sourceLanguage] || 'Any',
    targetLang: LANGUAGE_NAMES[appSettings.targetLanguage] || 'English',
    origText,
    transText
  };

  try {
    const history = JSON.parse(localStorage.getItem('soniox_history') || '[]');
    history.unshift(session);
    // Keep last 30 sessions
    localStorage.setItem('soniox_history', JSON.stringify(history.slice(0, 30)));
  } catch (e) {
    console.warn('Failed to save session to history:', e);
  }
}

function renderHistoryList() {
  if (!elements.historyListContainer) return;

  let history = [];
  try {
    history = JSON.parse(localStorage.getItem('soniox_history') || '[]');
  } catch (e) {}

  if (history.length === 0) {
    elements.historyListContainer.innerHTML = `
      <div class="text-center py-5 text-muted">
        <i class="bi bi-clock display-4 d-block mb-3 opacity-50"></i>
        <h6 class="fw-semibold">No saved conversations yet</h6>
        <p class="small mb-0">Completed recordings and translations will appear here.</p>
      </div>
    `;
    return;
  }

  let html = '<div class="d-flex flex-column gap-3">';
  history.forEach(item => {
    html += `
      <div class="card p-3 rounded-3 border bg-body-tertiary">
        <div class="d-flex align-items-center justify-content-between mb-2">
          <span class="badge bg-primary-subtle text-primary rounded-pill px-2 py-1 small">
            ${ui.escapeHtml(item.sourceLang)} ➔ ${ui.escapeHtml(item.targetLang)}
          </span>
          <span class="text-muted small">${ui.escapeHtml(item.date)}</span>
        </div>
        <div class="small mb-2">
          <strong class="d-block text-muted" style="font-size: 11px;">ORIGINAL</strong>
          <span>${ui.escapeHtml(item.origText || '(No speech)')}</span>
        </div>
        <div class="small">
          <strong class="d-block text-primary" style="font-size: 11px;">TRANSLATION</strong>
          <span class="fw-medium">${ui.escapeHtml(item.transText || '(No translation)')}</span>
        </div>
      </div>
    `;
  });
  html += '</div>';

  elements.historyListContainer.innerHTML = html;
}

// --- Text Size Modal UI Synchronization ---
function syncTextSizeModalUI() {
  const currentSize = ui.getFontSize();
  if (elements.textSizeValueDisplay) elements.textSizeValueDisplay.textContent = `${currentSize}px`;
  if (elements.textSizeSlider) elements.textSizeSlider.value = currentSize;

  elements.btnPresetSmall?.classList.toggle('active', currentSize === 14);
  elements.btnPresetDefault?.classList.toggle('active', currentSize === 18);
  elements.btnPresetLarge?.classList.toggle('active', currentSize === 24);
}

// --- Rendering Panes ---
function renderPanes() {
  const allTokens = [...soniox.finalTokens, ...soniox.nonFinalTokens];
  const trgName = LANGUAGE_NAMES[appSettings.targetLanguage] || 'English';

  ui.renderTranslationPanes(
    elements.origTranslateContainer,
    elements.targetTranslateContainer,
    allTokens,
    {
      enableSpeakerDiarization: appSettings.enableSpeakerDiarization,
      targetLangName: trgName
    }
  );
}

// --- Soniox Callbacks ---
function setupSonioxCallbacks() {
  soniox.on('partialResult', () => {
    renderPanes();
  });

  soniox.on('finished', () => {
    if (recordingState === 'recording') {
      setRecordingState('paused');
    }
  });

  soniox.on('error', ({ status, message }) => {
    if (status === 'api_key_missing') {
      if (modals.settings) modals.settings.show();
    }
    ui.showToast(`Error: ${message || status}`, 'danger');
    setRecordingState('idle');
  });
}

// --- Event Listeners ---
function setupEventListeners() {
  // Action Buttons
  elements.btnStartListening?.addEventListener('click', () => startTranslation(false));
  elements.btnPauseRecording?.addEventListener('click', () => pauseTranslation());
  elements.btnResumeRecording?.addEventListener('click', () => resumeTranslation());
  elements.btnDiscardRecording?.addEventListener('click', () => discardTranslation());
  elements.btnDoneRecording?.addEventListener('click', () => doneTranslation());

  // Settings Modal Triggers
  elements.btnOpenSettings?.addEventListener('click', () => {
    if (modals.settings) modals.settings.show();
  });

  // Language Pill Triggers
  elements.sourceLangPill?.addEventListener('click', () => {
    if (modals.language) modals.language.show();
  });
  elements.targetLangPill?.addEventListener('click', () => {
    if (modals.language) modals.language.show();
  });

  // Language Modal Apply
  elements.applyLanguageBtn?.addEventListener('click', () => {
    appSettings.sourceLanguage = elements.selectSourceLang?.value || 'any';
    appSettings.targetLanguage = elements.selectTargetLang?.value || 'en';
    saveCurrentSettings();
    updateLanguageUI();
    renderPanes();
    ui.showToast(`Target set to ${LANGUAGE_NAMES[appSettings.targetLanguage]}`, 'success');
  });

  // Save to History Button Trigger
  elements.btnSaveToHistory?.addEventListener('click', () => {
    saveCurrentRecordingToHistory();
  });

  const getTokens = () => [...soniox.finalTokens, ...soniox.nonFinalTokens];

  elements.exportTxtBtn?.addEventListener('click', () => {
    ui.exportToTxt(getTokens(), `soniox-translation-${Date.now()}.txt`);
    if (modals.export) modals.export.hide();
  });
  elements.exportSrtBtn?.addEventListener('click', () => {
    ui.exportToSrt(getTokens(), `soniox-translation-${Date.now()}.srt`);
    if (modals.export) modals.export.hide();
  });
  elements.exportJsonBtn?.addEventListener('click', () => {
    ui.exportToJson(getTokens(), `soniox-translation-${Date.now()}.json`);
    if (modals.export) modals.export.hide();
  });

  // Bottom Tabs
  elements.tabHistory?.addEventListener('click', () => {
    renderHistoryList();
    if (modals.history) modals.history.show();
  });
  elements.clearHistoryBtn?.addEventListener('click', () => {
    localStorage.removeItem('soniox_history');
    renderHistoryList();
    ui.showToast('History cleared', 'info');
  });
  elements.tabTranslator?.addEventListener('click', () => {
    // Already in Translator
  });

  // Options Menu Popover (Screenshot 1)
  elements.paneOptionsBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    elements.paneOptionsMenu?.classList.toggle('d-none');
  });

  // Close options menu when tapping outside
  document.addEventListener('click', (e) => {
    if (!elements.paneOptionsMenu?.classList.contains('d-none') && !elements.paneOptionsBtn?.contains(e.target)) {
      elements.paneOptionsMenu?.classList.add('d-none');
    }
  });

  elements.menuRotateBtn?.addEventListener('click', () => {
    ui.toggleRotateTranscription(elements.origTranslateContainer);
    elements.paneOptionsMenu?.classList.add('d-none');
  });

  elements.menuCopyOrigBtn?.addEventListener('click', () => {
    const all = [...soniox.finalTokens, ...soniox.nonFinalTokens];
    const origTokens = all.filter(t => t.translation_status !== 'translation');
    const text = origTokens.map(t => t.text).join('');
    ui.copyToClipboard(text, 'Original text copied!');
    elements.paneOptionsMenu?.classList.add('d-none');
  });

  elements.menuCopyTransBtn?.addEventListener('click', () => {
    const all = [...soniox.finalTokens, ...soniox.nonFinalTokens];
    const transTokens = all.filter(t => t.translation_status === 'translation');
    const text = transTokens.map(t => t.text).join('');
    const trgName = LANGUAGE_NAMES[appSettings.targetLanguage] || 'English';
    ui.copyToClipboard(text, `${trgName} translation copied!`);
    elements.paneOptionsMenu?.classList.add('d-none');
  });

  elements.menuTextSizeBtn?.addEventListener('click', () => {
    elements.paneOptionsMenu?.classList.add('d-none');
    syncTextSizeModalUI();
    if (modals.textSize) modals.textSize.show();
  });

  elements.textSizeSlider?.addEventListener('input', (e) => {
    const size = parseInt(e.target.value, 10);
    ui.setFontSize(size);
    syncTextSizeModalUI();
  });

  elements.btnPresetSmall?.addEventListener('click', () => {
    ui.setFontSize(14);
    syncTextSizeModalUI();
  });

  elements.btnPresetDefault?.addEventListener('click', () => {
    ui.setFontSize(18);
    syncTextSizeModalUI();
  });

  elements.btnPresetLarge?.addEventListener('click', () => {
    ui.setFontSize(24);
    syncTextSizeModalUI();
  });

  // Save Settings Modal
  elements.saveApiKeyBtn?.addEventListener('click', () => {
    const key = elements.apiKeyInput?.value || '';
    soniox.setApiKey(key);
    saveCurrentSettings();
    ui.showToast('Settings saved!', 'success');
    if (modals.settings) modals.settings.hide();
  });

  elements.toggleApiKeyVisibility?.addEventListener('click', () => {
    if (!elements.apiKeyInput) return;
    const isPw = elements.apiKeyInput.type === 'password';
    elements.apiKeyInput.type = isPw ? 'text' : 'password';
    elements.toggleApiKeyVisibility.innerHTML = isPw ? '<i class="bi bi-eye-slash"></i>' : '<i class="bi bi-eye"></i>';
  });

  // Keyboard Shortcuts (Space to toggle, Escape to cancel)
  window.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;

    if (e.code === 'Space' && !e.repeat) {
      e.preventDefault();
      if (recordingState === 'idle') startTranslation(false);
      else if (recordingState === 'recording') pauseTranslation();
      else if (recordingState === 'paused') resumeTranslation();
    } else if (e.key === 'Escape') {
      if (recordingState === 'recording' || recordingState === 'paused') {
        e.preventDefault();
        discardTranslation();
      }
    }
  });
}
