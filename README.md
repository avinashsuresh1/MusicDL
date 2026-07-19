# 🎼 MusicDL (Music Definition Language)

**MusicDL** is a code-first music player and project editor. It allows you to compose music by writing simple YAML files that define instruments, melodies, chords, and tracks, and play them directly in the standalone desktop application.

Think of it like writing code, but the output is a musical composition!

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
* **macOS/Apple**: Compile-ready configuration is included, but testing on physical Apple hardware has not been completed.


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
To package the app into a single, optimized desktop executable with zero runtime dependencies:
1. Compile and bundle the app:
   ```bash
   npx tauri build
   ```
2. Find the packaged outputs:
   * **Windows**: `src-tauri/target/release/MusicDL.exe` (executable) and `src-tauri/target/release/bundle/nsis/` (installer).
   * **macOS**: `src-tauri/target/release/bundle/macos/MusicDL.app` and `src-tauri/target/release/bundle/dmg/` (installer).
   * **Linux**: `src-tauri/target/release/bundle/deb/` (Debian package).

### 3. Load and Play a Sample Song
1. Click the **"📂 Open Folder"** button in the top toolbar of the desktop app.
2. Select one of the pre-built sample folders from this project (e.g., `D:\MusicDL\examples\silent-night` or `examples\chord-progression`).
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
root_frequency: 261.63 # The starting note frequency in Hz (Middle C)
interval: 100          # Step size in cents (e.g., 100 cents = 1 semitone in 12-TET)
```

### 2. Instruments (`instruments/`)
Create custom instruments by combining sound layers (harmonics) and setting how they fade in and out (ADSR volume envelopes):
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

### 3. Melodies (`melodies/`)
Write sequential notes. Notes play sequentially (one after another); **offsets are not used in melodies**. You can also configure a melody to loop continuously to fill the composition duration:
```yaml
instrument: music_box  # References the name of your instrument file
loop: true            # Optional: Enable loop
loop_start: 1.0       # Optional: Start beat of loop (notes before play once as intro)
loop_end: 3.0         # Optional: End beat of loop (defaults to melody duration)
notes:
  - { pitch: 7,  duration: 1.5 } # Plays starting at beat 0
  - { pitch: 9,  duration: 0.5 } # Plays starting at beat 1.5
  - { pitch: rest, duration: 1.0 } # Rest / Silence
```
*   `pitch`: Integer interval from root frequency, or `'rest'` for silence.
*   `duration`: Note duration in beats (float > 0).
*   `loop`, `loop_start`, `loop_end`: Configuration to repeat melody sections continuously.

### 4. Chords (`chords/`)
Chords define a set of pitches played simultaneously. Because they are played together, **chords do not need offsets or durations** inside their definition files:
```yaml
instrument: choir_pad  # References the name of your instrument file
pitches: [0, 4, 7]     # Chord pitches played simultaneously
```

### 5. Tracks (`tracks/`)
Mix melodies and chords together. You can play melodies or chords at any point on the timeline by specifying their starting `offset` inside the track. This makes it easy to reuse a single melody phrase or chord definition multiple times:
```yaml
volume: 0.8  # Master track volume (0.0 to 1.0)
melodies:
  # Play the same melody phrase twice at different times on the timeline
  - { name: silent_night, offset: 0 }
  - { name: silent_night, offset: 6 }
chords:
  # Schedule simultaneous chord play at specific beats and durations
  - { name: c_major, offset: 0, duration: 3.0 }
  - { name: c_major, offset: 3, duration: 3.0 }
```

---

## 🎼 Included Samples
We've prepared four ready-to-play sample projects for you to explore:
* **`simple-melody`**: A basic scale sequence.
* **`chord-progression`**: Warm, ambient chord layers with a bass synth.
* **`grandfather-clock`**: A multi-instrument masterpiece utilizing relative chord sequencing and automated looping clock ticks.
* **`silent-night`**: The complete traditional song demonstrating clean, DRY design with reusable melody phrases and sequenced chord track definitions.

---

*This project was fully implemented by Google Antigravity under human supervision.*
