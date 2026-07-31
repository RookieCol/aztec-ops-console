import { Progress as ProgressPrimitive } from '@base-ui/react/progress'
import type { PersonWorkload } from '@/lib/engine/types'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ProgressTrack, ProgressIndicator } from '@/components/ui/progress'

export type WorkloadSidebarProps = {
  workload: PersonWorkload[]
}

function pct(share: number): number {
  return Math.max(0, Math.min(100, Math.round(share * 100)))
}

function PersonRow({ person, isTop }: { person: PersonWorkload; isTop: boolean }) {
  const share = pct(person.shareOfBacklog)

  return (
    <Card
      size="sm"
      className={
        isTop
          ? 'gap-1.5 p-3 ring-2 ring-amber-300/70 dark:ring-amber-500/30'
          : 'gap-1.5 p-3'
      }
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className={isTop ? 'truncate text-sm font-semibold' : 'truncate text-sm font-medium'}>
          {person.alias}
        </span>
        <span
          className={
            isTop
              ? 'shrink-0 text-sm font-semibold tabular-nums text-amber-700 dark:text-amber-400'
              : 'shrink-0 text-xs font-medium tabular-nums text-muted-foreground'
          }
        >
          {share}%
        </span>
      </div>

      <ProgressPrimitive.Root value={share} aria-label={`${share}% del backlog total`}>
        <ProgressTrack className={isTop ? 'h-2 bg-amber-900/10 dark:bg-amber-100/10' : 'h-1.5'}>
          <ProgressIndicator
            className={isTop ? 'bg-amber-600 dark:bg-amber-400' : 'bg-foreground/40'}
          />
        </ProgressTrack>
      </ProgressPrimitive.Root>

      {/* Lista de estadísticas en línea en vez de una grilla 2x2 — antes "Abiertas" y
          "Proyectos" quedaban lado a lado como si fueran comparables, cuando son medidas
          distintas. Acá cada una es su propio chip, se lee de corrido. */}
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        <Badge variant="secondary">
          <strong className="font-semibold">{person.openTasks}</strong>&nbsp;abiertas
        </Badge>
        <Badge variant="secondary">
          <strong className="font-semibold">{person.projects.length}</strong>&nbsp;proyectos
        </Badge>
        <Badge variant="outline" className="border-0 bg-orange-500/15 text-orange-700 dark:text-orange-400">
          <strong className="font-semibold">{person.highOrCriticalOpen}</strong>&nbsp;alta/crítica
        </Badge>
        {person.blockedTasks > 0 && (
          <Badge variant="outline" className="border-0 bg-red-500/15 text-red-700 dark:text-red-400">
            <strong className="font-semibold">{person.blockedTasks}</strong>&nbsp;bloqueadas
          </Badge>
        )}
        {person.overdueTasksToday > 0 && (
          <Badge variant="outline" className="border-0 bg-red-500/20 font-medium text-red-700 dark:text-red-300">
            <strong className="font-semibold">{person.overdueTasksToday}</strong>&nbsp;vencidas hoy
          </Badge>
        )}
        {!person.inTeamSheet && (
          <Badge variant="secondary" className="text-muted-foreground">
            no está en Team
            {/* La explicación va en el DOM, no solo en un `title`: un title no llega ni en
                táctil ni por teclado. */}
            <span className="sr-only">
              : no aparece en la pestaña Team de la fuente, así que la carga se calculó
              directamente desde las tareas asignadas.
            </span>
          </Badge>
        )}
      </div>
    </Card>
  )
}

/**
 * Panel lateral de carga por persona, recalculada desde las tareas (no desde la
 * pestaña Team, que omite a gente real como Andrea Molina). Ordenado por carga
 * abierta descendente; quien concentra el mayor share del backlog se destaca con
 * un tratamiento visual propio (ring/fondo ámbar, barra más gruesa) para que el
 * cuello de botella se vea de un vistazo, sin depender de una tabla plana ni de
 * texto de alerta forzado. El indicador "no está en Team" es sutil y secundario:
 * es una nota de calidad de datos, no el mensaje principal de esa persona.
 */
export function WorkloadSidebar({ workload }: WorkloadSidebarProps) {
  const topShare = workload.length > 0 ? workload[0].shareOfBacklog : 0

  return (
    <aside className="flex w-full flex-col gap-3 lg:w-[300px] lg:shrink-0">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Carga por persona
      </h2>

      {workload.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin tareas asignadas.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {workload.map((person) => (
            <li key={person.alias}>
              <PersonRow person={person} isTop={person.shareOfBacklog === topShare && topShare > 0} />
            </li>
          ))}
        </ol>
      )}
    </aside>
  )
}
