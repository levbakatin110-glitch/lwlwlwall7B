export const COMMUNITY_REACTIONS = [
  "❤️",
  "👍",
  "😂",
  "🥰",
  "😢",
  "🔥",
  "👏",
  "😮",
] as const;

export type CommunityReaction = (typeof COMMUNITY_REACTIONS)[number];

export function isCommunityReaction(value: string): value is CommunityReaction {
  return (COMMUNITY_REACTIONS as readonly string[]).includes(value);
}

export function mediaPreviewText(kind?: string, text?: string): string {
  if (kind === "voice") return "🎤 голосовое";
  if (kind === "circle") return "🎥 кружок";
  if (kind === "video") return "🎬 видео";
  if (kind === "image") return "📷 фото";
  return (text || "").trim();
}
