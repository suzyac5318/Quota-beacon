import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { formatCompactTokens } from "../lib/format";
import { startDragging } from "../lib/bridge";

interface ConversationTokenUsage {
  conversationId: string | null;
  totalTokens: number | null;
}

export function ConversationTokenOverlay() {
  const [usage, setUsage] = useState<ConversationTokenUsage>({
    conversationId: null,
    totalTokens: null,
  });

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void listen<ConversationTokenUsage>("conversation-token-usage", (event) => {
      if (!disposed) setUsage(event.payload);
    }).then((value) => {
      if (disposed) value();
      else unlisten = value;
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  const value = usage.totalTokens === null ? "null" : formatCompactTokens(usage.totalTokens);
  const label = usage.totalTokens === null
    ? "当前对话 Token 数据为空"
    : `当前对话累计 ${usage.totalTokens.toLocaleString("zh-CN")} Tokens`;

  return (
    <output
      className={`conversation-token${usage.totalTokens === null ? " conversation-token--null" : ""}`}
      aria-label={label}
      aria-live="polite"
      title={label}
      onPointerDown={() => void startDragging()}
    >
      {value}
    </output>
  );
}
