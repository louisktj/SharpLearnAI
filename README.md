# SharpLearn — Your AI Study Companion

> Turn lectures into structured notes, track your focus in real time, and leave class with a beautiful, study-ready review sheet.

<!-- Badges (update as needed) -->
[![Status](https://img.shields.io/badge/status-beta-blue.svg)](#)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](#)
[![Made with AI](https://img.shields.io/badge/AI-Gemini-black.svg)](#)

## ✨ What SharpLearn Does

- **Live Capture & Transcription**
  - Streams microphone audio during class and transcribes in real time using the **Gemini API**.
  - At session end, auto-formats the full transcript into **clean, organized HTML notes**.

- **Focus Tracking (0–100)**
  - Uses the webcam to periodically estimate your **attention score** and shows a live progress bar.
  - Logs **low-focus moments** for quick revisit; shows **gentle on-screen nudges** when attention dips.
  - (Optional) If focus collapses, triggers a **notification to a “teacher”** using an external service like **IFTTT**.

- **Smart Review Sheets**
  - Generates a **magazine-style** study sheet after each session:
    - Title + subtitle, **key points**, **definitions**, **examples**
    - **“To remember”**, **keywords**, and **questions for your teacher**
    - A **focus timeline chart** highlighting segments to revisit

- **Interactive Learning Tools**
  - **AI-generated MCQ quizzes** from your session content
  - **One-click PDF export** for offline study or printing

- **Course & Session Management**
  - Create and organize courses (e.g., *Biology 101*, *Art History*).
  - Each recording saves into its course library.
  - **Quick Record**: SharpLearn suggests a **relevant course name** based on live content.

## 🧭 Demo
<img width="1151" height="624" alt="Screenshot 2025-11-09 at 10 47 10 AM" src="https://github.com/user-attachments/assets/dac12d81-138a-4a74-b6ab-0ed8c4bd393f" />
<img width="1201" height="675" alt="Screenshot 2025-11-09 at 10 47 22 AM" src="https://github.com/user-attachments/assets/b927e804-da69-4255-b1d7-d6c03a42c412" />

### Core Endpoints (example)
- `POST /transcribe` → ingest/stream audio chunks → partial + final transcripts
- `POST /summarize` → transform transcript → structured notes + magazine-style HTML
- `POST /focus` → ingest client-side focus metrics → analytics + thresholds
- `POST /notify` (optional) → call IFTTT webhook when focus is critically low

> **Note:** Endpoint names are illustrative; match them to your implementation.

## 🛠️ Tech Stack

- **Frontend:** React + TypeScript, Media APIs (getUserMedia), Canvas/Chart for focus graph, HTML→PDF
- **AI:** Gemini API (speech→text, summarization, quiz generation, metadata extraction)
- **Backend:** Node.js **or** FastAPI (REST), IFTTT webhook integration (optional)
- **Build/Tooling:** Vite/Next (choose one), ESLint/Prettier
- **Storage:** Local/Cloud (choose your provider for transcripts, notes, and sessions)

## 🚀 Quick Start

> Prereqs: Node 18+, Python 3.10+ (if using FastAPI), a modern browser, a valid **GEMINI_API_KEY**.

1. **Clone**
   ```bash
   git clone https://github.com/your-org/sharplearn.git
   cd sharplearn
   ```

2. **Env Vars**
   Create `.env` files:

   - `apps/web/.env`
     ```
     VITE_GEMINI_API_BASE=/api     # proxy path or direct API URL
     VITE_ENABLE_IFTTT=false
     ```

   - `apps/api/.env`
     ```
     GEMINI_API_KEY=your_gemini_key
     IFTTT_WEBHOOK_URL=https://maker.ifttt.com/trigger/FOCUS_ALERT/with/key/xxxx   # optional
     ```

3. **Install**
   ```bash
   # web
   cd apps/web && npm install
   # api (Node.js)
   cd ../api && npm install
   # or, if using FastAPI:
   pip install -r requirements.txt
   ```

4. **Run Dev**
   ```bash
   # terminal 1 — backend (Node.js)
   cd apps/api && npm run dev

   # terminal 2 — web
   cd apps/web && npm run dev
   ```

5. **Open**
   - Visit `http://localhost:5173` (or your dev URL)
   - Allow **mic** + **camera** permissions

## 🔐 Privacy & Safety

- **On-device camera frames** are sampled periodically and processed to compute a **focus score**; no raw video is stored by default.
- Audio and transcripts are used **only** to generate your notes and quizzes.
- You control **export** (PDF) and **notifications** (IFTTT off by default).

> Review `/apps/web/src/config/privacy.ts` (or equivalent) to adjust data handling.

## ⚙️ Configuration

- **Focus sampling rate** (e.g., every 5–10s)
- **Low-focus threshold** (e.g., 25/100)
- **Nudge behavior** (toast vs. modal)
- **PDF layout** (margins, fonts, cover)
- **Course auto-naming** (top-keywords from transcript)

## 🧪 Testing Checklist

- Mic capture & live transcript
- Focus score updates and UI bar
- Low-focus logging + timeline markers
- Summary → HTML review sheet
- Quiz generation (MCQ)
- PDF export (content not cut; styles preserved)
- IFTTT notification (if enabled)

## 🗺️ Roadmap

- Offline cache for notes
- Multi-speaker diarization
- Collaborative study rooms
- Mobile PWA capture
- LMS (Canvas/Moodle) export

## 🤝 Contributing

PRs welcome! Please:
1. Open an issue to discuss scope.
2. Follow code style + tests.
3. Keep features behind flags when uncertain.

## 📜 License

MIT © You

## 🙌 Acknowledgments

- Gemini API for transcription & summarization
- IFTTT for optional alerting
- Everyone who tested SharpLearn in real classes

---

> _SharpLearn aims to turn passive listening into an **active, measurable, and optimized** learning flow. Happy studying!_

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
