# GenLayer: who decides if the job was done well?

A 108-second, 1920×1080 / 60 fps motion graphic for an X (Twitter) post about GenLayer as the judgment layer of the agentic economy.

- **Video:** `out/genlayer-motion.mp4` (H.264 High, yuv420p, AAC 48 kHz, faststart: ready for X)
- **Palette:** `#ff87ff` pink, `#dc00ff` purple, light blue `#8fdcff`, light green `#9dffc6`
- **Logo:** vectorised from the supplied PNG (`assets/logo-source.png` → `assets/logo.svg`, `src/logo.js`), then extruded in 3D

## Storyboard

| Time | Scene | Tweet line |
|---|---|---|
| 0:00 | Agent terminal → `TASK COMPLETE` | An AI agent finished the job. |
| 0:08 | Stamp glitches to `VERIFIED BY: ???` | But who decides if the job was actually done well? |
| 0:14 | 3D layer stack with an empty "judgment" slot | That's the missing layer in an agentic economy. |
| 0:20 | 3D network of ~2,200 agents + 4 role cards | Imagine thousands of AI agents… research / write / verify / execute |
| 0:32 | 99.2% confident answer, scanned, stamped WRONG | The problem? A confident answer that is simply wrong. |
| 0:42 | Self-check loop crossed out → ring of validators | Can't blindly trust the same AI → independent verification |
| 0:50 | Drop: 3D GenLayer mark assembles | This is where GenLayer becomes interesting. Intelligent Contracts + decentralized validation |
| 0:58 | Question shift | "Did the code execute?" → "Does this output satisfy the requirements?" Automated QA, Collective Memory |
| 1:06 | Pipeline with packet, votes (4/5 PASS) and block | AI Agent → GenLayer → Consensus → Protocol |
| 1:20 | AI-in-a-contract crossed out; GenLayer fills the missing layer | A trustless layer for decisions that require judgment |
| 1:30 | Ring: execution 50% → judgment 100% | Execution is only half the problem… good enough |
| 1:38 | End card | One of the most important problems GenLayer is trying to solve |

## How it is made

Everything is generated in code: no stock footage, samples or templates.

- `src/`: one deterministic page. `window.renderFrame(t)` draws the frame at time `t`: Three.js (WebGL) handles the 3D, bloom and a custom final pass (ACES, cheap AA, glitch and chroma), and DOM/CSS handles the crisp kinetic typography.
- `src/scenes/*.js`: one module per scene. The timings live in `src/timeline.json`.
- `scripts/render.mjs`: headless Chromium (SwiftShader WebGL) captures every frame in parallel workers and pipes them to ffmpeg.
- `audio/synth.py`: the soundtrack (120 BPM, A minor) and every sound effect, synthesised with numpy/scipy on the same cue times, then loudness-normalised to −14 LUFS.

## Rebuild

```bash
npm install
pip install numpy scipy
python3 audio/synth.py                                   # -> out/soundtrack.wav
node scripts/render.mjs --stills 3.75,52.8               # check single frames
node scripts/render.mjs --fps 30 --scale 0.5 --out out/preview.mp4   # quick preview
node scripts/render.mjs --fps 60 --workers 3 --audio out/soundtrack.wav --out out/genlayer-motion.mp4
```
