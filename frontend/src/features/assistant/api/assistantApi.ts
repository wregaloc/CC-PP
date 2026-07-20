import { httpClient } from "@/lib/httpClient";

import type { AssistantChatResponse, ChatMessage } from "@/features/assistant/types";

export async function postChat(messages: ChatMessage[]): Promise<AssistantChatResponse> {
  const response = await httpClient.post<AssistantChatResponse>("/assistant/chat", { messages });
  return response.data;
}
