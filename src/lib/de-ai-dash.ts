/** Длинное тире в UI выглядит как нейросеть. */
export function deAiDash(text: string): string {
  return text.replace(/ — /g, ", ");
}
