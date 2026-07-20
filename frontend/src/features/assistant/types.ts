/** Tipos espejo de `backend/app/schemas/assistant.py`. */

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface AssistantChatResponse {
  reply: string;
  tools_used: string[];
}
