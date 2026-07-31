import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Sin este archivo, `notFound()` (que dispara el detalle de un proyecto inexistente) caía en
 * la pantalla por defecto de Next: sin cabecera, sin estilos de la app y sin ningún enlace
 * de vuelta — un callejón sin salida del que solo se sale con el botón atrás del navegador.
 */
export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col bg-background text-foreground">
      <header className="border-b px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center gap-4">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Volver
          </Link>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col items-start gap-3 px-6 py-12">
        <h1 className="text-lg font-semibold tracking-tight">No encontramos esa página</h1>
        <p className="text-sm text-muted-foreground">
          Puede que el proyecto ya no exista o que el enlace esté mal escrito.
        </p>
        <Link href="/" className={cn(buttonVariants(), 'mt-2')}>
          Ir a la consola
        </Link>
      </main>
    </div>
  )
}
