import { Cache, LaunchType, launchCommand, showHUD, type LaunchProps } from "@raycast/api";
import { isRunCommandLaunchContext, type RunViewLaunchContext } from "./lib/launch-context";
import { parsePrompt } from "./lib/placeholders";
import { isRunInFlight } from "./lib/replace";
import { NO_INPUT_MESSAGE, resolveLaunchTarget } from "./lib/run-request";
import { loadCommands } from "./services/command-store";
import { captureInput } from "./services/input";
import { replaceSelection } from "./services/paste";
import { ensureReady } from "./services/preflight";
import { getSettings } from "./services/settings";

const IN_FLIGHT_KEY = "run-command.in-flight";
const cache = new Cache();

export default async function Command(props: LaunchProps) {
  const commandId = isRunCommandLaunchContext(props.launchContext) ? props.launchContext.commandId : undefined;
  const target = resolveLaunchTarget(commandId, (await loadCommands()).commands);
  if (target.kind === "none") return launchCommand({ name: "run-ai-command", type: LaunchType.UserInitiated });
  if (target.kind === "missing") return showHUD("Command was deleted");

  if (!(await ensureReady())) return;
  if (isRunInFlight(cache.get(IN_FLIGHT_KEY), Date.now(), getSettings().timeoutMs)) return showHUD("Already running");

  cache.set(IN_FLIGHT_KEY, String(Date.now()));
  try {
    const { command } = target;
    const input = await captureInput();
    if (!input) return await showHUD(NO_INPUT_MESSAGE);

    if (command.output === "window" || parsePrompt(command.prompt).arguments.length > 0) {
      const context: RunViewLaunchContext = { commandId: command.id, input };
      return await launchCommand({ name: "run-ai-command", type: LaunchType.UserInitiated, context });
    }
    await replaceSelection(command, input, {});
  } finally {
    cache.remove(IN_FLIGHT_KEY);
  }
}
