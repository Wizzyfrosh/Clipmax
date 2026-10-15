import { z } from "zod";
export const segmentSchema = z.object({
  id: z.string(),
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().positive(),
  text: z.string().max(5000),
});
export type Segment = z.infer<typeof segmentSchema>;
export const segmentsSchema = z.array(segmentSchema).max(15000);
export const candidateSchema = z.object({
  startId: z.string(),
  endId: z.string(),
  title: z.string().max(120),
  reason: z.string().max(1000),
  script: z.string().max(4000),
  voicePrompt: z.string().max(5000),
});
export type Candidate = z.infer<typeof candidateSchema>;
export function selectRanges(
  candidates: Candidate[],
  segments: Segment[],
  durationMs: number,
) {
  const selected: (Candidate & { startMs: number; endMs: number })[] = [];
  for (const c of candidates) {
    const s = segments.find((x) => x.id === c.startId),
      e = segments.find((x) => x.id === c.endId);
    if (!s || !e) continue;
    const length = e.endMs - s.startMs;
    if (
      length < 20000 ||
      length > 60000 ||
      s.startMs < 0 ||
      e.endMs > durationMs
    )
      continue;
    if (
      selected.some(
        (x) =>
          Math.max(
            0,
            Math.min(x.endMs, e.endMs) - Math.max(x.startMs, s.startMs),
          ) >
          Math.min(length, x.endMs - x.startMs) * 0.5,
      )
    )
      continue;
    selected.push({ ...c, startMs: s.startMs, endMs: e.endMs });
  }
  return selected.slice(0, 5);
}
export function captionsFor(segments: Segment[], start: number, end: number) {
  return segments
    .filter((s) => s.endMs > start && s.startMs < end)
    .map((s) => ({
      ...s,
      startMs: Math.max(0, s.startMs - start),
      endMs: Math.min(end - start, s.endMs - start),
    }));
}
function stamp(ms: number) {
  const n = Math.round(ms);
  return `${String(Math.floor(n / 3600000)).padStart(2, "0")}:${String(Math.floor(n / 60000) % 60).padStart(2, "0")}:${String(Math.floor(n / 1000) % 60).padStart(2, "0")},${String(n % 1000).padStart(3, "0")}`;
}
export function srt(segments: Segment[]) {
  return segments
    .map(
      (s, i) =>
        `${i + 1}\n${stamp(s.startMs)} --> ${stamp(s.endMs)}\n${s.text.replace(/\r?\n/g, " ").replace(/-->/g, "→")}\n`,
    )
    .join("\n");
}
