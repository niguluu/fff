import { stdin as input, stdout as output } from "node:process";
import { FfApp } from "./app.js";
import { runHarness } from "./backend.js";
import { renderScreen } from "./render.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let prompt = args.join(" ");

  if (!prompt) {
    const chunks: Buffer[] = [];
    for await (const chunk of input) {
      chunks.push(chunk);
    }
    prompt = Buffer.concat(chunks).toString("utf8").trim();
  }

  if (!prompt) {
    output.write("Usage: ff <prompt>\n");
    output.write("       echo 'prompt' | ff\n");
    process.exit(1);
  }

  const app = new FfApp({
    runHarness: async (options) => {
      await runHarness({
        ...options,
        onEvent: (event) => {
          options.onEvent(event);
          if (event.type === "chunk") {
            output.write("\x1b[?25l\x1b[H\x1b[2J");
            output.write(`${renderScreen(app.state, output.columns || 80)}\n`);
          }
        },
      });
    },
  });

  const redraw = (): void => {
    output.write("\x1b[?25l\x1b[H\x1b[2J");
    output.write(`${renderScreen(app.state, output.columns || 80)}\n`);
  };

  redraw();
  await app.submitPrompt(prompt);
  redraw();
  output.write("\x1b[?25h\n");
}

void main();
