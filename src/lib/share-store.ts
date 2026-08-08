import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { MemoryStory } from "./types";

export type SharedSceneMedia = {
  memoryId: string;
  date: string;
  text: string;
  photoUrl?: string;
};

export type SharedFilm = {
  id: string;
  createdAt: string;
  babyName: string;
  story: MemoryStory;
  media: SharedSceneMedia[];
};

function sharesDir() {
  return path.join(process.cwd(), "data", "shares");
}

function sharePath(id: string) {
  return path.join(sharesDir(), `${id}.json`);
}

export function newShareId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function saveSharedFilm(film: SharedFilm) {
  await mkdir(sharesDir(), { recursive: true });
  await writeFile(sharePath(film.id), JSON.stringify(film), "utf8");
}

export async function loadSharedFilm(id: string): Promise<SharedFilm | null> {
  if (!/^[a-z0-9-]+$/i.test(id)) return null;
  try {
    const raw = await readFile(sharePath(id), "utf8");
    return JSON.parse(raw) as SharedFilm;
  } catch {
    return null;
  }
}
