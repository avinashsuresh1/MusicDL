# 🎼 MusicDL (Music Definition Language)

**MusicDL** is a code-first music player and project editor. It allows you to compose music by writing simple YAML files that define instruments, melodies, chords, and tracks, and play them directly in your web browser.

Think of it like writing code, but the output is a musical composition!

---

## 🚀 How to Get Started

### 1. Run the App Locally
To run the interactive MusicDL editor on your machine:
1. Open your terminal in this folder and install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Open your browser and navigate to **`http://localhost:3000/`**.

### 2. Load and Play a Sample Song
1. Click the **"📂 Open Folder"** button in the top toolbar.
2. Select one of the pre-built sample folders from this project (e.g., `D:\MusicDL\examples\silent-night` or `examples\chord-progression`).
3. Click the **"▶ Run"** button to play the song. You will hear the sound synthesize in real-time, and see notes light up in the visualizer as the playhead sweeps over them!
4. Click **"⏹ Stop"** to halt playback.

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
Write sequential notes (starting from offset `0`). Notes have a relative pitch step (numbers representing interval steps relative to the root frequency, or `'rest'` for silence), a relative start beat, and a duration:
```yaml
instrument: music_box  # References the name of your instrument file
notes:
  - { pitch: 7,  offset: 0.0, duration: 1.5 } # First note
  - { pitch: 9,  offset: 1.5, duration: 0.5 } # Next note follows
  - { pitch: rest, offset: 2.0, duration: 1.0 } # Silence / Rest
```

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
We've prepared three ready-to-play sample projects for you to explore:
* **`simple-melody`**: A basic scale sequence.
* **`chord-progression`**: Warm, ambient chord layers with a bass synth.
* **`silent-night`**: The complete traditional song demonstrating clean, DRY design with reusable melody phrases and sequenced chord track definitions.

---

*This project was fully implemented by Google Antigravity under human supervision.*
