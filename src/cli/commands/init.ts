import type { Command } from "commander";
import { initWorkspace } from "../../core/workspace.js";
import { t } from "../i18n.js";
import { handleError } from "../util.js";

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description(t("init.description"))
    .option("-d, --dir <path>", t("init.option.dir"), process.cwd())
    .action(async (opts) => {
      try {
        const targetDir = opts.dir;
        const ws = await initWorkspace(targetDir);
        console.log(t("init.success", { path: `${ws.rootPath}/.moonos/` }));
        console.log("");
        console.log(t("init.nextSteps"));
        console.log(`  ${t("init.nextStepCreate")}`);
        console.log(`  ${t("init.nextStepStatus")}`);
      } catch (err) {
        handleError(err);
      }
    });
}
