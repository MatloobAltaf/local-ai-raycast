import { Action, ActionPanel, Detail, Icon } from "@raycast/api";
import type { FmError } from "../lib/fm/errors";
import { isSetupError } from "../services/errors";
import { usePreflight } from "../hooks/usePreflight";
import { SetupStatus } from "./SetupStatus";

export function FmErrorView(props: { error: FmError; onRetry?: () => void }) {
  if (isSetupError(props.error)) return <SetupErrorView />;

  const detail = props.error.detail ? `\n\n\`\`\`\n${props.error.detail}\n\`\`\`` : "";
  return (
    <Detail
      markdown={`# Something went wrong\n\n${props.error.message}${detail}`}
      actions={
        props.onRetry && (
          <ActionPanel>
            <Action title="Retry" icon={Icon.ArrowClockwise} onAction={props.onRetry} />
          </ActionPanel>
        )
      }
    />
  );
}

function SetupErrorView() {
  const { result, isLoading, recheck } = usePreflight();
  return <SetupStatus result={result} isLoading={isLoading} onRecheck={recheck} />;
}
