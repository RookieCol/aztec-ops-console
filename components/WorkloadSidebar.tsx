import type { PersonWorkload } from '@/lib/engine/types'

export type WorkloadSidebarProps = {
  workload: PersonWorkload[]
}

function pct(share: number): number {
  return Math.max(0, Math.min(100, Math.round(share * 100)))
}

function PersonRow({
  person,
  isTop,
}: {
  person: PersonWorkload
  isTop: boolean
}) {
  const share = pct(person.shareOfBacklog)

  return (
    <li
      className={
        isTop
          ? 'rounded-lg border border-amber-300/70 bg-amber-50/70 p-3 shadow-sm dark:border-amber-500/30 dark:bg-amber-950/20'
          : 'rounded-lg border border-black/10 bg-black/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.02]'
      }
    >
      <div className="flex items-baseline justify-between gap-2">
        <span
          className={
            isTop
              ? 'truncate text-sm font-semibold text-foreground'
              : 'truncate text-sm font-medium text-foreground'
          }
        >
          {person.alias}
        </span>
        <span
          className={
            isTop
              ? 'shrink-0 text-sm font-semibold tabular-nums text-amber-700 dark:text-amber-400'
              : 'shrink-0 text-xs font-medium tabular-nums text-foreground/60'
          }
        >
          {share}%
        </span>
      </div>

      <div
        className={
          isTop
            ? 'mt-1.5 h-2 w-full overflow-hidden rounded-full bg-amber-900/10 dark:bg-amber-100/10'
            : 'mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10'
        }
        role="img"
        aria-label={`${share}% del backlog total`}
      >
        <div
          className={
            isTop
              ? 'h-full rounded-full bg-amber-600 dark:bg-amber-400'
              : 'h-full rounded-full bg-foreground/40'
          }
          style={{ width: `${share}%` }}
        />
      </div>

      {/* Lista de estadísticas en línea en vez de una grilla 2x2 — antes "Abiertas" y
          "Proyectos" quedaban lado a lado como si fueran comparables, cuando son medidas
          distintas. Acá cada una es su propio chip, se lee de corrido. */}
      <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
        <span className="rounded bg-black/5 px-1.5 py-0.5 text-foreground/70 dark:bg-white/10">
          <strong className="font-semibold text-foreground">{person.openTasks}</strong> abiertas
        </span>
        <span className="rounded bg-black/5 px-1.5 py-0.5 text-foreground/70 dark:bg-white/10">
          <strong className="font-semibold text-foreground">{person.projects.length}</strong> proyectos
        </span>
        <span className="rounded bg-orange-500/15 px-1.5 py-0.5 text-orange-700 dark:text-orange-400">
          <strong className="font-semibold">{person.highOrCriticalOpen}</strong> alta/crítica
        </span>
        {person.blockedTasks > 0 && (
          <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-red-700 dark:text-red-400">
            <strong className="font-semibold">{person.blockedTasks}</strong> bloqueadas
          </span>
        )}
        {person.overdueTasksToday > 0 && (
          <span className="rounded bg-red-500/20 px-1.5 py-0.5 font-medium text-red-700 dark:text-red-300">
            <strong className="font-semibold">{person.overdueTasksToday}</strong> vencidas hoy
          </span>
        )}
        {!person.inTeamSheet && (
          <span
            className="rounded bg-black/5 px-1.5 py-0.5 text-foreground/40 dark:bg-white/10"
            title="No aparece en la pestana Team de la fuente; la carga se calculo directamente desde las tareas asignadas."
          >
            no está en Team
          </span>
        )}
      </div>
    </li>
  )
}

/**
 * Panel lateral de carga por persona, recalculada desde las tareas (no desde la
 * pestana Team, que omite a gente real como Andrea Molina). Ordenado por carga
 * abierta descendente; quien concentra el mayor share del backlog se destaca con
 * un tratamiento visual propio (borde/fondo ambar, barra mas gruesa) para que el
 * cuello de botella se vea de un vistazo, sin depender de una tabla plana ni de
 * texto de alerta forzado. El indicador "no esta en Team" es sutil y secundario:
 * es una nota de calidad de datos, no el mensaje principal de esa persona.
 */
export function WorkloadSidebar({ workload }: WorkloadSidebarProps) {
  const topShare = workload.length > 0 ? workload[0].shareOfBacklog : 0

  return (
    <aside className="flex w-full flex-col gap-3 lg:w-[300px] lg:shrink-0">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/50">
        Carga por persona
      </h2>

      {workload.length === 0 ? (
        <p className="text-sm text-foreground/50">Sin tareas asignadas.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {workload.map((person) => (
            <PersonRow
              key={person.alias}
              person={person}
              isTop={person.shareOfBacklog === topShare && topShare > 0}
            />
          ))}
        </ol>
      )}
    </aside>
  )
}
