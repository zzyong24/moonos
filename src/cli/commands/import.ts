import type { Command } from "commander";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { parseBundle, importBundle } from "../../core/bundle/importer.js";
import type { ConflictResolutionPolicy } from "../../protocols/envelope/conflict.js";
import { printJson } from "../formatters/json.js";
import { printTable } from "../formatters/table.js";
import { formatCliError, t } from "../i18n.js";
import { resolveWorkspaceOrExit, handleError } from "../util.js";

export function registerImportCommand(program: Command): void {
  program
    .command("import <file>")
    .description(t("import.description"))
    .option("--policy <policy>", t("import.option.policy"), "skip")
    .option("--json", t("common.outputJson"))
    .action(async (file, opts) => {
      try {
        const ws = await resolveWorkspaceOrExit();
        const filePath = path.resolve(file);
        const content = await fs.readFile(filePath, "utf-8");
        const raw = JSON.parse(content);
        const bundle = parseBundle(raw);

        console.log(t("import.readingBundle", {
          bundleId: bundle.bundle_id,
          count: bundle.assets.length,
        }));

        const result = await importBundle(ws.storage, bundle, {
          policy: opts.policy as ConflictResolutionPolicy,
        });

        if (opts.json) {
          printJson(result);
          return;
        }

        console.log("");
        console.log(t("import.completed", { status: t(`import.status.${result.status}`) }));
        console.log(t("import.summary", {
          total: result.total,
          imported: result.imported,
          skipped: result.skipped,
          overwritten: result.overwritten,
        }));

        if (result.conflicts.length > 0) {
          console.log(`\n${t("import.conflicts", { count: result.conflicts.length })}`);
          printTable(
            [
              t("import.header.assetId"),
              t("import.header.type"),
              t("import.header.conflictingFields"),
            ],
            result.conflicts.map((c) => [
              c.asset_id,
              c.asset_type,
              c.field_conflicts.map((f) => f.field_path).join(", "),
            ]),
          );
          if (opts.policy === "user_confirm" || opts.policy === "skip") {
            console.log(`\n${t("import.conflictsHint")}`);
          }
        }

        if (result.errors.length > 0) {
          console.log(`\n${t("import.errors", { count: result.errors.length })}`);
          for (const e of result.errors) {
            console.log(`  ${formatCliError(new Error(e))}`);
          }
        }
      } catch (err) {
        handleError(err);
      }
    });
}
