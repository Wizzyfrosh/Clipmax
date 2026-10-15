import "dotenv/config";
import { resolve } from "node:path";
import { localPipeline } from "./pipeline";
const [source, output] = process.argv.slice(2);
if (!source || !output) {
  console.error("Usage: npm run clip -- /path/to/video.mp4 /path/to/output");
  process.exit(1);
}
localPipeline(resolve(source), resolve(output))
  .then((n) =>
    console.log(`Created ${n} clips. Review outputs before publishing.`),
  )
  .catch((e) => {
    console.error(e instanceof Error ? e.message : "PIPELINE_FAILED");
    process.exitCode = 1;
  });
