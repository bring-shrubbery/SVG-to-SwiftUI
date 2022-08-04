import * as colors from "kleur/colors";
import yargs from "yargs-parser";
import { z } from "zod";
import add from "../core/add/index.js";
import build from "../core/build/index.js";
import { openConfig } from "../core/config.js";
import devServer from "../core/dev/index.js";
import { collectErrorMetadata } from "../core/errors.js";
import { debug } from "../core/logger/core.js";
import { enableVerboseLogging, nodeLogDestination } from "../core/logger/node.js";
import { formatConfigErrorMessage, formatErrorMessage, printHelp } from "../core/messages.js";
import preview from "../core/preview/index.js";
import { ASTRO_VERSION, createSafeError } from "../core/util.js";
import * as event from "../events/index.js";
import { eventConfigError, eventError, telemetry } from "../events/index.js";
import { check } from "./check.js";
import { openInBrowser } from "./open.js";
import * as telemetryHandler from "./telemetry.js";
function printAstroHelp() {
  printHelp({
    commandName: "astro",
    usage: "[command] [...flags]",
    headline: "Futuristic web development tool.",
    tables: {
      Commands: [
        ["add", "Add an integration."],
        ["build", "Build your project and write it to disk."],
        ["check", "Check your project for errors."],
        ["dev", "Start the development server."],
        ["docs", "Open documentation in your web browser."],
        ["preview", "Preview your build locally."],
        ["telemetry", "Configure telemetry settings."]
      ],
      "Global Flags": [
        ["--config <path>", "Specify your config file."],
        ["--root <path>", "Specify your project root folder."],
        ["--verbose", "Enable verbose logging."],
        ["--silent", "Disable all logging."],
        ["--version", "Show the version number and exit."],
        ["--help", "Show this help message."]
      ]
    }
  });
}
async function printVersion() {
  console.log();
  console.log(`  ${colors.bgGreen(colors.black(` astro `))} ${colors.green(`v${ASTRO_VERSION}`)}`);
}
function resolveCommand(flags) {
  const cmd = flags._[2];
  if (cmd === "add")
    return "add";
  if (cmd === "telemetry")
    return "telemetry";
  if (flags.version)
    return "version";
  else if (flags.help)
    return "help";
  const supportedCommands = /* @__PURE__ */ new Set(["dev", "build", "preview", "check", "docs"]);
  if (supportedCommands.has(cmd)) {
    return cmd;
  }
  return "help";
}
async function runCommand(cmd, flags) {
  var _a;
  const root = flags.root;
  switch (cmd) {
    case "help":
      printAstroHelp();
      return process.exit(0);
    case "version":
      await printVersion();
      return process.exit(0);
  }
  let logging = {
    dest: nodeLogDestination,
    level: "info"
  };
  if (flags.verbose) {
    logging.level = "debug";
    enableVerboseLogging();
  } else if (flags.silent) {
    logging.level = "silent";
  }
  switch (cmd) {
    case "add": {
      telemetry.record(event.eventCliSession(cmd));
      const packages = flags._.slice(3);
      return await add(packages, { cwd: root, flags, logging, telemetry });
    }
    case "docs": {
      telemetry.record(event.eventCliSession(cmd));
      return await openInBrowser("https://docs.astro.build/");
    }
    case "telemetry": {
      const subcommand = (_a = flags._[3]) == null ? void 0 : _a.toString();
      return await telemetryHandler.update(subcommand, { flags, telemetry });
    }
  }
  const { astroConfig, userConfig } = await openConfig({ cwd: root, flags, cmd });
  telemetry.record(event.eventCliSession(cmd, userConfig, flags));
  switch (cmd) {
    case "dev": {
      await devServer(astroConfig, { logging, telemetry });
      return await new Promise(() => {
      });
    }
    case "build": {
      return await build(astroConfig, { logging, telemetry });
    }
    case "check": {
      const ret = await check(astroConfig);
      return process.exit(ret);
    }
    case "preview": {
      const server = await preview(astroConfig, { logging, telemetry });
      return await server.closed();
    }
  }
  throw new Error(`Error running ${cmd} -- no command found.`);
}
async function cli(args) {
  const flags = yargs(args);
  const cmd = resolveCommand(flags);
  try {
    await runCommand(cmd, flags);
  } catch (err) {
    await throwAndExit(cmd, err);
  }
}
async function throwAndExit(cmd, err) {
  let telemetryPromise;
  let errorMessage;
  function exitWithErrorMessage() {
    console.error(errorMessage);
    process.exit(1);
  }
  if (err instanceof z.ZodError) {
    telemetryPromise = telemetry.record(eventConfigError({ cmd, err, isFatal: true }));
    errorMessage = formatConfigErrorMessage(err);
  } else {
    const errorWithMetadata = collectErrorMetadata(createSafeError(err));
    telemetryPromise = telemetry.record(eventError({ cmd, err: errorWithMetadata, isFatal: true }));
    errorMessage = formatErrorMessage(errorWithMetadata);
  }
  setTimeout(exitWithErrorMessage, 400);
  await telemetryPromise.catch((err2) => debug("telemetry", `record() error: ${err2.message}`)).then(exitWithErrorMessage);
}
export {
  cli
};
