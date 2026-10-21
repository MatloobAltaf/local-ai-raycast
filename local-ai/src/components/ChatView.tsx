import { Action, ActionPanel, Icon, List, showToast, Toast, useNavigation } from "@raycast/api";
import { existsSync } from "node:fs";
import path from "node:path";
import { useEffect, useMemo, useRef, useState } from "react";
import { appendMessage, toTurns } from "../lib/chats/operations";
import { buildChatInstructions, buildChatStdin, replayContent } from "../lib/chats/transcript";
import type { Chat, ChatMessage } from "../lib/chats/types";
import { countTokens, respond } from "../lib/fm/client";
import { tooLongMessage } from "../lib/fm/errors";
import { finalizeWindowText, stripSpeakerLabel } from "../lib/output";
import {
  ANSWER_RESERVE_TOKENS,
  CONTEXT_WINDOW_TOKENS,
  SAFETY_MARGIN_TOKENS,
  contextPercent,
  inputTokensFrom,
  questionInputLimit,
  selectHistory,
} from "../lib/tokens";
import { getSettings } from "../services/settings";
import { showFmErrorToast } from "../services/errors";
import { AttachImageForm } from "./AttachImageForm";
import { ChatSettingsForm } from "./ChatSettingsForm";

interface StreamingTurn {
  userId: string;
  text: string;
}

export function ChatView(props: { chat: Chat; persist: (chat: Chat) => Promise<void> }) {
  const { push } = useNavigation();
  const [chat, setChat] = useState(props.chat);
  const [composer, setComposer] = useState("");
  const [streaming, setStreaming] = useState<StreamingTurn>();
  const [pendingImage, setPendingImage] = useState<string>();
  const [framingTokens, setFramingTokens] = useState(0);
  const chatRef = useRef(chat);
  const controllerRef = useRef<AbortController | undefined>(undefined);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const turns = useMemo(() => toTurns(chat.messages), [chat.messages]);
  const percent = useMemo(() => {
    const available = CONTEXT_WINDOW_TOKENS - SAFETY_MARGIN_TOKENS - ANSWER_RESERVE_TOKENS - framingTokens;
    const stored = turns.map((turn) => ({
      userTokens: turn.user.tokens ?? 0,
      assistantTokens: turn.assistant?.tokens ?? 0,
    }));
    return contextPercent(framingTokens + selectHistory(stored, available).usedTokens);
  }, [turns, framingTokens]);

  async function commit(next: Chat): Promise<void> {
    chatRef.current = next;
    setChat(next);
    await props.persist(next);
  }

  async function send(text: string): Promise<void> {
    const content = text.trim();
    const imagePath = pendingImage;
    if (imagePath && !existsSync(imagePath)) {
      setPendingImage(undefined);
      await showToast({ style: Toast.Style.Failure, title: "Image not found" });
      return;
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    const { signal } = controller;
    const { timeoutMs, defaultModel, defaultCreativity } = getSettings();
    const instructions = buildChatInstructions(chatRef.current.instructions);
    const countMessage = async (value: string, framing: number, imagePaths?: string[]) =>
      inputTokensFrom(await countTokens(value, { instructions, imagePaths, timeoutMs, signal }), framing);

    try {
      const framing = await countTokens("", { instructions, timeoutMs, signal });
      const imagePaths = imagePath ? [imagePath] : undefined;
      const messageTokens = await countMessage(content, framing, imagePaths).catch((error: unknown) => {
        if (!imagePaths || signal.aborted) throw error;
        return countMessage(content, framing);
      });
      const limit = questionInputLimit(framing);
      if (messageTokens > limit) {
        await showToast({ style: Toast.Style.Failure, title: tooLongMessage(messageTokens, limit) });
        return;
      }
      const storedTokens = imagePath
        ? await countMessage(replayContent({ content, imagePath }), framing)
        : messageTokens;
      setComposer("");
      setPendingImage(undefined);
      setFramingTokens(framing);

      const counted: ChatMessage[] = [];
      for (const message of chatRef.current.messages) {
        counted.push(
          message.tokens === undefined
            ? { ...message, tokens: await countMessage(replayContent(message), framing) }
            : message,
        );
      }
      const priorTurns = toTurns(counted);
      const available = CONTEXT_WINDOW_TOKENS - SAFETY_MARGIN_TOKENS - ANSWER_RESERVE_TOKENS - framing - messageTokens;
      const { startIndex } = selectHistory(
        priorTurns.map((turn) => ({
          userTokens: turn.user.tokens ?? 0,
          assistantTokens: turn.assistant?.tokens ?? 0,
        })),
        available,
      );
      const stdin = buildChatStdin(priorTurns.slice(startIndex), content);

      const now = new Date().toISOString();
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        tokens: storedTokens,
        ...(imagePath ? { imagePath } : {}),
        createdAt: now,
      };
      await commit(appendMessage({ ...chatRef.current, messages: counted }, userMessage, now));
      setStreaming({ userId: userMessage.id, text: "" });

      const output = await respond(stdin, {
        model: defaultModel,
        instructions,
        creativity: defaultCreativity,
        useCase: "general",
        guardrails: "default",
        stream: true,
        imagePaths,
        timeoutMs,
        signal,
        onText: (accumulated) => {
          if (!signal.aborted) setStreaming({ userId: userMessage.id, text: accumulated });
        },
      });

      const answer = stripSpeakerLabel(finalizeWindowText(output));
      const answeredAt = new Date().toISOString();
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: answer,
        createdAt: answeredAt,
      };
      await commit(appendMessage(chatRef.current, assistantMessage, answeredAt));
      setStreaming(undefined);

      const answerTokens = await countMessage(answer, framing).catch(() => undefined);
      if (answerTokens !== undefined) {
        const latest = chatRef.current;
        await commit({
          ...latest,
          messages: latest.messages.map((m) => (m.id === assistantMessage.id ? { ...m, tokens: answerTokens } : m)),
        });
      }
    } catch (error) {
      if (!signal.aborted) await showFmErrorToast(error);
    } finally {
      setStreaming(undefined);
    }
  }

  async function saveInstructions(instructions: string): Promise<void> {
    await commit({ ...chatRef.current, instructions, updatedAt: new Date().toISOString() });
  }

  const isStreaming = streaming !== undefined;
  const canSend = composer.trim().length > 0 && !isStreaming;

  const sharedActions = (
    <>
      {isStreaming && <Action title="Stop" icon={Icon.Stop} onAction={() => controllerRef.current?.abort()} />}
      <Action
        title="Attach Image"
        icon={Icon.Image}
        shortcut={{ modifiers: ["cmd"], key: "i" }}
        onAction={() => push(<AttachImageForm onAttach={setPendingImage} />)}
      />
      {pendingImage && (
        <Action title="Remove Attached Image" icon={Icon.XMarkCircle} onAction={() => setPendingImage(undefined)} />
      )}
      <Action
        title="Edit Instructions"
        icon={Icon.Pencil}
        onAction={() => push(<ChatSettingsForm instructions={chat.instructions} onSave={saveInstructions} />)}
      />
    </>
  );

  return (
    <List
      navigationTitle={`${chat.title} · Context ${percent}%`}
      isShowingDetail={turns.length > 0}
      filtering={false}
      searchBarPlaceholder={pendingImage ? `Type a message (image: ${path.basename(pendingImage)})` : "Type a message"}
      searchText={composer}
      onSearchTextChange={setComposer}
      isLoading={isStreaming}
    >
      {turns.length === 0 && (
        <List.EmptyView
          title="Start the conversation"
          description="Type a message, then choose Send Message."
          actions={
            <ActionPanel>
              {canSend && <Action title="Send Message" icon={Icon.Message} onAction={() => send(composer)} />}
              {sharedActions}
            </ActionPanel>
          }
        />
      )}
      {turns.map((turn) => {
        const isPending = streaming?.userId === turn.user.id;
        const answer = isPending ? streaming.text : turn.assistant?.content;
        return (
          <List.Item
            key={turn.user.id}
            id={turn.user.id}
            title={turn.user.content}
            detail={<List.Item.Detail markdown={answer || (isPending ? "_Thinking..._" : "_No answer._")} />}
            actions={
              <ActionPanel>
                {canSend && <Action title="Send Message" icon={Icon.Message} onAction={() => send(composer)} />}
                {turn.assistant && <Action.CopyToClipboard title="Copy Answer" content={turn.assistant.content} />}
                {sharedActions}
              </ActionPanel>
            }
          />
        );
      })}
    </List>
  );
}
