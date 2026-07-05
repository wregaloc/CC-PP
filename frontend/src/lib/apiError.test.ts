import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it } from "vitest";

import { ApiError, normalizeError } from "@/lib/apiError";

function makeAxiosError(status: number, data: unknown): AxiosError {
  return new AxiosError("Request failed", String(status), undefined, undefined, {
    status,
    statusText: "",
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
    data,
  });
}

describe("normalizeError", () => {
  it("extrae detail y code de una respuesta de error del backend", () => {
    const axiosError = makeAxiosError(401, { detail: "Token ausente o inválido", code: "TOKEN_INVALID" });

    const result = normalizeError(axiosError);

    expect(result).toBeInstanceOf(ApiError);
    expect(result.status).toBe(401);
    expect(result.code).toBe("TOKEN_INVALID");
    expect(result.message).toBe("Token ausente o inválido");
  });

  it("usa un código y mensaje genéricos si la respuesta no trae la forma esperada", () => {
    const axiosError = makeAxiosError(500, {});

    const result = normalizeError(axiosError);

    expect(result.status).toBe(500);
    expect(result.code).toBe("UNKNOWN_ERROR");
  });

  it("marca como NETWORK_ERROR cuando la request no obtuvo respuesta", () => {
    const axiosError = new AxiosError("Network Error");

    const result = normalizeError(axiosError);

    expect(result.status).toBe(0);
    expect(result.code).toBe("NETWORK_ERROR");
  });

  it("envuelve cualquier otro valor lanzado en un ApiError genérico", () => {
    const result = normalizeError("algo que no es un error de axios");

    expect(result).toBeInstanceOf(ApiError);
    expect(result.code).toBe("UNKNOWN_ERROR");
  });
});
