/**
 * Soniox PWA Main Application
 */
import { SonioxService } from './soniox-service.js';
import { UIManager } from './ui-manager.js';
import { PWAInstaller } from './pwa-install.js';

// Initialize services
const soniox = new SonioxService();
const ui = new UIManager();
const pwa = new PWAInstaller();

// State
let currentMode = 'transcribe'; // 'transcribe' | 'translate-to' | 'translate-between'
let appSettings = {
  model: 'stt-rt-preview',
  enableSpeakerDiarization: true,
  enableLanguageIdentification: true,
  enableEndpointDetection: true,
  deviceId: '',
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  languageHints: ['en'],
  customTerms: '',
  // Translation settings
  targetLanguage: 'es',
  languageA: 'en',
  languageB: 'es',
};

// DOM Elements
const elements = {
  html: document.documentElement,
  themeToggleBtn: document.getElementById('themeToggleBtn'),
  themeIcon: document.getElementById('themeIcon'),
  statusBadge: document.getElementById('statusBadge'),
  statusDot: document.getElementById('statusDot'),
  statusText: document.getElementById('statusText'),
  timerDisplay: document.getElementById('timerDisplay'),
  canvas: document.getElementById('audioVisualizer'),
  recordBtn: document.getElementById('recordBtn'),
  recordBtnIcon: document.getElementById('recordBtnIcon'),
  recordBtnText: document.getElementById('recordBtnText'),
  finalizeBtn: document.getElementById('finalizeBtn'),
  cancelBtn: document.getElementById('cancelBtn'),
  clearBtn: document.getElementById('clearBtn'),
  // Mode views
  viewTranscribe: document.getElementById('viewTranscribe'),
  viewTranslateTo: document.getElementById('viewTranslateTo'),
  viewTranslateBetween: document.getElementById('viewTranslateBetween'),
  modeButtons: document.querySelectorAll('[data-mode]'),
  // Containers
  transcribeContainer: document.getElementById('transcribeContainer'),
  origTranslateContainer: document.getElementById('origTranslateContainer'),
  targetTranslateContainer: document.getElementById('targetTranslateContainer'),
  dialogueContainer: document.getElementById('dialogueContainer'),
  targetLanguageSelect: document.getElementById('targetLanguageSelect'),
  translateDiarizationToggle: document.getElementById('translateDiarizationToggle'),
  languageASelect: document.getElementById('languageASelect'),
  languageBSelect: document.getElementById('languageBSelect'),
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
  // Font size
  fontSizeIncreaseBtn: document.getElementById('fontSizeIncreaseBtn'),
  fontSizeDecreaseBtn: document.getElementById('fontSizeDecreaseBtn'),
  scrollToBottomBtn: document.getElementById('scrollToBottomBtn'),
  // Modals
  settingsModalEl: document.getElementById('settingsModal'),
  apiKeyWarningBanner: document.getElementById('apiKeyWarningBanner'),
  openSettingsBannerBtn: document.getElementById('openSettingsBannerBtn')
};

// Bootstrap Modal instance
let settingsModal = null;

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
  if (window.bootstrap && elements.settingsModalEl) {
    settingsModal = new window.bootstrap.Modal(elements.settingsModalEl);
  }

  loadStoredSettings();
  initTheme();
  ui.init();
  pwa.init();
  setupEventListeners();
  setupSonioxCallbacks();
  await enumerateAudioDevices();

  // Listen for audio device changes (plugging in headphones/AirPods)
  if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
    navigator.mediaDevices.addEventListener('devicechange', enumerateAudioDevices);
  }

  checkApiKeyNotice();

  // Check URL query parameters for initial mode (e.g. ?mode=translate-to)
  const urlParams = new URLSearchParams(window.location.search);
  const initialMode = urlParams.get('mode');
  if (initialMode && ['transcribe', 'translate-to', 'translate-between'].includes(initialMode)) {
    switchMode(initialMode);
  }
});

// --- Theme Management ---
function initTheme() {
  const savedTheme = localStorage.getItem('soniox_theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  setTheme(savedTheme);

  elements.themeToggleBtn?.addEventListener('click', () => {
    const nextTheme = elements.html.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
  });
}

function setTheme(theme) {
  elements.html.setAttribute('data-bs-theme', theme);
  localStorage.setItem('soniox_theme', theme);

  if (elements.themeIcon) {
    if (theme === 'dark') {
      elements.themeIcon.className = 'bi bi-moon-stars-fill text-warning';
    } else {
      elements.themeIcon.className = 'bi bi-sun-fill text-warning';
    }
  }
}

// --- Load and Save Settings ---
function loadStoredSettings() {
  const saved = localStorage.getItem('soniox_app_settings');
  if (saved) {
    try {
      appSettings = { ...appSettings, ...JSON.parse(saved) };
    } catch (e) {}
  }

  // Populate inputs
  if (elements.apiKeyInput) {
    elements.apiKeyInput.value = soniox.getApiKey();
  }
  if (elements.modelSelect) elements.modelSelect.value = appSettings.model;
  if (elements.settingDiarization) elements.settingDiarization.checked = appSettings.enableSpeakerDiarization;
  if (elements.translateDiarizationToggle) elements.translateDiarizationToggle.checked = appSettings.enableSpeakerDiarization;
  if (elements.settingLangId) elements.settingLangId.checked = appSettings.enableLanguageIdentification;
  if (elements.settingEndpoint) elements.settingEndpoint.checked = appSettings.enableEndpointDetection;
  if (elements.settingEcho) elements.settingEcho.checked = appSettings.echoCancellation;
  if (elements.settingNoise) elements.settingNoise.checked = appSettings.noiseSuppression;
  if (elements.settingGain) elements.settingGain.checked = appSettings.autoGainControl;
  if (elements.settingLangHints) elements.settingLangHints.value = (appSettings.languageHints || []).join(', ');
  if (elements.settingCustomTerms) elements.settingCustomTerms.value = appSettings.customTerms || '';
  if (elements.targetLanguageSelect) elements.targetLanguageSelect.value = appSettings.targetLanguage || 'es';
  if (elements.languageASelect) elements.languageASelect.value = appSettings.languageA || 'en';
  if (elements.languageBSelect) elements.languageBSelect.value = appSettings.languageB || 'es';
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
  appSettings.targetLanguage = elements.targetLanguageSelect?.value || 'es';
  appSettings.languageA = elements.languageASelect?.value || 'en';
  appSettings.languageB = elements.languageBSelect?.value || 'es';

  localStorage.setItem('soniox_app_settings', JSON.stringify(appSettings));
}

function checkApiKeyNotice() {
  const hasKey = !!soniox.getApiKey();
  if (!hasKey) {
    elements.apiKeyWarningBanner?.classList.remove('d-none');
  } else {
    elements.apiKeyWarningBanner?.classList.add('d-none');
  }
}

// --- Audio Device Enumeration ---
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
    console.warn('[Audio] Failed to enumerate devices:', err);
  }
}

// --- Event Listeners Setup ---
function setupEventListeners() {
  // Mode selection buttons
  elements.modeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.getAttribute('data-mode');
      switchMode(mode);
    });
  });

  // Start / Stop Recording
  elements.recordBtn?.addEventListener('click', () => {
    toggleRecording();
  });

  // Finalize button
  elements.finalizeBtn?.addEventListener('click', () => {
    soniox.finalize();
    ui.showToast('Finalizing current speech segment...', 'info');
  });

  // Cancel button
  elements.cancelBtn?.addEventListener('click', () => {
    soniox.cancel();
    ui.showToast('Session cancelled', 'warning');
  });

  // Clear button
  elements.clearBtn?.addEventListener('click', () => {
    clearCurrentTranscript();
  });

  // Font size
  elements.fontSizeIncreaseBtn?.addEventListener('click', () => ui.changeFontSize(2));
  elements.fontSizeDecreaseBtn?.addEventListener('click', () => ui.changeFontSize(-2));

  // Scroll to bottom floating button
  elements.scrollToBottomBtn?.addEventListener('click', () => {
    const activeContainer = getActiveScrollContainer();
    ui.scrollToBottom(activeContainer);
    elements.scrollToBottomBtn?.classList.add('d-none');
  });

  // API Key Save
  elements.saveApiKeyBtn?.addEventListener('click', () => {
    const key = elements.apiKeyInput?.value || '';
    soniox.setApiKey(key);
    saveCurrentSettings();
    checkApiKeyNotice();
    ui.showToast('API Key and Settings saved!', 'success');
    if (settingsModal) {
      settingsModal.hide();
    }
  });

  // Toggle API key visibility
  elements.toggleApiKeyVisibility?.addEventListener('click', () => {
    if (!elements.apiKeyInput) return;
    const isPassword = elements.apiKeyInput.type === 'password';
    elements.apiKeyInput.type = isPassword ? 'text' : 'password';
    elements.toggleApiKeyVisibility.innerHTML = isPassword ? '<i class="bi bi-eye-slash"></i>' : '<i class="bi bi-eye"></i>';
  });

  // Open settings banner button
  elements.openSettingsBannerBtn?.addEventListener('click', () => {
    if (settingsModal) settingsModal.show();
  });

  // Target Language dropdown change
  elements.targetLanguageSelect?.addEventListener('change', () => {
    saveCurrentSettings();
    if (soniox.isActive()) {
      ui.showToast('Restart recording to apply new language target', 'info');
    }
  });

  // Diarization toggle in translation header
  elements.translateDiarizationToggle?.addEventListener('change', (e) => {
    appSettings.enableSpeakerDiarization = e.target.checked;
    if (elements.settingDiarization) elements.settingDiarization.checked = e.target.checked;
    saveCurrentSettings();
    renderCurrentView();
    ui.showToast(e.target.checked ? 'Speaker Diarization enabled for translation' : 'Speaker Diarization hidden in translation', 'info');
  });

  // Keep modal toggle synced too
  elements.settingDiarization?.addEventListener('change', (e) => {
    if (elements.translateDiarizationToggle) elements.translateDiarizationToggle.checked = e.target.checked;
  });

  // Copy Buttons
  setupCopyButtons();

  // Export Buttons
  setupExportButtons();

  // Keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    // Avoid triggering if user is focused inside an input or textarea
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
      return;
    }

    if (e.code === 'Space' && !e.repeat) {
      e.preventDefault();
      toggleRecording();
    } else if (e.key === 'Escape') {
      if (soniox.isActive()) {
        e.preventDefault();
        soniox.cancel();
      }
    }
  });
}

function formatTokensWithSpeakers(tokens, isDiarized) {
  if (!isDiarized) return tokens.map(t => t.text).join('');
  let output = '';
  let currentSpeaker = null;
  for (const t of tokens) {
    if (t.speaker != null && t.speaker !== currentSpeaker) {
      currentSpeaker = t.speaker;
      output += `\n\n[Speaker ${currentSpeaker}]: `;
    }
    output += t.text;
  }
  return output.trim();
}

function setupCopyButtons() {
  document.getElementById('copyTranscribeBtn')?.addEventListener('click', (e) => {
    const all = [...soniox.finalTokens, ...soniox.nonFinalTokens];
    const text = formatTokensWithSpeakers(all, appSettings.enableSpeakerDiarization);
    ui.copyToClipboard(text, e.currentTarget);
  });

  document.getElementById('copyOrigTranslateBtn')?.addEventListener('click', (e) => {
    const all = [...soniox.finalTokens, ...soniox.nonFinalTokens];
    const origTokens = all.filter(t => t.translation_status !== 'translation');
    const text = formatTokensWithSpeakers(origTokens, appSettings.enableSpeakerDiarization);
    ui.copyToClipboard(text, e.currentTarget);
  });

  document.getElementById('copyTargetTranslateBtn')?.addEventListener('click', (e) => {
    let activeSpeaker = '1';
    const processed = [...soniox.finalTokens, ...soniox.nonFinalTokens].map(t => {
      const clone = { ...t };
      if (clone.speaker != null) activeSpeaker = clone.speaker;
      else if (clone.translation_status === 'translation') clone.speaker = activeSpeaker;
      return clone;
    });
    const transTokens = processed.filter(t => t.translation_status === 'translation');
    const text = formatTokensWithSpeakers(transTokens, appSettings.enableSpeakerDiarization);
    ui.copyToClipboard(text, e.currentTarget);
  });

  document.getElementById('copyDialogueBtn')?.addEventListener('click', (e) => {
    const all = [...soniox.finalTokens, ...soniox.nonFinalTokens];
    const text = all.map(t => `[${t.language || '?'}] ${t.text}`).join('\n');
    ui.copyToClipboard(text, e.currentTarget);
  });
}

function setupExportButtons() {
  const getTokens = () => [...soniox.finalTokens, ...soniox.nonFinalTokens];

  document.getElementById('exportTxtBtn')?.addEventListener('click', () => {
    ui.exportToTxt(getTokens(), `soniox-${currentMode}-${Date.now()}.txt`);
  });

  document.getElementById('exportJsonBtn')?.addEventListener('click', () => {
    ui.exportToJson(getTokens(), `soniox-${currentMode}-${Date.now()}.json`);
  });

  document.getElementById('exportSrtBtn')?.addEventListener('click', () => {
    ui.exportToSrt(getTokens(), `soniox-${currentMode}-${Date.now()}.srt`);
  });
}

// --- Mode Switching ---
function switchMode(mode) {
  if (currentMode === mode) return;

  if (soniox.isActive()) {
    soniox.stop();
  }

  currentMode = mode;

  // Update tabs style
  elements.modeButtons.forEach(btn => {
    if (btn.getAttribute('data-mode') === mode) {
      btn.classList.add('active', 'btn-primary');
      btn.classList.remove('btn-outline-primary', 'btn-light');
    } else {
      btn.classList.remove('active', 'btn-primary');
      btn.classList.add('btn-outline-primary');
    }
  });

  // Switch view containers
  elements.viewTranscribe?.classList.toggle('d-none', mode !== 'transcribe');
  elements.viewTranslateTo?.classList.toggle('d-none', mode !== 'translate-to');
  elements.viewTranslateBetween?.classList.toggle('d-none', mode !== 'translate-between');

  renderCurrentView();
}

function getActiveScrollContainer() {
  if (currentMode === 'transcribe') return elements.transcribeContainer;
  if (currentMode === 'translate-to') return elements.targetTranslateContainer;
  return elements.dialogueContainer;
}

// --- Soniox Callbacks & Rendering ---
function setupSonioxCallbacks() {
  soniox.on('stateChange', ({ newState }) => {
    updateStateUI(newState);
  });

  soniox.on('started', () => {
    updateStateUI('Running');
    ui.startTimer(elements.timerDisplay);
    ui.startAudioVisualizer(elements.canvas, soniox);
    ui.showToast('Microphone live. Listening...', 'success');
  });

  soniox.on('partialResult', () => {
    renderCurrentView();
  });

  soniox.on('finished', () => {
    updateStateUI('Finished');
    ui.stopTimer();
    ui.stopAudioVisualizer(elements.canvas);
    ui.showToast('Transcription finished.', 'info');
  });

  soniox.on('error', ({ status, message }) => {
    updateStateUI('Error');
    ui.stopTimer();
    ui.stopAudioVisualizer(elements.canvas);

    if (status === 'api_key_missing') {
      if (settingsModal) settingsModal.show();
    }
    ui.showToast(`Error: ${message || status}`, 'danger');
  });
}

function updateStateUI(state) {
  const isActive = soniox.isActive();

  // Status Badge Pill
  if (elements.statusDot && elements.statusText) {
    if (state === 'Running') {
      elements.statusDot.className = 'status-dot pulse-active bg-danger';
      elements.statusText.textContent = 'Recording';
      elements.statusBadge.className = 'badge rounded-pill border border-danger-subtle bg-danger-subtle text-danger px-3 py-2';
    } else if (state === 'OpeningWebSocket' || state === 'RequestingMedia') {
      elements.statusDot.className = 'status-dot pulse-active bg-warning';
      elements.statusText.textContent = 'Connecting...';
      elements.statusBadge.className = 'badge rounded-pill border border-warning-subtle bg-warning-subtle text-warning-emphasis px-3 py-2';
    } else if (state === 'FinishingProcessing') {
      elements.statusDot.className = 'status-dot pulse-active bg-info';
      elements.statusText.textContent = 'Finalizing...';
      elements.statusBadge.className = 'badge rounded-pill border border-info-subtle bg-info-subtle text-info-emphasis px-3 py-2';
    } else if (state === 'Error') {
      elements.statusDot.className = 'status-dot bg-danger';
      elements.statusText.textContent = 'Error';
      elements.statusBadge.className = 'badge rounded-pill border border-danger-subtle bg-danger-subtle text-danger px-3 py-2';
    } else {
      elements.statusDot.className = 'status-dot bg-secondary';
      elements.statusText.textContent = 'Idle';
      elements.statusBadge.className = 'badge rounded-pill border bg-body-tertiary text-secondary px-3 py-2';
    }
  }

  // Record Button
  if (elements.recordBtn && elements.recordBtnIcon && elements.recordBtnText) {
    if (isActive) {
      elements.recordBtn.className = 'btn btn-danger btn-lg rounded-pill shadow-lg px-4 record-btn-pulse';
      elements.recordBtnIcon.className = 'bi bi-stop-circle-fill me-2 fs-5';
      elements.recordBtnText.textContent = 'Stop Recording';
      elements.finalizeBtn?.removeAttribute('disabled');
      elements.cancelBtn?.removeAttribute('disabled');
    } else {
      elements.recordBtn.className = 'btn btn-primary btn-lg rounded-pill shadow-lg px-4 record-btn-glow';
      elements.recordBtnIcon.className = 'bi bi-mic-fill me-2 fs-5';
      elements.recordBtnText.textContent = 'Start Listening';
      elements.finalizeBtn?.setAttribute('disabled', 'true');
      elements.cancelBtn?.setAttribute('disabled', 'true');
    }
  }
}

function renderCurrentView() {
  const finalTokens = soniox.finalTokens;
  const nonFinalTokens = soniox.nonFinalTokens;
  const allTokens = [...finalTokens, ...nonFinalTokens];

  if (currentMode === 'transcribe') {
    ui.renderTranscription(elements.transcribeContainer, finalTokens, nonFinalTokens, {
      enableSpeakerDiarization: appSettings.enableSpeakerDiarization
    });
  } else if (currentMode === 'translate-to') {
    ui.renderTranslationPanes(elements.origTranslateContainer, elements.targetTranslateContainer, allTokens, {
      enableSpeakerDiarization: appSettings.enableSpeakerDiarization
    });
  } else if (currentMode === 'translate-between') {
    ui.renderTwoWayDialogue(elements.dialogueContainer, allTokens, appSettings.languageA, appSettings.languageB);
  }
}

// --- Toggle Recording ---
async function toggleRecording() {
  if (soniox.isActive()) {
    soniox.stop();
    return;
  }

  if (!soniox.getApiKey()) {
    ui.showToast('Please enter your Soniox API Key in Settings first.', 'warning');
    if (settingsModal) settingsModal.show();
    return;
  }

  // Build configuration based on active mode
  const config = {
    model: appSettings.model,
    enableSpeakerDiarization: appSettings.enableSpeakerDiarization,
    enableLanguageIdentification: appSettings.enableLanguageIdentification,
    enableEndpointDetection: appSettings.enableEndpointDetection,
    echoCancellation: appSettings.echoCancellation,
    noiseSuppression: appSettings.noiseSuppression,
    autoGainControl: appSettings.autoGainControl,
    deviceId: appSettings.deviceId || undefined,
  };

  if (appSettings.languageHints && appSettings.languageHints.length > 0) {
    config.languageHints = appSettings.languageHints;
  }

  // Parse custom terms
  if (appSettings.customTerms && appSettings.customTerms.trim()) {
    const terms = appSettings.customTerms.split(',').map(s => s.trim()).filter(Boolean);
    if (terms.length > 0) {
      config.context = { terms };
    }
  }

  // Set translation configuration based on currentMode
  if (currentMode === 'translate-to') {
    config.translation = {
      type: 'one_way',
      target_language: elements.targetLanguageSelect?.value || appSettings.targetLanguage || 'es'
    };
  } else if (currentMode === 'translate-between') {
    const langA = elements.languageASelect?.value || appSettings.languageA || 'en';
    const langB = elements.languageBSelect?.value || appSettings.languageB || 'es';
    config.translation = {
      type: 'two_way',
      language_a: langA,
      language_b: langB
    };
  }

  try {
    ui.resetTimer(elements.timerDisplay);
    await soniox.startTranscription(config);
  } catch (err) {
    console.error('Failed to start Soniox transcription:', err);
  }
}

function clearCurrentTranscript() {
  soniox.clearTokens();
  renderCurrentView();
  ui.resetTimer(elements.timerDisplay);
  ui.updateStats(0, 0);
  ui.showToast('Transcript cleared', 'info');
}
