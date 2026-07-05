import "@testing-library/jest-dom";

// jsdom reemplaza `AbortController`/`AbortSignal` globales con su propia
// implementación, incompatible con la validación interna de `undici` que usa
// el `Request` nativo de Node. React Router (data routers) construye un
// `Request` internamente en cada navegación aunque no exista fetch real de
// por medio, lo que revienta en jsdom con "Expected signal to be an instance
// of AbortSignal". Como ningún request se envía realmente por red en los
// tests, quitamos el `signal` antes de delegar al `Request` nativo.
const NativeRequest = globalThis.Request;

class TestSafeRequest extends NativeRequest {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    if (init && "signal" in init) {
      const rest = { ...init };
      delete rest.signal;
      super(input, rest);
    } else {
      super(input, init);
    }
  }
}

globalThis.Request = TestSafeRequest as typeof Request;
