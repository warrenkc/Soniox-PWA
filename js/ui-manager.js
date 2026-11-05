/**
 * UIManager
 * Handles UI updates, token rendering, speaker grouping, translations, exports, and audio canvas visualization.
 */

export class UIManager {
  constructor() {
    this.fontSize = parseInt(localStorage.getItem('soniox_font_size') || '16', 10);
    this.autoScroll = true;
    this.isNearBottom = true;
    this.startTime = null;
    this.timerInterval = null;
    this.visualizerAnimationId = null;

    this.speakerColors = [
      { bg: 'bg-primary', text: 'text-white', border: 'border-primary' },
      { bg: 'bg-success', text: 'text-white', border: 'border-success' },
      { bg: 'bg-info', text: 'text-dark', border: 'border-info' },
      { bg: 'bg-warning', text: 'text-dark', border: 'border-warning' },
      { bg: 'bg-danger', text: 'text-white', border: 'border-danger' },
      { bg: 'bg-secondary', text: 'text-white', border: 'border-secondary' },
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

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  resetTimer(timerElement) {
    this.stopTimer();
    this.startTime = null;
    if (timerElement) {
      timerElement.textContent = '00:00';
    }
  }

  updateTimerDisplay(timerElement) {
    if (!timerElement || !this.startTime) return;
    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
    const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
    const secs = (elapsed % 60).toString().padStart(2, '0');
    timerElement.textContent = `${mins}:${secs}`;
  }

  // --- Font Sizing ---
  changeFontSize(delta) {
    this.fontSize = Math.min(26, Math.max(13, this.fontSize + delta));
    localStorage.setItem('soniox_font_size', this.fontSize);
    this.applyFontSize();
  }

  applyFontSize() {
    const containers = document.querySelectorAll('.transcript-content');
    containers.forEach(el => {
      el.style.fontSize = `${this.fontSize}px`;
      el.style.lineHeight = '1.7';
    });
    const sizeDisplay = document.getElementById('fontSizeDisplay');
    if (sizeDisplay) {
      sizeDisplay.textContent = `${this.fontSize}px`;
    }
  }

  // --- Auto-Scroll Detection ---
  setupAutoScrollDetection() {
    const containers = document.querySelectorAll('.transcript-scrollable');
    containers.forEach(container => {
      container.addEventListener('scroll', () => {
        const threshold = 60;
        const position = container.scrollHeight - container.scrollTop - container.clientHeight;
        this.isNearBottom = position < threshold;

        const scrollBtn = document.getElementById('scrollToBottomBtn');
        if (scrollBtn) {
          if (!this.isNearBottom && container.scrollHeight > container.clientHeight) {
            scrollBtn.classList.remove('d-none');
          } else {
            scrollBtn.classList.add('d-none');
          }
        }
      });
    });
  }

  scrollToBottom(container) {
    if (container && (this.autoScroll || this.isNearBottom)) {
      container.scrollTop = container.scrollHeight;
    }
  }

  // --- Mode 1: Render Standard Transcription ---
  renderTranscription(container, finalTokens, nonFinalTokens, options = {}) {
    if (!container) return;

    const allTokens = [...finalTokens, ...nonFinalTokens];
    if (allTokens.length === 0) {
      container.innerHTML = `
        <div class="empty-state text-center py-5 text-muted">
          <i class="bi bi-mic display-4 d-block mb-3 opacity-50"></i>
          <h5 class="fw-semibold">Ready to listen</h5>
          <p class="small mb-0">Click <strong>Start Listening</strong> or tap the microphone below.</p>
        </div>
      `;
      this.updateStats(0, 0);
      return;
    }

    // Check if tokens have speaker information (Speaker Diarization)
    const hasSpeakers = options.enableSpeakerDiarization && allTokens.some(t => t.speaker !== undefined && t.speaker !== null);

    if (hasSpeakers) {
      this.renderDiarizedTranscript(container, allTokens);
    } else {
      this.renderPlainTranscript(container, finalTokens, nonFinalTokens);
    }

    // Update counts
    const fullText = allTokens.map(t => t.text).join('');
    const words = fullText.trim() ? fullText.trim().split(/\s+/).length : 0;
    const chars = fullText.length;
    this.updateStats(words, chars);

    this.scrollToBottom(container);
  }

  renderPlainTranscript(container, finalTokens, nonFinalTokens) {
    const finalsHtml = finalTokens.map(t => {
      const langBadge = t.language ? `<span class="badge bg-secondary-subtle text-secondary token-lang-pill">${this.escapeHtml(t.language)}</span>` : '';
      return `${this.escapeHtml(t.text)}${langBadge}`;
    }).join('');

    const nonFinalsHtml = nonFinalTokens.length > 0
      ? `<span class="interim-text text-primary-emphasis">${this.escapeHtml(nonFinalTokens.map(t => t.text).join(''))}</span>`
      : '';

    container.innerHTML = `
      <div class="p-3 transcript-block">
        <span class="final-text">${finalsHtml}</span>
        ${nonFinalsHtml}
      </div>
    `;
  }

  renderDiarizedTranscript(container, allTokens) {
    // Group consecutive tokens by speaker
    const groups = [];
    let currentGroup = null;

    for (const token of allTokens) {
      const speakerId = token.speaker ?? 'Unknown';
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

    let html = '';
    groups.forEach((group) => {
      const speakerNum = parseInt(group.speaker, 10) || 1;
      const colorStyle = this.speakerColors[(speakerNum - 1) % this.speakerColors.length];
      const timecode = group.start_ms != null ? this.formatTimecode(group.start_ms) : '';

      const finals = group.tokens.filter(t => t.is_final);
      const nonFinals = group.tokens.filter(t => !t.is_final);

      const finalsText = finals.map(t => this.escapeHtml(t.text)).join('');
      const nonFinalsText = nonFinals.length > 0
        ? `<span class="interim-text text-primary-emphasis">${this.escapeHtml(nonFinals.map(t => t.text).join(''))}</span>`
        : '';

      html += `
        <div class="speaker-card mb-3 p-3 rounded-3 border bg-body-tertiary">
          <div class="d-flex align-items-center justify-content-between mb-2">
            <div class="d-flex align-items-center gap-2">
              <span class="badge ${colorStyle.bg} ${colorStyle.text} rounded-pill px-2 py-1">
                <i class="bi bi-person-fill me-1"></i> Speaker ${this.escapeHtml(group.speaker)}
              </span>
              ${group.language ? `<span class="badge bg-secondary-subtle text-secondary">${this.escapeHtml(group.language.toUpperCase())}</span>` : ''}
            </div>
            ${timecode ? `<span class="text-muted small"><i class="bi bi-clock me-1"></i>${timecode}</span>` : ''}
          </div>
          <div class="speaker-text">
            <span>${finalsText}</span>${nonFinalsText}
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  // --- Mode 2: Render One-Way Translation ---
  renderTranslationPanes(origContainer, transContainer, allTokens) {
    const transcriptionTokens = allTokens.filter(t => t.translation_status !== 'translation');
    const translationTokens = allTokens.filter(t => t.translation_status === 'translation');

    this.renderPlainTokensToPane(origContainer, transcriptionTokens, 'Original transcription will appear here...');
    this.renderPlainTokensToPane(transContainer, translationTokens, 'Live translation will appear here...');

    const origText = transcriptionTokens.map(t => t.text).join('');
    const transText = translationTokens.map(t => t.text).join('');

    const origStats = document.getElementById('origStats');
    if (origStats) origStats.textContent = `${origText.trim() ? origText.trim().split(/\s+/).length : 0} words`;

    const transStats = document.getElementById('transStats');
    if (transStats) transStats.textContent = `${transText.trim() ? transText.trim().split(/\s+/).length : 0} words`;

    this.scrollToBottom(origContainer);
    this.scrollToBottom(transContainer);
  }

  renderPlainTokensToPane(container, tokens, emptyPlaceholder) {
    if (!container) return;

    if (tokens.length === 0) {
      container.innerHTML = `
        <div class="text-center py-4 text-muted opacity-75">
          <p class="small mb-0">${emptyPlaceholder}</p>
        </div>
      `;
      return;
    }

    const finals = tokens.filter(t => t.is_final).map(t => this.escapeHtml(t.text)).join('');
    const nonFinals = tokens.filter(t => !t.is_final).map(t => this.escapeHtml(t.text)).join('');

    container.innerHTML = `
      <div class="p-2">
        <span>${finals}</span>
        ${nonFinals ? `<span class="interim-text text-primary-emphasis">${nonFinals}</span>` : ''}
      </div>
    `;
  }

  // --- Mode 3: Render Two-Way Dialogue Translation ---
  renderTwoWayDialogue(container, allTokens, langA, langB) {
    if (!container) return;

    if (allTokens.length === 0) {
      container.innerHTML = `
        <div class="empty-state text-center py-5 text-muted">
          <i class="bi bi-chat-quote display-4 d-block mb-3 opacity-50"></i>
          <h5 class="fw-semibold">Two-Way Conversation</h5>
          <p class="small mb-0">Speak in either language. Speech will automatically route to each participant's side.</p>
        </div>
      `;
      return;
    }

    // Split messages into dialog turns based on language detection
    const turns = [];
    let currentTurn = null;

    for (const token of allTokens) {
      const isLangB = token.language === langB;
      const currentRole = isLangB ? 'langB' : 'langA';

      if (!currentTurn || currentTurn.role !== currentRole) {
        currentTurn = {
          role: currentRole,
          language: token.language || (isLangB ? langB : langA),
          tokens: [token]
        };
        turns.push(currentTurn);
      } else {
        currentTurn.tokens.push(token);
      }
    }

    let html = '<div class="dialogue-container d-flex flex-column gap-3 p-2">';
    turns.forEach(turn => {
      const isRight = turn.role === 'langB';
      const bubbleClass = isRight ? 'align-self-end bg-success-subtle border-success' : 'align-self-start bg-primary-subtle border-primary';
      const label = isRight ? `${langB.toUpperCase()}` : `${langA.toUpperCase()}`;

      const finals = turn.tokens.filter(t => t.is_final).map(t => this.escapeHtml(t.text)).join('');
      const nonFinals = turn.tokens.filter(t => !t.is_final).map(t => this.escapeHtml(t.text)).join('');

      html += `
        <div class="dialogue-bubble ${bubbleClass} border rounded-4 p-3 shadow-sm" style="max-width: 82%;">
          <div class="d-flex align-items-center justify-content-between mb-1 gap-2">
            <span class="badge ${isRight ? 'bg-success' : 'bg-primary'} rounded-pill">${label}</span>
          </div>
          <div class="dialogue-text">
            <span>${finals}</span>
            ${nonFinals ? `<span class="interim-text text-primary-emphasis">${nonFinals}</span>` : ''}
          </div>
        </div>
      `;
    });
    html += '</div>';

    container.innerHTML = html;
    this.scrollToBottom(container);
  }

  // --- Audio Visualizer on Canvas ---
  startAudioVisualizer(canvas, sonioxService) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dataArray = new Uint8Array(64);

    const draw = () => {
      this.visualizerAnimationId = requestAnimationFrame(draw);

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const hasAudio = sonioxService.getAudioData(dataArray);

      if (hasAudio) {
        const barWidth = (width / 32);
        let x = 0;

        for (let i = 0; i < 32; i++) {
          const val = dataArray[i * 2] / 255;
          const barHeight = Math.max(4, val * (height - 6));

          const gradient = ctx.createLinearGradient(0, height, 0, 0);
          gradient.addColorStop(0, '#6366f1');
          gradient.addColorStop(1, '#06b6d4');

          ctx.fillStyle = gradient;
          const y = (height - barHeight) / 2;
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth - 3, barHeight, 3);
          ctx.fill();

          x += barWidth;
        }
      } else {
        // Subtle ambient sine wave when idle or connecting
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const sliceWidth = width / 60;
        let x = 0;
        const time = Date.now() / 400;

        for (let i = 0; i <= 60; i++) {
          const y = height / 2 + Math.sin(i * 0.15 + time) * 4;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          x += sliceWidth;
        }
        ctx.stroke();
      }
    };

    draw();
  }

  stopAudioVisualizer(canvas) {
    if (this.visualizerAnimationId) {
      cancelAnimationFrame(this.visualizerAnimationId);
      this.visualizerAnimationId = null;
    }
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  // --- Export Utilities ---
  exportToTxt(tokens, filename = 'soniox-transcript.txt') {
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

  exportToJson(tokens, filename = 'soniox-transcript.json') {
    const data = JSON.stringify({
      exportedAt: new Date().toISOString(),
      tokensCount: tokens.length,
      tokens: tokens
    }, null, 2);
    this._downloadFile(data, filename, 'application/json;charset=utf-8');
  }

  exportToSrt(tokens, filename = 'soniox-transcript.srt') {
    // Generate .srt subtitles from tokens with start_ms and end_ms
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

      // Break chunk every ~10 tokens or if gap is large
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

  formatTimecode(ms) {
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60).toString().padStart(2, '0');
    const secs = (totalSecs % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  }

  async copyToClipboard(text, triggerBtn) {
    try {
      await navigator.clipboard.writeText(text);
      if (triggerBtn) {
        const originalHtml = triggerBtn.innerHTML;
        triggerBtn.innerHTML = '<i class="bi bi-check-lg text-success"></i> Copied!';
        triggerBtn.classList.add('border-success');
        setTimeout(() => {
          triggerBtn.innerHTML = originalHtml;
          triggerBtn.classList.remove('border-success');
        }, 2000);
      }
      this.showToast('Copied to clipboard!', 'success');
    } catch (err) {
      this.showToast('Failed to copy to clipboard', 'danger');
    }
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
    toastEl.className = `toast align-items-center text-bg-${type} border-0 show mb-2 shadow`;
    toastEl.setAttribute('role', 'alert');
    toastEl.setAttribute('aria-live', 'assertive');
    toastEl.setAttribute('aria-atomic', 'true');
    toastEl.innerHTML = `
      <div class="d-flex">
        <div class="toast-body d-flex align-items-center gap-2">
          <i class="bi ${type === 'success' ? 'bi-check-circle' : type === 'danger' ? 'bi-exclamation-octagon' : 'bi-info-circle'}"></i>
          <span>${this.escapeHtml(message)}</span>
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    `;
    container.appendChild(toastEl);

    setTimeout(() => {
      toastEl.classList.remove('show');
      setTimeout(() => toastEl.remove(), 400);
    }, 3200);
  }

  updateStats(words, chars) {
    const wordEl = document.getElementById('statsWords');
    const charEl = document.getElementById('statsChars');
    if (wordEl) wordEl.textContent = `${words} words`;
    if (charEl) charEl.textContent = `${chars} chars`;
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
