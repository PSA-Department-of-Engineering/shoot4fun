/* Web Audio engine. All sounds are generated procedurally; no audio
 * files in the repo. The four families:
 *  - shot (200ms noise burst)
 *  - hit  (100ms filtered noise)
 *  - footstep (50ms click)
 *  - ui (oscillator triad for horn/sting)
 * Volumes read from `localStorage` (`sf_master_volume`, `sf_sfx_volume`)
 * and live-update on the `storage` event.
 */

const STORAGE_MASTER = "sf_master_volume";
const STORAGE_SFX = "sf_sfx_volume";

function readVolume(key: string, fallback: number): number {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback;
}

export class AudioEngine {
    private ctx: AudioContext | null = null;
    private masterGain: GainNode | null = null;
    private sfxGain: GainNode | null = null;
    private started = false;

    ensure(): void {
        if (this.ctx) return;
        const Ctor: typeof AudioContext =
            (window as unknown as { AudioContext?: typeof AudioContext })
                .AudioContext ??
            (window as unknown as { webkitAudioContext?: typeof AudioContext })
                .webkitAudioContext!;
        if (!Ctor) return;
        this.ctx = new Ctor();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = readVolume(STORAGE_MASTER, 0.7);
        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.value = readVolume(STORAGE_SFX, 0.8);
        // Every cue is an effect, so the effects bus feeds the master bus
        // and the master bus is the only thing that reaches the speakers.
        // A sub-bus left unconnected is a game that renders sound nobody
        // hears.
        this.sfxGain.connect(this.masterGain);
        this.masterGain.connect(this.ctx.destination);
        window.addEventListener("storage", (e) => {
            if (e.key === STORAGE_MASTER) {
                this.masterGain!.gain.value = readVolume(STORAGE_MASTER, 0.7);
            } else if (e.key === STORAGE_SFX) {
                this.sfxGain!.gain.value = readVolume(STORAGE_SFX, 0.8);
            }
        });
    }

    resume(): void {
        this.ensure();
        if (this.ctx && this.ctx.state === "suspended") {
            this.ctx.resume();
        }
    }

    /** A gunshot. `level` carries distance: a rifle across the arena is
     * the same sound quieter and duller, so the ear places it. */
    shot(level: number = 1): void {
        if (!this.started) return;
        this.ensure();
        if (!this.ctx || !this.sfxGain) return;
        const loudness = Math.max(0, Math.min(1, level));
        if (loudness <= 0.02) return;
        const t = this.ctx.currentTime;
        const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.2, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
        }
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const filt = this.ctx.createBiquadFilter();
        filt.type = "lowpass";
        // Air eats the top end first, so a distant shot is a thump.
        filt.frequency.value = 400 + 800 * loudness;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(loudness, t + 0.005);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        src.connect(filt).connect(g).connect(this.sfxGain);
        src.start(t);
        src.stop(t + 0.2);
    }

    /** Taking a hit: a low thud under the hit indicator. */
    hurt(): void {
        if (!this.started) return;
        this.ensure();
        if (!this.ctx || !this.sfxGain) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(180, t);
        osc.frequency.exponentialRampToValueAtTime(55, t + 0.25);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.5, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        osc.connect(g).connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.3);
    }

    hit(): void {
        if (!this.started) return;
        this.ensure();
        if (!this.ctx || !this.sfxGain) return;
        const t = this.ctx.currentTime;
        const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.1, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
            data[i] = (Math.random() * 2 - 1);
        }
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const filt = this.ctx.createBiquadFilter();
        filt.type = "bandpass";
        filt.frequency.value = 400;
        filt.Q.value = 2;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.6, t + 0.005);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        src.connect(filt).connect(g).connect(this.sfxGain);
        src.start(t);
        src.stop(t + 0.1);
    }

    footstep(): void {
        if (!this.started) return;
        this.ensure();
        if (!this.ctx || !this.sfxGain) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        osc.type = "square";
        osc.frequency.setValueAtTime(120, t);
        osc.frequency.exponentialRampToValueAtTime(40, t + 0.05);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.2, t + 0.005);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        osc.connect(g).connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.05);
    }

    /** Match-start horn (lobby -> playing) and results sting (playing -> results). */
    sting(notes: number[]): void {
        if (!this.started) return;
        this.ensure();
        if (!this.ctx || !this.sfxGain) return;
        const t0 = this.ctx.currentTime;
        const step = 0.15;
        notes.forEach((freq, idx) => {
            const t = t0 + idx * step;
            const osc = this.ctx!.createOscillator();
            osc.type = "triangle";
            osc.frequency.setValueAtTime(freq, t);
            const g = this.ctx!.createGain();
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(0.3, t + 0.02);
            g.gain.exponentialRampToValueAtTime(0.001, t + step);
            osc.connect(g).connect(this.sfxGain!);
            osc.start(t);
            osc.stop(t + step);
        });
    }

    setStarted(v: boolean): void {
        this.started = v;
    }
}
