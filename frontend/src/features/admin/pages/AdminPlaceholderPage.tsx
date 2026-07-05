/**
 * Placeholder de la sección de administración (carga de archivos, gestión de
 * usuarios — TDD §8.8-§8.9). Solo confirma que el enrutamiento protegido por
 * rol (`allowedRoles={["admin"]}` en el router) funciona; la funcionalidad
 * real se construye en una fase posterior.
 */
export function AdminPlaceholderPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
        Administración
      </h1>
      <p className="mt-2 text-neutral-600 dark:text-neutral-400">
        Solo un Admin puede ver esta página. La carga de archivos y la gestión de usuarios se
        construyen en una fase posterior.
      </p>
    </div>
  );
}
