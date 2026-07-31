import Link from 'next/link'
import { notFound } from 'next/navigation'
import { loadProjectView, loadProjectExtras } from '@/lib/data/views'
import { ProjectDetailForm } from '@/components/ProjectDetailForm'

export const dynamic = 'force-dynamic'

export default async function ProjectDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const view = await loadProjectView(code)
  if (!view) notFound()
  const { issues, changeLog } = await loadProjectExtras(code)

  return (
    <div className="flex flex-1 flex-col bg-background text-foreground">
      <header className="border-b border-black/10 px-6 py-4 dark:border-white/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <Link href="/" className="text-sm text-foreground/60 hover:text-foreground">
            ← Volver
          </Link>
          <span className="text-sm text-foreground/40">{view.project.code}</span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
        <ProjectDetailForm view={view} issues={issues} changeLog={changeLog} />
      </main>
    </div>
  )
}
