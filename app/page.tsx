import Link from 'next/link'
import { loadDashboard } from '@/lib/data/views'
import { AlertStrip } from '@/components/AlertStrip'
import { DataQualityPanel } from '@/components/DataQualityPanel'
import { Queues } from '@/components/Queues'
import { WorkloadSidebar } from '@/components/WorkloadSidebar'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const dashboard = await loadDashboard()

  const groups = Array.from(dashboard.groups.entries()).map(([engagementType, views]) => ({
    engagementType,
    views,
  }))

  const totalCounts = {
    bloqueado: dashboard.views.filter((v) => v.flags.some((f) => f.kind === 'bloqueado')).length,
    en_riesgo: dashboard.views.filter((v) => v.flags.some((f) => f.kind === 'en_riesgo')).length,
    sin_siguiente_paso: dashboard.views.filter((v) => v.flags.some((f) => f.kind === 'sin_siguiente_paso'))
      .length,
  }

  return (
    <div className="flex flex-1 flex-col bg-background text-foreground">
      <header className="border-b px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Aztec Ops Console</h1>
            <p className="text-sm text-muted-foreground">
              Hoy: {dashboard.now} · qué atender primero, en qué orden y por qué.
            </p>
          </div>
          <Link href="/proyectos/nuevo" className={cn(buttonVariants(), 'shrink-0')}>
            + Nuevo proyecto
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-6 py-8">
        <AlertStrip
          bloqueado={dashboard.alerts.bloqueado}
          en_riesgo={dashboard.alerts.en_riesgo}
          sin_siguiente_paso={dashboard.alerts.sin_siguiente_paso}
          totalCounts={totalCounts}
        />

        <DataQualityPanel issues={dashboard.issues} lastRun={dashboard.lastRun} />

        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1">
            <Queues groups={groups} />
          </div>
          <WorkloadSidebar workload={dashboard.workload} />
        </div>
      </main>
    </div>
  )
}
