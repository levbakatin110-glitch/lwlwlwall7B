import {
  copyFileSync,
  existsSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "fs";

/**
 * Запись без «половинчатого» файла: пишем во временный файл и переименовываем.
 * При падении посреди записи старый файл остаётся целым.
 * Ошибки НЕ глотаем: вызывающий должен знать, что данные не сохранились.
 */
export function writeFileAtomic(path: string, data: string | Buffer): void {
  const tmp = `${path}.${process.pid}.${Date.now().toString(36)}.tmp`;
  try {
    writeFileSync(tmp, data);
    renameSync(tmp, path);
  } catch (e) {
    try {
      if (existsSync(tmp)) unlinkSync(tmp);
    } catch {
      /* ignore */
    }
    throw e;
  }
}

/**
 * Файл не читается как JSON: сохраняем копию рядом (не затираем следующей записью)
 * и возвращаем путь копии (или null, если скопировать не вышло).
 */
export function quarantineCorruptFile(path: string): string | null {
  const dest = `${path}.corrupt-${Date.now()}`;
  try {
    copyFileSync(path, dest);
    console.error(`[data] corrupt file quarantined: ${path} -> ${dest}`);
    return dest;
  } catch (e) {
    console.error(`[data] failed to quarantine ${path}`, e);
    return null;
  }
}
