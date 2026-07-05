/** Debe coincidir exactamente con app/models/enums.py::UserRole del backend —
 * ver docs/PODPULSE_TDD_v1.0.docx §5.1 (modelo de roles, fijo). */
export type UserRole = "admin" | "interno" | "cliente";

export const USER_ROLES: readonly UserRole[] = ["admin", "interno", "cliente"];
