import { useMutation } from "@tanstack/react-query";

import { postChat } from "@/features/assistant/api/assistantApi";
import type { ChatMessage } from "@/features/assistant/types";

/** El backend es stateless (sin historial en base) — cada llamada manda el
 * hilo completo de la conversación, no solo el mensaje nuevo. El error ya se
 * togastea globalmente (ver app/providers/QueryProvider.tsx); el widget
 * además usa `isError` para mostrar un mensaje inline en el hilo. */
export function useAssistantChat() {
  return useMutation({
    mutationFn: (messages: ChatMessage[]) => postChat(messages),
  });
}
