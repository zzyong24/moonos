import type { Command } from "commander";
import {
  PROTOCOL_CATALOG,
  SUPPORTING_OBJECT_CATALOG,
  FULL_CATALOG,
  getCatalogEntry,
  CURRENT_PROTOCOL_VERSION,
} from "../../protocols/index.js";
import { printJson } from "../formatters/json.js";
import { printTable } from "../formatters/table.js";
import { t } from "../i18n.js";
import { handleError } from "../util.js";

export function registerProtocolsCommand(program: Command): void {
  const protocols = program
    .command("protocols")
    .description(t("protocols.command.description"));

  protocols
    .command("list")
    .description(t("protocols.list.description"))
    .option("--json", t("common.outputJson"))
    .action(async (opts) => {
      try {
        if (opts.json) {
          printJson({ protocols: PROTOCOL_CATALOG, supporting: SUPPORTING_OBJECT_CATALOG });
          return;
        }

        console.log(`${t("protocols.list.title", { version: CURRENT_PROTOCOL_VERSION })}\n`);

        console.log(t("protocols.list.protocols"));
        printTable(
          [
            t("protocols.list.header.id"),
            t("protocols.list.header.name"),
            t("protocols.list.header.version"),
            t("protocols.list.header.requiredFields"),
          ],
          PROTOCOL_CATALOG.map((p) => [p.id, p.name, p.version, String(p.requiredFields.length)]),
        );

        console.log(`\n${t("protocols.list.supporting")}`);
        printTable(
          [
            t("protocols.list.header.id"),
            t("protocols.list.header.name"),
            t("protocols.list.header.version"),
            t("protocols.list.header.requiredFields"),
          ],
          SUPPORTING_OBJECT_CATALOG.map((p) => [p.id, p.name, p.version, String(p.requiredFields.length)]),
        );
      } catch (err) {
        handleError(err);
      }
    });

  protocols
    .command("show <id>")
    .description(t("protocols.show.description"))
    .action(async (id) => {
      try {
        const entry = getCatalogEntry(id);
        if (!entry) {
          console.error(`${t("common.errorPrefix")}: ${t("protocols.show.unknown", { id })}`);
          console.error(t("protocols.show.available", { ids: FULL_CATALOG.map((e) => e.id).join(", ") }));
          process.exit(1);
        }
        printJson(entry.schema);
      } catch (err) {
        handleError(err);
      }
    });
}
