import type { Command } from "commander";
import { getWorkspaceStatus } from "../../core/workspace.js";
import { printJson } from "../formatters/json.js";
import { formatDateShort, t } from "../i18n.js";
import { resolveWorkspaceOrExit, handleError } from "../util.js";

export function registerStatusCommand(program: Command): void {
  program
    .command("status")
    .description(t("status.description"))
    .option("--json", t("common.outputJson"))
    .action(async (opts) => {
      try {
        const ws = await resolveWorkspaceOrExit();
        const stats = await getWorkspaceStatus(ws);

        if (opts.json) {
          printJson(stats);
          return;
        }

        console.log(`${t("status.workspace")}: ${ws.rootPath}`);
        console.log(`${t("status.protocolVersion")}: ${stats.version}`);
        console.log(`${t("status.totalAssets")}: ${stats.totalFiles}`);
        console.log("");

        for (const [name, info] of Object.entries(stats.collections)) {
          if (info.count > 0) {
            console.log(t("status.collectionLine", {
              name,
              count: info.count,
              lastModified: info.lastModified ? formatDateShort(info.lastModified) : t("common.na"),
            }));
          }
        }

        if (stats.totalFiles === 0) {
          console.log(t("status.emptyWorkspace"));
          console.log("");
          console.log(t("status.getStarted"));
          console.log(`  ${t("status.getStartedCommand")}`);
        }
      } catch (err) {
        handleError(err);
      }
    });
}
