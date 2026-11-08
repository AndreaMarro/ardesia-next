/** Deterministic synthetic audio through the real MediaRecorder pipeline. */
export async function syntheticMicrophone(page: import('@playwright/test').Page, delayed = false) {
  await page.addInitScript(({delayed}) => {
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {value: async () => {
      const context = new AudioContext(), oscillator = context.createOscillator(), destination = context.createMediaStreamDestination();
      oscillator.frequency.value = 220; oscillator.connect(destination); oscillator.start(); await context.resume();
      (window as any).syntheticAudioStream = destination.stream;
      if (delayed) await new Promise<void>(resolve => {(window as any).releaseSyntheticMicrophone = resolve;});
      return destination.stream;
    }});
  }, {delayed});
}
