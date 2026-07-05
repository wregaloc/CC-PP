import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { App } from "@/app/App";

// Sin sesión previa (POST /auth/refresh falla) — simula un visitante nuevo,
// sin depender de un backend real corriendo durante los tests.
vi.mock("@/features/auth/api/authApi", () => ({
  refresh: vi.fn().mockRejectedValue(new Error("no active session")),
  login: vi.fn(),
  logout: vi.fn(),
  changePassword: vi.fn(),
}));

describe("App", () => {
  it("shows the login page when there is no active session", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "PodPulse" })).toBeInTheDocument();
    });
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Contraseña")).toBeInTheDocument();
  });
});
