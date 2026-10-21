import { Action, ActionPanel, Detail, Icon } from "@raycast/api";
import { useFmStream } from "../hooks/useFmStream";
import type { AiCommand } from "../lib/commands/types";
import type { RunInput } from "../lib/launch-context";
import { finalizeWindowText } from "../lib/output";
import { executeRun } from "../services/run";
import { CommandForm } from "./CommandForm";
import { ContinueInChatAction } from "./ContinueInChatAction";
import { FmErrorView } from "./FmErrorView";

const SOURCE_LABELS = { selection: "Selected text", clipboard: "Clipboard" } as const;

export function ResultView(props: { command: AiCommand; input: RunInput; argumentValues: Record<string, string> }) {
  const { command, input, argumentValues } = props;
  const { text, isLoading, error, retry } = useFmStream(
    (signal, onText) => executeRun({ command, input, argumentValues, stream: true, signal, onText }),
    [command, input, JSON.stringify(argumentValues)],
  );

  if (error) return <FmErrorView error={error} onRetry={retry} />;

  const result = isLoading ? text : finalizeWindowText(text);
  return (
    <Detail
      navigationTitle={command.name}
      isLoading={isLoading}
      markdown={result}
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.Label title="Command" text={command.name} />
          <Detail.Metadata.Label title="Input" text={SOURCE_LABELS[input.source]} />
        </Detail.Metadata>
      }
      actions={
        !isLoading ? (
          <ActionPanel>
            {result && <Action.Paste title="Paste to Active App" content={result} />}
            {result && <Action.CopyToClipboard content={result} />}
            {result && <ContinueInChatAction userMessage={input.text} assistantMessage={result} />}
            <Action title="Retry" icon={Icon.ArrowClockwise} onAction={retry} />
            <Action.Push title="Edit Command" icon={Icon.Pencil} target={<CommandForm command={command} />} />
          </ActionPanel>
        ) : undefined
      }
    />
  );
}
