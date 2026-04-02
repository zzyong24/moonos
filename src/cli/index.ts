/**
 * MoonOS CLI — AI Sovereignty Control Plane
 * Shebang is injected by tsup banner, not in source.
 */
import { Command } from "commander";
import { registerInitCommand } from "./commands/init.js";
import { registerStatusCommand } from "./commands/status.js";
import { registerMemoryCommands } from "./commands/memory.js";
import { registerProtocolsCommand } from "./commands/protocols.js";
import { registerExportCommand } from "./commands/export.js";
import { registerImportCommand } from "./commands/import.js";
import { registerBriefingCommand } from "./commands/briefing.js";
import { registerTraceCommands } from "./commands/trace.js";
import { registerReportCommands } from "./commands/report.js";
import { initializeCliI18n, t } from "./i18n.js";

initializeCliI18n();

const program = new Command()
  .name("moonos")
  .version("0.3.0")
  .description(t("cli.description"))
  .option("--lang <locale>", t("cli.option.lang"));

registerInitCommand(program);
registerStatusCommand(program);
registerMemoryCommands(program);
registerProtocolsCommand(program);
registerExportCommand(program);
registerImportCommand(program);
registerBriefingCommand(program);
registerTraceCommands(program);
registerReportCommands(program);

program.parse();
