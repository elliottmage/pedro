/**
 * Audio System for "Smash Your Week"
 *
 * Procedural sound effects using Web Audio API
 * No external audio files needed
 */

export type SoundType =
  | "paddle_hit"
  | "wall_hit"
  | "block_hit"
  | "block_destroy"
  | "powerup_collect"
  | "ball_lost"
  | "game_win"
  | "game_over"
  | "combo";

/**
 * Audio manager using Web Audio API
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private enabled: boolean = true;
  private volume: number = 0.3;

  constructor() {
    // Defer AudioContext creation until first user interaction
  }

  /**
   * Initialize audio context (must be called after user interaction)
   */
  init(): void {
    if (this.ctx) return;

    try {
      this.ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.ctx.destination);
    } catch (e) {
      console.warn("Web Audio API not supported:", e);
    }
  }

  /**
   * Resume audio context if suspended
   */
  async resume(): Promise<void> {
    if (this.ctx?.state === "suspended") {
      await this.ctx.resume();
    }
  }

  /**
   * Play a sound effect
   */
  play(sound: SoundType): void {
    if (!this.enabled || !this.ctx || !this.masterGain) {
      this.init();
      if (!this.ctx || !this.masterGain) return;
    }

    this.resume();

    switch (sound) {
      case "paddle_hit":
        this.playPaddleHit();
        break;
      case "wall_hit":
        this.playWallHit();
        break;
      case "block_hit":
        this.playBlockHit();
        break;
      case "block_destroy":
        this.playBlockDestroy();
        break;
      case "powerup_collect":
        this.playPowerUp();
        break;
      case "ball_lost":
        this.playBallLost();
        break;
      case "game_win":
        this.playWin();
        break;
      case "game_over":
        this.playGameOver();
        break;
      case "combo":
        this.playCombo();
        break;
    }
  }

  /**
   * Paddle hit - short high blip
   */
  private playPaddleHit(): void {
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(600, this.ctx!.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, this.ctx!.currentTime + 0.05);

    gain.gain.setValueAtTime(0.3, this.ctx!.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx!.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(this.masterGain!);

    osc.start();
    osc.stop(this.ctx!.currentTime + 0.1);
  }

  /**
   * Wall hit - soft thud
   */
  private playWallHit(): void {
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(200, this.ctx!.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, this.ctx!.currentTime + 0.05);

    gain.gain.setValueAtTime(0.2, this.ctx!.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx!.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(this.masterGain!);

    osc.start();
    osc.stop(this.ctx!.currentTime + 0.08);
  }

  /**
   * Block hit (but not destroyed) - click
   */
  private playBlockHit(): void {
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();

    osc.type = "square";
    osc.frequency.setValueAtTime(400, this.ctx!.currentTime);

    gain.gain.setValueAtTime(0.15, this.ctx!.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx!.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(this.masterGain!);

    osc.start();
    osc.stop(this.ctx!.currentTime + 0.05);
  }

  /**
   * Block destroy - satisfying pop/explosion
   */
  private playBlockDestroy(): void {
    // Noise burst
    const bufferSize = this.ctx!.sampleRate * 0.1;
    const buffer = this.ctx!.createBuffer(1, bufferSize, this.ctx!.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
    }

    const noise = this.ctx!.createBufferSource();
    noise.buffer = buffer;

    const noiseGain = this.ctx!.createGain();
    noiseGain.gain.setValueAtTime(0.2, this.ctx!.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, this.ctx!.currentTime + 0.1);

    // Tone
    const osc = this.ctx!.createOscillator();
    const oscGain = this.ctx!.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(300, this.ctx!.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, this.ctx!.currentTime + 0.15);

    oscGain.gain.setValueAtTime(0.25, this.ctx!.currentTime);
    oscGain.gain.exponentialRampToValueAtTime(0.01, this.ctx!.currentTime + 0.15);

    noise.connect(noiseGain);
    noiseGain.connect(this.masterGain!);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain!);

    noise.start();
    osc.start();
    osc.stop(this.ctx!.currentTime + 0.15);
  }

  /**
   * Power-up collect - ascending arpeggio
   */
  private playPowerUp(): void {
    const notes = [400, 500, 600, 800];
    const duration = 0.08;

    notes.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = "sine";
      osc.frequency.value = freq;

      const startTime = this.ctx!.currentTime + i * duration;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.2, startTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(startTime);
      osc.stop(startTime + duration);
    });
  }

  /**
   * Ball lost - descending sad tone
   */
  private playBallLost(): void {
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(400, this.ctx!.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, this.ctx!.currentTime + 0.5);

    gain.gain.setValueAtTime(0.3, this.ctx!.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx!.currentTime + 0.5);

    osc.connect(gain);
    gain.connect(this.masterGain!);

    osc.start();
    osc.stop(this.ctx!.currentTime + 0.5);
  }

  /**
   * Game win - triumphant fanfare
   */
  private playWin(): void {
    const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
    const durations = [0.15, 0.15, 0.15, 0.4];

    let time = this.ctx!.currentTime;

    notes.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = "square";
      osc.frequency.value = freq;

      gain.gain.setValueAtTime(0.2, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + durations[i]);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(time);
      osc.stop(time + durations[i]);

      time += durations[i] * 0.8;
    });
  }

  /**
   * Game over - ominous descending
   */
  private playGameOver(): void {
    const notes = [400, 350, 300, 200];
    const duration = 0.25;

    notes.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = "sawtooth";
      osc.frequency.value = freq;

      const startTime = this.ctx!.currentTime + i * duration * 0.8;
      gain.gain.setValueAtTime(0.15, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(startTime);
      osc.stop(startTime + duration);
    });
  }

  /**
   * Combo - quick ascending blip (higher pitch for higher combos)
   */
  playCombo(comboLevel: number = 1): void {
    if (!this.enabled || !this.ctx || !this.masterGain) return;

    const baseFreq = 500 + comboLevel * 100;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, this.ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  /**
   * Set master volume
   */
  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.masterGain) {
      this.masterGain.gain.value = this.volume;
    }
  }

  /**
   * Get current volume
   */
  getVolume(): number {
    return this.volume;
  }

  /**
   * Enable/disable audio
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if audio is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Toggle audio
   */
  toggle(): boolean {
    this.enabled = !this.enabled;
    return this.enabled;
  }
}

// Singleton instance
export const audioManager = new AudioManager();

export default AudioManager;
