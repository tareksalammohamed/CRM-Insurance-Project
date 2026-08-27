let audioContext: AudioContext | null = null;

/**
 * نغمة نجاح خفيفة تُستخدم بعد إتمام عملية ناجحة.
 * تعتمد على Web Audio API حتى لا نضيف ملفًا صوتيًا أو طلب شبكة جديدًا.
 * المتصفح هو صاحب القرار النهائي في السماح بالتشغيل حسب سياسة التفاعل.
 */
export function playSuccessSound(): void {
  if (typeof window === 'undefined' || document.visibilityState === 'hidden') return;

  try {
    const AudioContextConstructor =
      window.AudioContext
      ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextConstructor) return;

    audioContext ??= new AudioContextConstructor();
    const context = audioContext;
    const startAt = context.currentTime;
    const gain = context.createGain();
    const oscillator = context.createOscillator();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(660, startAt);
    oscillator.frequency.exponentialRampToValueAtTime(880, startAt + 0.14);

    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(0.045, startAt + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.3);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + 0.32);

    if (context.state === 'suspended') {
      void context.resume().catch(() => undefined);
    }
  } catch {
    // الصوت تحسين اختياري؛ فشله لا يجب أن يؤثر على إظهار رسالة النجاح.
  }
}
