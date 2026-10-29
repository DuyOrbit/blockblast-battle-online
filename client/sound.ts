/**
 * Sound Controller for BlockBlast Arena.
 * Uses authentic Block Blast mobile audio assets extracted directly from the original APK,
 * with seamless procedural Web Audio API synthesis as instant zero-latency fallback!
 */
export class SoundController {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private audioBuffers: Map<string, AudioBuffer> = new Map();
  private loadingPromises: Map<string, Promise<AudioBuffer | null>> = new Map();

  // Pentatonic musical scale for procedural fallback
  private readonly pentatonicScale = [
    261.63, // C4
    293.66, // D4
    329.63, // E4
    392.00, // G4
    440.00, // A4
    523.25, // C5
    587.33, // D5
    659.25, // E5
    783.99, // G5
    880.00, // A5
    1046.50 // C6
  ];

  constructor() {
    // Preload audio files as soon as possible
    this.preloadAudios();
  }

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private preloadAudios() {
    const soundList = [
      'place',
      'pickup',
      'streak_1',
      'streak_2',
      'streak_3',
      'streak_4',
      'streak_5',
      'streak_6',
      'streak_7',
      'streak_8',
      'streak_9',
      'streak_10',
      'good',
      'great',
      'amazing',
      'excellent',
      'unbelievable',
      'gameover',
      'new_record',
      'restart'
    ];

    for (const key of soundList) {
      this.loadSound(key, `/audio/${key}.ogg`);
    }
  }

  private async loadSound(key: string, url: string): Promise<AudioBuffer | null> {
    if (this.audioBuffers.has(key)) {
      return this.audioBuffers.get(key)!;
    }
    if (this.loadingPromises.has(key)) {
      return this.loadingPromises.get(key)!;
    }

    const promise = (async () => {
      try {
        const resp = await fetch(url);
        if (!resp.ok) return null;
        const arrayBuf = await resp.arrayBuffer();
        this.initContext();
        if (!this.ctx) return null;
        const audioBuf = await this.ctx.decodeAudioData(arrayBuf);
        this.audioBuffers.set(key, audioBuf);
        return audioBuf;
      } catch (e) {
        return null;
      }
    })();

    this.loadingPromises.set(key, promise);
    return promise;
  }

  private playBuffer(
    buffer: AudioBuffer,
    volume: number = 1.0,
    playbackRate: number = 1.0,
    delaySec: number = 0
  ) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = playbackRate;

    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(volume, this.ctx.currentTime + delaySec);

    source.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    source.start(this.ctx.currentTime + delaySec);
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Crisp UI button click sound
   */
  public playClick() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.04);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.04);
  }

  /**
   * Subtle mechanical click when hovering over UI buttons
   */
  public playHover() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(700, now + 0.025);

    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.025);
  }

  /**
   * Authentic Block Blast block pickup / touch sound
   */
  public playPickup() {
    if (this.isMuted) return;
    const buf = this.audioBuffers.get('pickup');
    if (buf) {
      this.playBuffer(buf, 0.45);
      return;
    }

    // Procedural fallback
    this.initContext();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(380, now);
    osc.frequency.exponentialRampToValueAtTime(720, now + 0.06);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.07);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  /**
   * Authentic Block Blast block placement thud (`s_put.ogg`)
   */
  public playPlace() {
    if (this.isMuted) return;
    const buf = this.audioBuffers.get('place');
    if (buf) {
      this.playBuffer(buf, 0.7);
      return;
    }

    // Procedural fallback
    this.initContext();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const snapOsc = this.ctx.createOscillator();
    const snapGain = this.ctx.createGain();
    snapOsc.type = 'sine';
    snapOsc.frequency.setValueAtTime(600, now);
    snapOsc.frequency.exponentialRampToValueAtTime(120, now + 0.04);
    snapGain.gain.setValueAtTime(0.2, now);
    snapGain.gain.exponentialRampToValueAtTime(0.01, now + 0.04);
    snapOsc.connect(snapGain);
    snapGain.connect(this.ctx.destination);
    snapOsc.start(now);
    snapOsc.stop(now + 0.04);

    const bodyOsc = this.ctx.createOscillator();
    const bodyGain = this.ctx.createGain();
    bodyOsc.type = 'triangle';
    bodyOsc.frequency.setValueAtTime(140, now);
    bodyOsc.frequency.exponentialRampToValueAtTime(55, now + 0.09);
    bodyGain.gain.setValueAtTime(0.22, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.01, now + 0.09);
    bodyOsc.connect(bodyGain);
    bodyGain.connect(this.ctx.destination);
    bodyOsc.start(now);
    bodyOsc.stop(now + 0.09);
  }

  /**
   * Authentic Block Blast dopamine streak clearing chord (`e_score_streak_1` to `10.ogg`)
   * and authentic praise voice shout ("Good!", "Great!", "Amazing!", "Excellent!", "Unbelievable!")
   */
  public playLineClear(combo: number = 1) {
    if (this.isMuted) return;

    const streakIdx = Math.max(1, Math.min(combo, 10));
    const streakBuf = this.audioBuffers.get(`streak_${streakIdx}`);

    if (streakBuf) {
      // If combo > 10, pitch up the streak_10 sound for endless dopamine acceleration
      const pitch = combo > 10 ? 1.0 + Math.min(combo - 10, 10) * 0.05 : 1.0;
      this.playBuffer(streakBuf, 0.85, pitch);

      // Play authentic voice shout praise synchronized with the chord
      if (combo === 2) {
        const v = this.audioBuffers.get('good');
        if (v) this.playBuffer(v, 0.9, 1.0, 0.15);
      } else if (combo === 4) {
        const v = this.audioBuffers.get('great');
        if (v) this.playBuffer(v, 0.9, 1.0, 0.15);
      } else if (combo === 6) {
        const v = this.audioBuffers.get('amazing');
        if (v) this.playBuffer(v, 0.9, 1.0, 0.15);
      } else if (combo === 8) {
        const v = this.audioBuffers.get('excellent');
        if (v) this.playBuffer(v, 0.9, 1.0, 0.15);
      } else if (combo >= 10 && (combo % 2 === 0)) {
        const v = this.audioBuffers.get('unbelievable');
        if (v) this.playBuffer(v, 0.95, 1.0, 0.15);
      }
      return;
    }

    // Procedural fallback
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const noteIndex = Math.min(Math.max(combo - 1, 0), this.pentatonicScale.length - 1);
    const fundamental = this.pentatonicScale[noteIndex];

    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(fundamental, now);
    osc1.frequency.exponentialRampToValueAtTime(fundamental * 1.02, now + 0.25);
    gain1.gain.setValueAtTime(0.24, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(this.ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(fundamental * 2.76, now);
    gain2.gain.setValueAtTime(0.08, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc2.connect(gain2);
    gain2.connect(this.ctx.destination);
    osc2.start(now);
    osc2.stop(now + 0.18);
  }

  /**
   * Deep sub-bass drop rumble for heavy multi-line clears
   */
  public playSubBassDrop() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(95, now);
    osc.frequency.exponentialRampToValueAtTime(36, now + 0.4);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.45);
  }

  /**
   * Powerful multi-line clear sound with sub-bass drop
   */
  public playMultiClear(linesCount: number, combo: number = 1) {
    this.playLineClear(combo);
    this.playSubBassDrop();
  }

  /**
   * High-octane attack projectile sound when sending garbage
   */
  public playAttackWhoosh(isOutgoing: boolean = true) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    if (isOutgoing) {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.18);
      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.linearRampToValueAtTime(580, now + 0.15);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    }

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.22);
  }

  /**
   * Countdown beeps ("READY... GO!")
   */
  public playCountdownBeep(isGo: boolean = false) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    if (isGo) {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.25);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      this.playSubBassDrop();
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    }

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + (isGo ? 0.35 : 0.15));
  }

  public playAttackAlert() {
    this.playAttackWhoosh(false);
  }

  /**
   * Victory fanfare
   */
  public playVictory() {
    if (this.isMuted) return;
    const buf = this.audioBuffers.get('new_record');
    if (buf) {
      this.playBuffer(buf, 0.8);
      return;
    }

    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const notes = [261.6, 329.6, 392.0, 523.25, 659.25, 783.99];

    notes.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.09);
      gain.gain.setValueAtTime(0.2, now + i * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.35);
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(now + i * 0.09);
      osc.stop(now + i * 0.09 + 0.35);
    });
  }

  /**
   * Authentic Block Blast defeat / game over sound (`s_fail.ogg`)
   */
  public playDefeat() {
    if (this.isMuted) return;
    const buf = this.audioBuffers.get('gameover');
    if (buf) {
      this.playBuffer(buf, 0.85);
      return;
    }

    this.initContext();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = [392.0, 349.2, 311.1, 261.6];

    notes.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + i * 0.14);
      gain.gain.setValueAtTime(0.12, now + i * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.14 + 0.25);
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(now + i * 0.14);
      osc.stop(now + i * 0.14 + 0.25);
    });
  }

  /**
   * Authentic new high record fanfare
   */
  public playNewRecord() {
    if (this.isMuted) return;
    const buf = this.audioBuffers.get('new_record');
    if (buf) {
      this.playBuffer(buf, 0.85);
    } else {
      this.playVictory();
    }
  }

  /**
   * Restart sound
   */
  public playRestart() {
    if (this.isMuted) return;
    const buf = this.audioBuffers.get('restart');
    if (buf) {
      this.playBuffer(buf, 0.7);
    } else {
      this.playClick();
    }
  }

  public playDamageHit(isCritical: boolean = false) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = isCritical ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(isCritical ? 160 : 220, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + (isCritical ? 0.25 : 0.15));

    gain.gain.setValueAtTime(isCritical ? 0.35 : 0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (isCritical ? 0.25 : 0.15));

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + (isCritical ? 0.25 : 0.15));
  }

  public playParryCounter() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1760, now + 0.12);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.15);
  }
}

export const sound = new SoundController();
