import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { extract, probe, render } from "../../packages/media";
import { select, transcribe } from "../../packages/ai";
import {
  selectRanges,
  captionsFor,
  srt,
  segmentsSchema,
} from "../../packages/contracts";
export async function localPipeline(source: string, out: string) {
  await mkdir(out, { recursive: true });
  const started = Date.now(),
    meta = await probe(source);
  const audio = join(out, "audio.mp3");
  await extract(source, audio);
  const speech = await transcribe(audio);
  await writeFile(
    join(out, "transcript.json"),
    JSON.stringify(speech, null, 2),
  );
  const selection = await select(speech.segments, 3);
  const clips = selectRanges(
    selection.candidates,
    speech.segments,
    meta.durationMs,
  );
  for (const [i, c] of clips.entries()) {
    await render(
      source,
      join(out, `clip-${i + 1}.mp4`),
      c.startMs,
      c.endMs,
      "original",
    );
    await writeFile(
      join(out, `clip-${i + 1}.srt`),
      srt(captionsFor(speech.segments, c.startMs, c.endMs)),
    );
    await writeFile(
      join(out, `clip-${i + 1}.txt`),
      `${c.title}\n\n${c.script}\n\nVOICE PROMPT\n${c.voicePrompt}`,
    );
  }
  await writeFile(
    join(out, "report.json"),
    JSON.stringify(
      {
        elapsedMs: Date.now() - started,
        clips,
        usage: selection.usage,
        transcriptionSeconds: speech.duration,
        cost: null,
        costNote: "Configure verified model pricing before estimating cost",
      },
      null,
      2,
    ),
  );
  return clips.length;
}
