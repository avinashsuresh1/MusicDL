# 🎼 MusicDL (Music Definition Language)

**MusicDL** is a code-first music player and project editor. It allows you to compose music by writing simple YAML files that define instruments, melodies, chords, and tracks, and play them directly in the standalone desktop application.

Think of it like writing code, but the output is a musical composition!

> [!WARNING]
> **Branch & Release Policy**: Code on the `main` / `master` branch is considered **unstable** and in active development. Official release tags (e.g., [`v1.1.3`](https://github.com/avinashsuresh1/MusicDL/releases/tag/v1.1.3), `v1.1.2`) are created only when changes are finalized, verified, and stable without regressions. Always use tagged releases for stable deployment.

---

## 🚀 How to Get Started

MusicDL can be run in development mode or built into a standalone native desktop application with direct, sandbox-free filesystem access.

### Prerequisites
* **Node.js**: version `v24.18.0` or higher.
* **Rust**: stable toolchain installed (via [rustup](https://rustup.rs/)).
* **Linux System Libraries** (if running or building on Linux):
  * **Audio Development Files** (ALSA headers are required to compile the native Rust player):
    ```bash
    sudo apt-get install libasound2-dev
    ```
* **Windows**: Visual Studio C++ Build Tools or MinGW toolchain installed.
* **macOS / Apple**: Compile-ready configuration is included for `.app` and `.dmg` bundles, but **testing on physical Mac hardware has not been performed**.


### 1. Run in Development Mode
To run the interactive desktop editor locally:
1. Open your terminal in this folder and install dependencies:
   ```bash
   npm install
   ```
2. Launch the desktop app:
   ```bash
   npx tauri dev
   ```
   *(This compiles the Rust backend and opens the standalone editor window. Changes inside the window will automatically hot-reload!)*

### 2. Build the Standalone Production App
To package the app into single, optimized desktop installers with zero runtime dependencies:
1. Compile and bundle the app:
   ```bash
   npx tauri build
   ```
2. Find the packaged outputs:
   * **Linux**: `src-tauri/target/release/bundle/deb/` (`.deb` Debian package) and `src-tauri/target/release/bundle/rpm/` (`.rpm` Fedora package).
   * **Windows**: `src-tauri/target/release/MusicDL.exe` (standalone executable), `src-tauri/target/release/bundle/nsis/` (`.exe` installer), and `src-tauri/target/release/bundle/msi/` (`.msi` installer).
   * **macOS**: `src-tauri/target/release/bundle/macos/MusicDL.app` and `src-tauri/target/release/bundle/dmg/` (`.dmg` installer) *(Note: macOS hardware testing has not been performed).*

### 3. Load and Play a Sample Song
1. Click the **"📂 Open Folder"** button in the top toolbar of the desktop app.
2. Select one of the pre-built sample folders from this project (e.g., `examples/simple-melody`, `examples/silent-night`, or `examples/grandfather-clock`).
3. Click the **"▶ Run"** button to play the song. You will hear the sound synthesize in real-time and see notes light up in the timeline visualizer!
4. Click **"⏹ Stop"** to halt playback.
5. Make edits to the YAML files directly in the editor and click **"Save"** to write back directly to the local folder!

---

## ✍️ How to Compose and Edit

A MusicDL project is organized into five simple components:

### 1. Global Setup (`composition.yaml`)
Define the name, speed, and base tuning of your song:
```yaml
title: "My Song"
tempo: 80              # Playback speed in Beats Per Minute (BPM)
root_frequency: 261.63 # Starting note frequency in Hz (261.63 = Mid C4, 130.81 = Bass C3, 523.25 = High C5)
interval: 100          # Step size in cents (e.g., 100 cents = 1 semitone in 12-TET)
```

> [!TIP]
> **Octave Transposition via `root_frequency`**: Changing `root_frequency` transposes the entire scale into any instrument's optimal acoustic register ($130.81\text{ Hz}$ for Sub Bass, $261.63\text{ Hz}$ for Bansuri/Piano, $523.25\text{ Hz}$ for Flute/Bells).

### 2. Code-Defined Instruments (`instruments/`)
MusicDL enables you to craft full acoustic and synthetic instruments **using nothing but code**. You define timbres with **additive synthesis** (harmonic partial multipliers $z$ and amplitudes) and **ADSR envelopes**:
```yaml
harmonics:
  - { z: 1, amplitude: 1.0 }   # Fundamental tone
  - { z: 2, amplitude: 0.5 }   # One octave higher
  - { z: 3, amplitude: 0.2 }   # Perfect fifth higher
adsr:
  attack: 150    # Fade-in time (in milliseconds)
  decay: 200     # Decay time down to sustain level (in milliseconds)
  sustain: 0.6   # Constant volume level while note is held (0.0 to 1.0)
  release: 600   # Ring-out time after note finishes (in milliseconds)
```

#### Verified Code-Defined Instrument Presets
* **Bansuri (Indian Bamboo Flute)** (`bansuri.yaml`): `harmonics: [{z: 1, amp: 0.2}, {z: 3, amp: 0.2}, {z: 0.1, amp: 0.0025}], adsr: {attack: 800, decay: 100, sustain: 0.3, release: 200}`
* **Flute** (`flute.yaml`): `harmonics: [{z: 1.0, amp: 1.0}, {z: 2.0, amp: 0.12}, {z: 0.5, amp: 0.08}, {z: 3.0, amp: 0.04}], adsr: {attack: 50, decay: 40, sustain: 0.92, release: 200}`
* **Piano** (`piano.yaml`): `harmonics: [{z: 1, amp: 1.0}, {z: 2, amp: 0.5}, {z: 3, amp: 0.25}, {z: 4, amp: 0.12}], adsr: {attack: 5, decay: 300, sustain: 0.2, release: 350}`
* **Tubular Bell** (`bell.yaml`): `harmonics: [{z: 1.0, amp: 1.0}, {z: 2.76, amp: 0.5}, {z: 5.4, amp: 0.25}], adsr: {attack: 1, decay: 400, sustain: 0.0, release: 1200}`
* **String Ensemble** (`strings.yaml`): `harmonics: [{z: 1, amp: 1.0}, {z: 2, amp: 0.7}, {z: 3, amp: 0.45}], adsr: {attack: 150, decay: 200, sustain: 0.85, release: 600}`
* **Plucked Guitar** (`guitar.yaml`): `harmonics: [{z: 1, amp: 1.0}, {z: 2, amp: 0.4}, {z: 3, amp: 0.2}], adsr: {attack: 2, decay: 150, sustain: 0.15, release: 120}`
* **80s Sub Bass Synth** (`sub_bass.yaml`): `harmonics: [{z: 0.5, amp: 0.4}, {z: 1, amp: 1.0}, {z: 2, amp: 0.6}], adsr: {attack: 10, decay: 120, sustain: 0.7, release: 100}`

### 3. Melodies (`melodies/`)
Write sequential notes. Notes play sequentially (one after another); **offsets are not used in melodies**. You can also configure a melody to loop continuously to fill the composition duration:
```yaml
instrument: bansuri   # References the name of your instrument file
loop: true            # Optional: Enable loop
loop_start: 1.0       # Optional: Start beat of loop
loop_end: 3.0         # Optional: End beat of loop
notes:
  - { pitch: 0,  duration: 1.0 } # Plays starting at beat 0
  - { pitch: 2,  duration: 1.0 } # Plays starting at beat 1
  - { pitch: rest, duration: 1.0 } # Rest / Silence
```
*   `pitch`: Integer interval from root frequency, or `'rest'` for silence.
*   `duration`: Note duration in beats (float > 0).
*   `loop`, `loop_start`, `loop_end`: Configuration to repeat melody sections continuously.

### 4. Chords (`chords/`)
Chords define a set of pitches played simultaneously. Because they are played together, **chords do not need offsets or durations** inside their definition files:
```yaml
instrument: pad        # References the name of your instrument file
pitches: [0, 4, 7]     # Chord pitches played simultaneously
```

### 5. Tracks (`tracks/`)
Mix melodies and chords together. You can play melodies or chords at any point on the timeline by specifying their starting `offset` inside the track:
```yaml
volume: 0.8  # Master track volume (0.0 to 1.0)
melodies:
  - { name: scale, offset: 0 }
chords:
  - { name: c_major, offset: 0, duration: 3.0 }
```

---

## 🎼 Included Sample Projects & Test-Bench
* **`simple-melody` (Multi-Instrument Test-Bench)**: A complete scale test-bench co-locating all 10 code-defined instrument YAML files (`bansuri.yaml`, `flute.yaml`, `piano.yaml`, `bell.yaml`, `strings.yaml`, `guitar.yaml`, `sub_bass.yaml`, `saxophone.yaml`, `tick.yaml`, `sine_pad.yaml`). Change `instrument: bansuri` in `scale.yaml` or change `root_frequency` in `composition.yaml` to test any instrument across octaves!
* **`chord-progression`**: Warm, ambient chord layers with a bass synth.
* **`grandfather-clock`**: A multi-instrument masterpiece utilizing relative chord sequencing and automated looping clock ticks.
* **`silent-night`**: The complete traditional song demonstrating reusable melody phrases and sequenced chord track definitions.

---

*This project was fully implemented by Google Antigravity under human supervision.*
