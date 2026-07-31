import Link from 'next/link'
import { notFound } from 'next/navigation'
import { loadProjectView, loadProjectExtras } from '@/lib/data/views'
import { ProjectDetailForm } from '@/components/ProjectDetailForm'
import { today } from '@/lib/clock'

export const dynamic = 'force-dynamic'

export default async function ProjectDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  // `today()` se resuelve en el servidor y se pasa hacia abajo: si el componente cliente lo
  // calculara por su cuenta usaría la fecha del navegador, que puede diferir de la del
  // servidor (zona horaria, o APP_TODAY fijado) y provocar un mismatch de hidratación.
  const now = today()
  const view = await loadProjectView(code, now)
  if (!view) notFound()
  const { issues, changeLog } = await loadProjectExtras(code)

  return (
    <div className="flex flex-1 flex-col bg-background text-foreground">
      <header className="border-b px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Volver
          </Link>
          <span className="text-sm text-muted-foreground/60">{view.project.code}</span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
        <ProjectDetailForm view={view} issues={issues} changeLog={changeLog} now={now} />
      </main>
    </div>
  )
}
