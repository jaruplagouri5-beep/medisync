// ═══════════════════════════════════════════════════
//  MediSync — Reminder & Alarm Engine
//  backend/reminder-engine.js
// ═══════════════════════════════════════════════════

'use strict';

const ReminderEngine = (() => {
  let alarmTimers = [];
  let alarmCallbacks = [];
  let audioCtx = null;
  let unlockListenersAttached = false;

  // ── Audio: Generate alarm beep using Web Audio API ──
  const getAudioCtx = () => {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return null;
    if (!audioCtx) audioCtx = new AudioCtor();
    return audioCtx;
  };

  const unlockAudio = async () => {
    try {
      const ctx = getAudioCtx();
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      // Warm the audio pipeline with an inaudible pulse so later timer-based
      // reminders can ring without waiting for another direct click.
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.01);
    } catch (_) {}
  };

  const attachUnlockListeners = () => {
    if (unlockListenersAttached) return;
    unlockListenersAttached = true;

    const prime = () => unlockAudio();
    ['pointerdown', 'touchstart', 'keydown', 'click'].forEach((eventName) => {
      document.addEventListener(eventName, prime, { passive: true });
    });
  };

  const playAlarm = async (times = 3) => {
    try {
      attachUnlockListeners();
      const ctx = getAudioCtx();
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      if (ctx.state !== 'running') return;

      const play = (t, freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.4, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        osc.start(t);
        osc.stop(t + 0.3);
      };
      let now = ctx.currentTime;
      for (let i = 0; i < times; i++) {
        play(now + i * 0.5, 880);
        play(now + i * 0.5 + 0.15, 1100);
      }
    } catch (e) {
      console.warn('Audio API unavailable — using visual alarm only');
    }
  };

  const onAlarm = (cb) => alarmCallbacks.push(cb);

  const fireAlarm = (reminder, slot) => {
    playAlarm(3);
    alarmCallbacks.forEach(cb => cb(reminder, slot));
  };

  // ── Parse "HH:MM" into today's ms-since-epoch ──
  const todayAt = (timeStr) => {
    const [h, m] = timeStr.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d.getTime();
  };

  const slotName = (timeStr) => {
    const h = parseInt(timeStr.split(':')[0]);
    if (h < 12) return 'morning';
    if (h < 17) return 'afternoon';
    if (h < 20) return 'evening';
    return 'night';
  };

  const scheduleAll = (reminders) => {
    clearAll();
    const now = Date.now();

    reminders.forEach(rem => {
      if (!rem.active) return;
      rem.times.forEach(t => {
        const targetMs = todayAt(t);
        const delay = targetMs - now;
        if (delay > 0 && delay < 24 * 3600 * 1000) {
          const timer = setTimeout(() => {
            const slot = slotName(t);
            if (!rem.taken[slot]) fireAlarm(rem, slot);
          }, delay);
          alarmTimers.push(timer);
        }

        // Demo: also fire a test alarm 4 seconds after scheduling if <= 5 min away
        if (Math.abs(delay) <= 5 * 60 * 1000 && delay < 0) {
          // fired within last 5 min — show as pending
          const slot = slotName(t);
          if (!rem.taken[slot]) {
            const demoTimer = setTimeout(() => fireAlarm(rem, slot), 4000);
            alarmTimers.push(demoTimer);
          }
        }
      });
    });
  };

  const clearAll = () => {
    alarmTimers.forEach(t => clearTimeout(t));
    alarmTimers = [];
  };

  // ── Schedule a demo alarm for testing (fires in N seconds) ──
  const scheduleDemo = (reminder, delaySeconds = 5) => {
    const timer = setTimeout(() => {
      fireAlarm(reminder, 'morning');
    }, delaySeconds * 1000);
    alarmTimers.push(timer);
  };

  attachUnlockListeners();

  return { scheduleAll, scheduleDemo, onAlarm, playAlarm, clearAll, slotName, unlockAudio };

})();

window.ReminderEngine = ReminderEngine;
