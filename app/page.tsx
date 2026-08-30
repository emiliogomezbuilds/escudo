import { EnvVarWarning } from "@/components/env-var-warning";
import { AuthButton } from "@/components/auth-button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { hasEnvVars } from "@/lib/utils";
import Link from "next/link";
import { Suspense } from "react";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center">
      <div className="flex-1 w-full flex flex-col gap-20 items-center">
        <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16">
          <div className="w-full max-w-5xl flex justify-between items-center p-3 px-5 text-sm">
            <Link href={"/"} className="font-semibold">
              Escudo
            </Link>
            {!hasEnvVars ? (
              <EnvVarWarning />
            ) : (
              <Suspense>
                <AuthButton />
              </Suspense>
            )}
          </div>
        </nav>
        <div className="flex-1 flex flex-col gap-8 max-w-2xl p-5 items-center text-center">
          <h1 className="text-3xl lg:text-4xl font-bold">Escudo</h1>
          <p className="text-lg text-muted-foreground">
            Un escudo familiar contra la extorsión con voz clonada. Reacciona
            a un patrón de comportamiento — nunca analiza si una llamada,
            voz o video es falso.
          </p>
        </div>

        <footer className="w-full flex items-center justify-center border-t mx-auto text-center text-xs gap-8 py-16">
          <p>Escudo — nunca analiza si una llamada o video es falso.</p>
          <ThemeSwitcher />
        </footer>
      </div>
    </main>
  );
}
