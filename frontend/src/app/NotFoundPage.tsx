import { Link } from "react-router-dom";

import { Button } from "@/components/ui/Button";

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white text-center dark:bg-neutral-950">
      <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">404</h1>
      <p className="text-neutral-600 dark:text-neutral-400">Esta página no existe.</p>
      <Link to="/">
        <Button variant="secondary">Volver al inicio</Button>
      </Link>
    </div>
  );
}
