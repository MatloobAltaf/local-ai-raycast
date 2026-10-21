import { Action, ActionPanel, Detail, Icon } from "@raycast/api";
import { useFmStream } from "../hooks/useFmStream";
import { EMPTY_ANSWER, PENDING_ANSWER } from "../lib/chats/format";
import { FmError } from "../lib/fm/errors";
import { respond } from "../lib/fm/client";
import { measureBudget } from "../lib/measure-budget";
import { finalizeWindowText } from "../lib/output";
import { buildQuickAiStdin, QUICK_AI_INSTRUCTIONS } from "../lib/quick-ai";
import { questionInputLimit } from "../lib/tokens";
import { getSettings } from "../services/settings";
import { ContinueInChatAction } from "./ContinueInChatAction";
import { FmErrorView } from "./FmErrorView";

export function AnswerView(props: { question: string; selection?: string; onAskWithoutSelection?: () => void }) {
  const { question, selection, onAskWithoutSelection } = props;
  const { text, isLoading, error, retry } = useFmStream(
    async (signal, onText) => {
      const settings = getSettings();
      const stdin = buildQuickAiStdin(question, selection);
      const check = await measureBudget({
        instructions: QUICK_AI_INSTRUCTIONS,
        stdin,
        limitFor: questionInputLimit,
        timeoutMs: settings.timeoutMs,
        signal,
      });
      if (!check.ok) throw new FmError("contextOverflow", check.message);
      return respond(stdin, {
        model: settings.defaultModel,
        instructions: QUICK_AI_INSTRUCTIONS,
        creativity: settings.defaultCreativity,
        useCase: "general",
        guardrails: "default",
        stream: true,
        timeoutMs: settings.timeoutMs,
        signal,
        onText,
      });
    },
    [question, selection],
  );

  if (error) return <FmErrorView error={error} onRetry={retry} />;

  const answer = isLoading ? text : finalizeWindowText(text);
  const quote = question
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
  const answerMarkdown = answer || (isLoading ? PENDING_ANSWER : EMPTY_ANSWER);
  return (
    <Detail
      isLoading={isLoading}
      markdown={`**You**\n\n${quote}\n\n**Local AI**\n\n${answerMarkdown}`}
      actions={
        !isLoading ? (
          <ActionPanel>
            {answer && (
              <>
                <Action.CopyToClipboard content={answer} />
                <Action.Paste content={answer} />
                <ContinueInChatAction userMessage={question} assistantMessage={answer} />
              </>
            )}
            <Action title="Retry" icon={Icon.ArrowClockwise} onAction={retry} />
            {selection && onAskWithoutSelection && (
              <Action title="Ask Without Selection" icon={Icon.TextCursor} onAction={onAskWithoutSelection} />
            )}
          </ActionPanel>
        ) : undefined
      }
    />
  );
}
