const YT_ID = /(?:youtube\.com\/(?:watch\?(?:[^\s#]*&)?v=|shorts\/|live\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/i;

/** The first YouTube link in a message, as a canonical watch URL (browser and server). */
export function findYouTubeUrl(text: string): string | null {
  const m = text.match(YT_ID);
  return m ? `https://www.youtube.com/watch?v=${m[1]}` : null;
}
