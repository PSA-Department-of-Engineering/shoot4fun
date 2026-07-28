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
    private analyser: AnalyserNode | null = null;
    private analyserData: Uint8Array<ArrayBuffer> = new Uint8Array(new ArrayBuffer(256));
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
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 512;
        this.masterGain.connect(this.analyser);
        this.analyser.connect(this.ctx.destination);
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

    /** Returns true if the audio graph is producing output above the
     * analyser noise floor. Used by INT-015 to verify the cue fired. */
    peakOver(floor: number = 8): boolean {
        if (!this.analyser) return false;
        this.analyser.getByteTimeDomainData(this.analyserData);
        let max = 0;
        for (const v of this.analyserData) {
            const d = Math.abs(v - 128);
            if (d > max) max = d;
        }
        return max > floor;
    }

    /** Expose the audio engine on `window` for e2e tests (INT-015). */
    exposeTestHooks(): void {
        (window as unknown as { __sfAudioShot: () => void }).__sfAudioShot = () => {
            this.setStarted(true);
            this.shot();
            (window as unknown as { __sfAudioShotCount: number }).__sfAudioShotCount =
                ((window as unknown as { __sfAudioShotCount?: number })
                    .__sfAudioShotCount ?? 0) + 1;
        };
        (window as unknown as { __sfAudioResume: () => void }).__sfAudioResume = () => {
            this.ensure();
            this.resume();
        };
        (window as unknown as { __sfAudioPeakOver: (f: number) => boolean }).__sfAudioPeakOver =
            (f: number) => this.peakOver(f);
        (window as unknown as { __sfGetVolumes: () => { master: number; sfx: number } }).__sfGetVolumes =
            () => {
                const master = Number(window.localStorage.getItem("sf_master_volume") ?? 0.7);
                const sfx = Number(window.localStorage.getItem("sf_sfx_volume") ?? 0.8);
                return { master, sfx };
            };
    }

    shot(): void {
        if (!this.started) return;
        this.ensure();
        if (!this.ctx || !this.sfxGain) return;
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
        filt.frequency.value = 1200;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(1, t + 0.005);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        src.connect(filt).connect(g).connect(this.sfxGain);
        src.start(t);
        src.stop(t + 0.2);
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
