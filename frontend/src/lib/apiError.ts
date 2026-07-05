import axios from "axios";

/** Forma de error que devuelve el backend — ver docs/API.md ("Todas las
 * respuestas de error tienen la forma { detail, code }"). */
interface ApiErrorShape {
  detail?: string;
  code?: string;
}

/** Error normalizado que usa el resto del frontend — así ningún componente
 * necesita saber que el transporte es axios ni conocer la forma cruda de
 * la respuesta del backend. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, detail: string) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export function normalizeError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiErrorShape | undefined;
    if (error.response) {
      return new ApiError(
        error.response.status,
        data?.code ?? "UNKNOWN_ERROR",
        data?.detail ?? "Ocurrió un error inesperado.",
      );
    }
    // Sin response: la request no llegó al backend (red caída, CORS, timeout).
    return new ApiError(0, "NETWORK_ERROR", "No se pudo conectar con el servidor.");
  }

  if (error instanceof ApiError) {
    return error;
  }

  return new ApiError(0, "UNKNOWN_ERROR", "Ocurrió un error inesperado.");
}
