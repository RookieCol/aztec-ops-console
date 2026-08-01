'use client'

import Link from 'next/link'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Sin este archivo, el fallo más probable de un clon en frío —levantar la app sin haber corrido
 * `pnpm db:reset`— caía en la pantalla por defecto de Next: `no such table: projects` sobre
 * fondo blanco, sin la cabecera de la app y sin decir qué hacer. El README lo cubre en el orden
 * correcto, pero la primera impresión de quien se saltó un paso no debería ser que el proyecto
 * está roto.
 *
 * Nota sobre por qué no se detecta el caso concreto: en producción Next no entrega el mensaje
 * original al boundary —solo un `digest`— así que ramificar sobre `error.message` funcionaría en
 * desarrollo y fallaría en silencio al desplegar. Preferimos no simular una detección que no
 * tenemos: se nombra la causa más probable como sugerencia, y se muestra el detalle solo cuando
 * el entorno lo entrega.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-1 flex-col bg-background text-foreground">
      <header className="border-b px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center gap-4">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Volver
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col items-start gap-4 px-6 py-12">
        <div className="flex flex-col gap-2">
          <h1 className="text-lg font-semibold tracking-tight">No pudimos cargar esta vista</h1>
          <p className="max-w-prose text-sm text-muted-foreground">
            Si es la primera vez que levantás la consola, lo más probable es que la base todavía
            no exista: se crea al importar el archivo de origen, no al arrancar el servidor.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Detené el servidor y corré
          </p>
          <pre className="rounded-md border bg-muted/50 px-3 py-2 text-sm">
            <code>pnpm db:reset</code>
          </pre>
        </div>

        {error.message && (
          <details className="max-w-prose">
            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
              Ver el detalle técnico
            </summary>
            <p className="mt-2 break-words rounded-md border bg-muted/30 px-3 py-2 font-mono text-xs text-muted-foreground">
              {error.message}
              {error.digest && <span className="block opacity-70">digest: {error.digest}</span>}
            </p>
          </details>
        )}

        <div className="flex items-center gap-2">
          <Button onClick={reset}>Reintentar</Button>
          <Link href="/" className={cn(buttonVariants({ variant: 'outline' }))}>
            Ir a la consola
          </Link>
        </div>
      </main>
    </div>
  )
}
