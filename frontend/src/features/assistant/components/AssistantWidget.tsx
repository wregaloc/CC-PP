import { useEffect, useRef, useState, type FormEvent } from "react";

import { useAssistantChat } from "@/features/assistant/hooks/useAssistantChat";
import type { ChatMessage } from "@/features/assistant/types";

const GOLD = "#b4975a";
const GOLD_LIGHT = "#d8bc82";
const GOLD_DEEP = "#8a6f3c";
const CARBON = "#0e0c09";
const IVORY = "#f5f1e8";

const SUGGESTED_QUESTIONS = [
  "¿Qué programa tuvo más vistas este mes?",
  "¿Cuál es el mejor horario para publicar?",
  "¿Cómo viene el engagement?",
];

function WaveIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="assistant-wave" x1="0" y1="24" x2="24" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={GOLD} />
          <stop offset="100%" stopColor={IVORY} />
        </linearGradient>
      </defs>
      <rect x="1" y="9" width="3" height="6" rx="1.5" fill="url(#assistant-wave)" />
      <rect x="6" y="5" width="3" height="14" rx="1.5" fill="url(#assistant-wave)" />
      <rect x="11" y="2" width="3" height="20" rx="1.5" fill="url(#assistant-wave)" />
      <rect x="16" y="6" width="3" height="12" rx="1.5" fill="url(#assistant-wave)" />
      <rect x="21" y="9" width="3" height="6" rx="1.5" fill="url(#assistant-wave)" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 12l16-8-6 16-3-7-7-1z" />
    </svg>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex gap-1 py-0.5" aria-label="El asistente está escribiendo">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-bounce rounded-full"
          style={{ backgroundColor: GOLD, animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  );
}

/** Widget flotante del asistente de IA — solo se monta para rol Admin (ver
 * AppLayout). Conversación en memoria (no persiste entre recargas ni entre
 * usuarios, ver ADR: "sin historial en base"): cada envío manda el hilo
 * completo a `POST /assistant/chat`, que es stateless.
 *
 * Estilo deliberadamente distinto del resto del dashboard (paleta oro/carbón
 * de marca, igual que LoginPage/PodPulseLogo) — es una superficie de
 * "asistente", no otro panel de datos. */
export function AssistantWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const chat = useAssistantChat();

  const inputRef = useRef<HTMLInputElement>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages, chat.isPending]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || chat.isPending) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");

    try {
      const response = await chat.mutateAsync(nextMessages);
      setMessages((prev) => [...prev, { role: "assistant", content: response.reply }]);
    } catch {
      // El toast global ya avisó el error (ver QueryProvider) — no se agrega
      // un turno falso del asistente al hilo real que viaja al backend.
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send(input);
  }

  if (!isOpen) {
    return (
      <div className="fixed bottom-4 right-4 z-40 sm:bottom-6 sm:right-6">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Abrir el asistente de PodPulse"
          className="flex items-center gap-2 rounded-full py-2 pl-2.5 pr-3 shadow-lg backdrop-blur-xl transition-transform hover:-translate-y-0.5"
          style={{
            background: "rgba(14, 12, 9, 0.92)",
            border: `1px solid rgba(180, 151, 90, 0.4)`,
            boxShadow: "0 20px 50px rgba(0,0,0,0.5), 0 0 30px rgba(180,151,90,0.14)",
          }}
        >
          <WaveIcon size={15} />
          <span className="text-xs font-semibold" style={{ color: IVORY }}>
            Preguntar a PodPulse
          </span>
          <span
            className="h-1 w-1 rounded-full"
            style={{ backgroundColor: GOLD_LIGHT, boxShadow: `0 0 8px ${GOLD_LIGHT}` }}
          />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 sm:bottom-6 sm:right-6">
      <section
        aria-label="Asistente PodPulse"
        className="flex h-[min(560px,calc(100vh-2rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-[20px] backdrop-blur-xl"
        style={{
          background: "rgba(14, 12, 9, 0.94)",
          border: "1px solid rgba(180, 151, 90, 0.4)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(180,151,90,0.14)",
        }}
      >
        <header
          className="flex items-center gap-2.5 border-b px-4 py-3.5"
          style={{ borderColor: "rgba(180,151,90,0.22)" }}
        >
          <WaveIcon size={24} />
          <div className="min-w-0">
            <div className="text-sm font-bold tracking-wide" style={{ color: IVORY }}>
              Asistente <span style={{ color: GOLD }}>PodPulse</span>
            </div>
            <div
              className="truncate text-[11px]"
              style={{ color: "rgba(163,144,108,1)" }}
            >
              Consulta tus datos en lenguaje natural
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Cerrar asistente"
            className="ml-auto flex h-8 w-8 flex-none items-center justify-center rounded-md border transition-colors"
            style={{ borderColor: "rgba(180,151,90,0.22)", color: "rgba(163,144,108,1)" }}
          >
            <CloseIcon />
          </button>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {messages.length === 0 && (
            <div
              className="max-w-[85%] rounded-tl-[4px] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed"
              style={{ background: "rgba(30,26,19,0.85)", border: "1px solid rgba(180,151,90,0.22)", color: IVORY }}
            >
              Hola 👋 Soy tu asistente de datos. Preguntame en lenguaje natural sobre vistas,
              engagement, horarios o ranking de programas.
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={index}
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                message.role === "user" ? "ml-auto rounded-br-[4px] font-medium" : "rounded-tl-[4px]"
              }`}
              style={
                message.role === "user"
                  ? { background: `linear-gradient(120deg, ${GOLD_DEEP}, ${GOLD})`, color: CARBON }
                  : { background: "rgba(30,26,19,0.85)", border: "1px solid rgba(180,151,90,0.22)", color: IVORY }
              }
            >
              {message.content}
            </div>
          ))}

          {chat.isPending && (
            <div
              className="max-w-[85%] rounded-tl-[4px] rounded-2xl px-3.5 py-2.5"
              style={{ background: "rgba(30,26,19,0.85)", border: "1px solid rgba(180,151,90,0.22)" }}
            >
              <TypingDots />
            </div>
          )}

          <div ref={threadEndRef} />
        </div>

        {messages.length === 0 && (
          <div className="flex flex-wrap gap-1.5 px-4 pb-1">
            {SUGGESTED_QUESTIONS.map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => void send(question)}
                className="rounded-full border px-2.5 py-1.5 text-xs transition-colors"
                style={{ borderColor: "rgba(180,151,90,0.4)", color: GOLD }}
              >
                {question}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t px-3 py-3" style={{ borderColor: "rgba(180,151,90,0.22)" }}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Escribí tu pregunta…"
            aria-label="Tu pregunta para el asistente"
            disabled={chat.isPending}
            className="min-w-0 flex-1 rounded-lg border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 disabled:opacity-60"
            style={{
              background: "rgba(8,7,5,0.5)",
              borderColor: "rgba(180,151,90,0.22)",
              color: IVORY,
            }}
          />
          <button
            type="submit"
            disabled={chat.isPending || !input.trim()}
            aria-label="Enviar pregunta"
            className="flex h-10 w-10 flex-none items-center justify-center rounded-lg transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
            style={{ background: `linear-gradient(120deg, ${GOLD_DEEP}, ${GOLD}, ${GOLD_LIGHT})`, color: CARBON }}
          >
            <SendIcon />
          </button>
        </form>
        <p className="px-4 pb-3 text-center text-[10px]" style={{ color: "rgba(163,144,108,0.8)" }}>
          Las respuestas usan los datos reales cargados en PodPulse.
        </p>
      </section>
    </div>
  );
}
