import type { Command } from "commander";
import { MemoryService } from "../../core/memory/service.js";
import { t } from "../i18n.js";
import { resolveWorkspaceOrExit, handleError } from "../util.js";

export function registerBriefingCommand(program: Command): void {
  program
    .command("briefing")
    .description(t("briefing.description"))
    .action(async () => {
      try {
        const ws = await resolveWorkspaceOrExit();
        const service = new MemoryService(ws.storage);
        const text = await service.briefing();
        console.log(text);
      } catch (err) {
        handleError(err);
      }
    });
}
