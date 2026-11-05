/**
 * UIManager
 * Handles UI updates, dual-pane translation rendering, speaker grouping,
 * text rotation, text sizing, exports, and mobile toasts.
 */

export class UIManager {
  constructor() {
    this.fontSizes = [14, 18, 24];
    this.fontSize = parseInt(localStorage.getItem('soniox_font_size') || '18', 10);
    this.autoScroll = true;
    this.isNearBottom = true;
    this.startTime = null;
    this.timerInterval = null;
    this.accumulatedSeconds = 0;
    this.isRotated = false;

    this.speakerColors = [
      { bg: 'speaker-badge-green', text: '' },
      { bg: 'speaker-badge-blue', text: '' },
      { bg: 'speaker-badge-amber', text: '' },
      { bg: 'speaker-badge-purple', text: '' },
    ];
  }

  init() {
    this.applyFontSize();
    this.setupAutoScrollDetection();
  }

  // --- Timer Methods ---
  startTimer(timerElement) {
    this.stopTimer();
    this.startTime = Date.now();
    this.updateTimerDisplay(timerElement);
    this.timerInterval = setInterval(() => {
      this.updateTimerDisplay(timerElement);
    }, 1000);
  }

  pauseTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.startTime) {
      this.accumulatedSeconds += Math.floor((Date.now() - this.startTime) / 1000);
      this.startTime = null;
    }
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  resetTimer(timerElement) {
    this.stopTimer();
    this.startTime = null;
    this.accumulatedSeconds = 0;
    if (timerElement) {
      timerElement.textContent = '0:00';
    }
  }

  getElapsedSeconds() {
    let current = this.accumulatedSeconds;
    if (this.startTime) {
      current += Math.floor((Date.now() - this.startTime) / 1000);
    }
    return current;
  }

  updateTimerDisplay(timerElement) {
    if (!timerElement) return;
    const total = this.getElapsedSeconds();
    const mins = Math.floor(total / 60);
    const secs = (total % 60).toString().padStart(2, '0');
    timerElement.textContent = `${mins}:${secs}`;
  }

  // --- Font Sizing & Rotation ---
  setFontSize(size) {
    this.fontSize = Math.min(32, Math.max(12, parseInt(size, 10) || 18));
    localStorage.setItem('soniox_font_size', this.fontSize);
    this.applyFontSize();
    return this.fontSize;
  }

  getFontSize() {
    return this.fontSize;
  }

  cycleFontSize() {
    const idx = this.fontSizes.indexOf(this.fontSize);
    const nextIdx = (idx + 1) % this.fontSizes.length;
    return this.setFontSize(this.fontSizes[nextIdx]);
  }

  applyFontSize() {
    const containers = document.querySelectorAll('.transcript-content');
    containers.forEach(el => {
      el.style.fontSize = `${this.fontSize}px`;
      el.style.lineHeight = '1.65';
    });
  }

  toggleRotateTranscription(paneElement) {
    if (!paneElement) return false;
    this.isRotated = !this.isRotated;
    paneElement.classList.toggle('pane-rotated', this.isRotated);
    this.showToast(this.isRotated ? 'Text rotated for opposite viewer' : 'Text restored to normal', 'info');
    return this.isRotated;
  }

  // --- Auto-Scroll Detection ---
  setupAutoScrollDetection() {
    const containers = document.querySelectorAll('.transcript-scrollable');
    containers.forEach(container => {
      container.addEventListener('scroll', () => {
        const threshold = 50;
        const position = container.scrollHeight - container.scrollTop - container.clientHeight;
        this.isNearBottom = position < threshold;
      });
    });
  }

  scrollToBottom(container) {
    if (container && (this.autoScroll || this.isNearBottom)) {
      container.scrollTop = container.scrollHeight;
    }
  }

  // --- Dual-Pane Translation Rendering ---
  renderTranslationPanes(origContainer, transContainer, allTokens, options = {}) {
    // Propagate speaker attribute to translation tokens if needed
    let activeSpeaker = '1';
    const processedTokens = allTokens.map(t => {
      const clone = { ...t };
      if (clone.speaker != null) {
        activeSpeaker = clone.speaker;
      } else if (clone.translation_status === 'translation') {
        clone.speaker = activeSpeaker;
      }
      return clone;
    });

    const transcriptionTokens = processedTokens.filter(t => t.translation_status !== 'translation');
    const translationTokens = processedTokens.filter(t => t.translation_status === 'translation');

    const hasSpeakers = !!options.enableSpeakerDiarization && (
      transcriptionTokens.some(t => t.speaker !== undefined && t.speaker !== null) ||
      translationTokens.some(t => t.speaker !== undefined && t.speaker !== null)
    );

    const origPlaceholder = 'Transcribed text will appear here...';
    const transPlaceholder = options.targetLangName
      ? `Conversation in ${options.targetLangName} will appear here...`
      : 'Conversation in English will appear here...';

    if (hasSpeakers) {
      this.renderDiarizedToPane(origContainer, transcriptionTokens, origPlaceholder);
      this.renderDiarizedToPane(transContainer, translationTokens, transPlaceholder);
    } else {
      this.renderPlainToPane(origContainer, transcriptionTokens, origPlaceholder);
      this.renderPlainToPane(transContainer, translationTokens, transPlaceholder);
    }

    this.scrollToBottom(origContainer);
    this.scrollToBottom(transContainer);
  }

  renderPlainToPane(container, tokens, placeholder) {
    if (!container) return;

    if (!tokens || tokens.length === 0) {
      container.innerHTML = `
        <div class="empty-state-text">
          <span>${this.escapeHtml(placeholder)}</span>
        </div>
      `;
      return;
    }

    const finals = tokens.filter(t => t.is_final).map(t => this.escapeHtml(t.text)).join('');
    const nonFinals = tokens.filter(t => !t.is_final).map(t => this.escapeHtml(t.text)).join('');

    container.innerHTML = `
      <div class="pane-text-body">
        <span class="final-words">${finals}</span>
        ${nonFinals ? `<span class="interim-words">${nonFinals}</span>` : ''}
      </div>
    `;
  }

  renderDiarizedToPane(container, tokens, placeholder) {
    if (!container) return;

    if (!tokens || tokens.length === 0) {
      container.innerHTML = `
        <div class="empty-state-text">
          <span>${this.escapeHtml(placeholder)}</span>
        </div>
      `;
      return;
    }

    // Group consecutive tokens by speaker
    const groups = [];
    let currentGroup = null;

    for (const token of tokens) {
      const speakerId = token.speaker ?? '1';
      if (!currentGroup || currentGroup.speaker !== speakerId) {
        currentGroup = {
          speaker: speakerId,
          tokens: [token],
          start_ms: token.start_ms,
          language: token.language
        };
        groups.push(currentGroup);
      } else {
        currentGroup.tokens.push(token);
        if (!currentGroup.language && token.language) {
          currentGroup.language = token.language;
        }
      }
    }

    let html = '<div class="diarized-flow">';
    groups.forEach((group) => {
      const speakerNum = parseInt(group.speaker, 10) || 1;
      const colorStyle = this.speakerColors[(speakerNum - 1) % this.speakerColors.length];

      const finals = group.tokens.filter(t => t.is_final).map(t => this.escapeHtml(t.text)).join('');
      const nonFinals = group.tokens.filter(t => !t.is_final).map(t => this.escapeHtml(t.text)).join('');

      html += `
        <div class="speaker-segment mb-2">
          <div class="speaker-pill-wrapper mb-1">
            <span class="badge ${colorStyle.bg} ${colorStyle.text} rounded-pill py-1 px-2 speaker-badge">
              Speaker ${this.escapeHtml(group.speaker)}
            </span>
          </div>
          <div class="speaker-speech">
            <span class="final-words">${finals}</span>
            ${nonFinals ? `<span class="interim-words">${nonFinals}</span>` : ''}
          </div>
        </div>
      `;
    });
    html += '</div>';

    container.innerHTML = html;
  }

  // --- Copy Utilities ---
  async copyToClipboard(text, customMessage = 'Copied to clipboard!') {
    if (!text || !text.trim()) {
      this.showToast('No text to copy', 'warning');
      return;
    }
    try {
      await navigator.clipboard.writeText(text.trim());
      this.showToast(customMessage, 'success');
    } catch (err) {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text.trim();
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try {
        document.execCommand('copy');
        this.showToast(customMessage, 'success');
      } catch (e) {
        this.showToast('Could not copy to clipboard', 'danger');
      }
      document.body.removeChild(ta);
    }
  }

  // --- Export Utilities ---
  exportToTxt(tokens, filename = 'soniox-translation.txt') {
    let output = '';
    let currentSpeaker = null;

    for (const t of tokens) {
      if (t.speaker !== undefined && t.speaker !== currentSpeaker) {
        currentSpeaker = t.speaker;
        output += `\n\n[Speaker ${currentSpeaker}]: `;
      }
      output += t.text;
    }

    this._downloadFile(output.trim(), filename, 'text/plain;charset=utf-8');
  }

  exportToJson(tokens, filename = 'soniox-translation.json') {
    const data = JSON.stringify({
      exportedAt: new Date().toISOString(),
      tokensCount: tokens.length,
      tokens: tokens
    }, null, 2);
    this._downloadFile(data, filename, 'application/json;charset=utf-8');
  }

  exportToSrt(tokens, filename = 'soniox-translation.srt') {
    let srt = '';
    let subtitleIndex = 1;
    let currentChunk = [];
    let chunkStart = null;
    let chunkEnd = null;

    const finalizeChunk = () => {
      if (currentChunk.length === 0) return;
      const text = currentChunk.map(t => t.text).join('').trim();
      if (text && chunkStart != null && chunkEnd != null) {
        srt += `${subtitleIndex}\n`;
        srt += `${this.msToSrtTime(chunkStart)} --> ${this.msToSrtTime(chunkEnd)}\n`;
        srt += `${text}\n\n`;
        subtitleIndex++;
      }
      currentChunk = [];
      chunkStart = null;
      chunkEnd = null;
    };

    for (const token of tokens) {
      if (token.start_ms != null && chunkStart == null) {
        chunkStart = token.start_ms;
      }
      if (token.end_ms != null) {
        chunkEnd = token.end_ms;
      }
      currentChunk.push(token);

      if (currentChunk.length >= 10 || token.text.endsWith('.') || token.text.endsWith('?') || token.text.endsWith('!')) {
        finalizeChunk();
      }
    }
    finalizeChunk();

    this._downloadFile(srt, filename, 'text/plain;charset=utf-8');
  }

  msToSrtTime(ms) {
    const date = new Date(ms);
    const hours = Math.floor(ms / 3600000).toString().padStart(2, '0');
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');
    const seconds = date.getUTCSeconds().toString().padStart(2, '0');
    const millis = date.getUTCMilliseconds().toString().padStart(3, '0');
    return `${hours}:${minutes}:${seconds},${millis}`;
  }

  _downloadFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.showToast(`Exported ${filename}`, 'info');
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toastEl = document.createElement('div');
    toastEl.className = `toast align-items-center text-bg-${type} border-0 show mb-2 shadow-sm rounded-pill px-3 py-1`;
    toastEl.setAttribute('role', 'alert');
    toastEl.innerHTML = `
      <div class="d-flex align-items-center justify-content-between">
        <div class="toast-body py-1 px-0 small fw-medium">
          ${this.escapeHtml(message)}
        </div>
        <button type="button" class="btn-close btn-close-white btn-sm ms-2" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    `;
    container.appendChild(toastEl);

    setTimeout(() => {
      toastEl.classList.remove('show');
      setTimeout(() => toastEl.remove(), 300);
    }, 2800);
  }

  escapeHtml(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
