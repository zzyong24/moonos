import type { Command } from "commander";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { exportBundle } from "../../core/bundle/exporter.js";
import { printJson } from "../formatters/json.js";
import { t } from "../i18n.js";
import { resolveWorkspaceOrExit, handleError } from "../util.js";

export function registerExportCommand(program: Command): void {
  program
    .command("export")
    .description(t("export.description"))
    .option("-o, --output <file>", t("export.option.output"), "moonos-export.json")
    .option("--collections <list>", t("export.option.collections"), (v: string) => v.split(","))
    .option("--json", t("common.outputJson"))
    .action(async (opts) => {
      try {
        const ws = await resolveWorkspaceOrExit();
        const bundle = await exportBundle(ws.storage, {
          collections: opts.collections,
        });

        if (opts.json) {
          printJson(bundle);
          return;
        }

        const outPath = path.resolve(opts.output);
        await fs.writeFile(outPath, JSON.stringify(bundle, null, 2), "utf-8");

        console.log(t("export.success", { count: bundle.assets.length, path: outPath }));
        console.log(t("export.bundleId", { bundleId: bundle.bundle_id }));
        console.log(t("export.protocolVersion", { version: bundle.manifest.protocol_catalog_version }));
        for (const [col, count] of Object.entries(bundle.manifest.asset_counts)) {
          if (count > 0) {
            console.log(t("export.collectionCount", { collection: col, count }));
          }
        }
      } catch (err) {
        handleError(err);
      }
    });
}
