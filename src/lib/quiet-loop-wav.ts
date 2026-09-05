/** Тихий зацикленный WAV — iPhone берёт в островок только HTML-аудио, не Web Audio. */
export function buildQuietLoopWav(): Blob {
  const sampleRate = 22050;
  const seconds = 2;
  const n = sampleRate * seconds;
  const dataSize = n * 2;
  const buf = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buf);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);
  for (let i = 0; i < n; i++) {
    const sample = Math.sin((2 * Math.PI * 48 * i) / sampleRate) * 120;
    view.setInt16(44 + i * 2, sample, true);
  }
  return new Blob([buf], { type: "audio/wav" });
}
