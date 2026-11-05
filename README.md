# Soniox Speech-to-Text Progressive Web App (PWA)

A responsive, high-performance Progressive Web App (PWA) for real-time speech-to-text transcription and live translation powered by the official [Soniox Speech-to-Text Web SDK](https://github.com/soniox/speech-to-text-web). Built using **vanilla JavaScript**, **HTML5**, **CSS3**, and **Bootstrap 5.3**, delivered via CDN.

Optimized to look and perform across **cell phones (iOS & Android)**, **iPads / Tablets**, and **PC desktop browsers**.

---

## 🌟 Key Features

### 🎙️ 1. Real-Time Transcription
- **Instant streaming transcription** with provisional word preview (interim tokens) and final text stabilization.
- **Speaker Diarization**: Identifies and organizes dialogue by speaker (`Speaker 1`, `Speaker 2`, etc.) with distinct avatars and color badges.
- **Dynamic Language Identification**: Detects the language spoken in real-time.
- **Automatic Endpoint Detection**: Automatically finalizes words and punctuation when the speaker pauses.
- **Live Metrics**: Displays elapsed time, total words, and character counts.

### 🌐 2. Live Translation (One-Way)
- Real-time spoken language transcription alongside concurrent live translation into target languages (Spanish, French, German, Italian, Portuguese, Mandarin, Japanese, Korean, Russian, Arabic, Hindi, English).
- Side-by-side view on desktop/iPad and stacked layout on phones.

### 💬 3. Bilingual Two-Way Conversation
- Designed for two people speaking different languages into a phone or tablet.
- Chat-bubble interface that automatically routes speech to each participant's side.

### 📱 4. Cross-Platform PWA & Mobile Polish
- **Installable**: Full PWA support with `manifest.webmanifest` and Service Worker (`sw.js`) for standalone display on Android, Chrome, Edge, and iOS.
- **iOS Safari Support**: Dedicated iOS "Add to Home Screen" visual instructions modal.
- **Screen Wake Lock**: Uses the Screen Wake Lock API to prevent phone/tablet screens from turning off during long speeches or meetings.
- **Live Audio Visualizer**: HTML5 Canvas waveform driven by the Web Audio API `AnalyserNode`.
- **Safe Area Insets**: Native spacing for iPhone notch and home indicator bars (`env(safe-area-inset-bottom)`).
- **Responsive Controls**: Big thumb-accessible recording button on mobile; keyboard shortcuts on desktop (<kbd>Space</kbd> to toggle, <kbd>Esc</kbd> to cancel).
- **Theme Support**: Seamless toggle between Dark Mode and Light Mode with system preference detection.

### 📤 5. Export & Utilities
- **One-Click Copy**: Copy transcripts to clipboard with instant toast confirmation.
- **Export to Text (`.txt`)**: Clean text document with speaker labels.
- **Export to Subtitles (`.srt`)**: Standard SubRip subtitle format using token timecodes (`start_ms` and `end_ms`).
- **Export to JSON (`.json`)**: Full structured token data with confidence scores and timestamps.
- **Adjustable Font Sizing**: Increase or decrease reading font size on phones and tablets.

---

## 🚀 Quick Start

### 1. Run Locally
You can run the included lightweight Node.js server:

```bash
# Start the local server
npm start
# OR
node server.js
```

Then open your browser at:
```
http://localhost:3000
```

> **Note on Mobile & Microphone Access**: Web browsers require either `http://localhost` or `https://` to permit microphone access (`getUserMedia`). If testing on your phone or iPad over local Wi-Fi, run an HTTPS tunnel (e.g. `ngrok http 3000` or `cloudflared`) or test directly on localhost.

### 2. Enter your Soniox API Key
1. Click the **Gear (⚙️) icon** in the top-right corner to open Settings.
2. Enter your Soniox API Key (obtain one from [console.soniox.com](https://console.soniox.com)).
3. Click **Save Settings**. The key is stored locally in your browser's `localStorage`.

### 3. Start Transcribing
- Click or tap **Start Listening** (or press <kbd>Space</kbd> on desktop).
- Speak into your microphone.
- Watch your words stream in real-time!

---

## 📦 Project Structure

```
Soniox-PWA/
├── index.html            # Main PWA application markup with Bootstrap 5
├── css/
│   └── styles.css        # Responsive layouts, dark/light theme, audio visualizer styling
├── js/
│   ├── app.js            # Main coordinator, events, device selector, settings
│   ├── soniox-service.js # SonioxClient wrapper loading ESM CDN module
│   ├── ui-manager.js     # Token rendering, diarization cards, exports, visualizer
│   └── pwa-install.js    # Service worker registration & iOS/Android install prompts
├── sw.js                 # Service worker for offline app shell caching
├── manifest.webmanifest  # PWA manifest for installability
├── icons/                # App icons (SVG vector & PNG: 512x512, 192x192, 180x180, 32x32)
├── generate-icons.js     # Node.js script that generated the PNG and SVG icons
├── server.js             # Lightweight local HTTP server with correct MIME types
└── package.json          # Node package definition
```

---

## 🛠️ Technology Stack & CDN Usage

- **Soniox Speech-to-Text Web SDK**:
  ```html
  <script type="module">
    import { SonioxClient } from 'https://unpkg.com/@soniox/speech-to-text-web?module';
    ...
  </script>
  ```
- **Bootstrap 5.3.3**:
  `https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css`
  `https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js`
- **Bootstrap Icons 1.11.3**:
  `https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css`
- **Web APIs**: Web Audio API (`AnalyserNode`), Screen Wake Lock API, MediaStream API (`getUserMedia`), Service Worker API, Web App Manifest.
