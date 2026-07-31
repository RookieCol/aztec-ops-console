import Link from 'next/link'
import type { FlagKind, ProjectView } from '@/lib/engine/types'
import { ScoreBreakdown } from './ScoreBreakdown'

export type QueuesProps = {
  groups: { engagementType: string; views: ProjectView[] }[]
}

const QUEUE_TITLES: Record<string, string> = {
  Proyecto: 'Proyectos',
  Diagnostico: 'Diagnósticos',
  'Mantenimiento o recurrente': 'Mantenimiento',
}

const COLUMN_ACCENT: Record<string, string> = {
  Proyecto: 'border-t-sky-500 dark:border-t-sky-400',
  Diagnostico: 'border-t-violet-500 dark:border-t-violet-400',
  'Mantenimiento o recurrente': 'border-t-emerald-500 dark:border-t-emerald-400',
}

/** Chips planos (sin borde, fondo tenue) — antes eran pills con borde que, repetidos en
 * casi cada tarjeta, saturaban la columna de color. */
const FLAG_BADGE: Record<FlagKind, { label: string; className: string }> = {
  bloqueado: { label: 'Bloqueado', className: 'bg-red-500/15 text-red-700 dark:text-red-400' },
  en_riesgo: { label: 'En riesgo', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
  sin_siguiente_paso: {
    label: 'Sin siguiente paso',
    className: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
  },
}

/** Solo se muestra si NO es "Activo" — ese es el estado esperado de la mayoría, mostrarlo
 * en todas las tarjetas era ruido sin información. */
const STATUS_BADGE: Record<string, string> = {
  'En pausa': 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  Bloqueado: 'bg-red-500/15 text-red-700 dark:text-red-400',
  Cerrado: 'bg-foreground/10 text-foreground/60',
}

function formatUsd(value: number | null): string {
  if (value === null) return 'valor desconocido'
  return value.toLocaleString('es-CO', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })
}

function QueueRow({ view }: { view: ProjectView }) {
  const { project, fields, flags, score } = view
  const statusClass = STATUS_BADGE[fields.status]

  return (
    <li className="rounded-lg border border-black/10 bg-background transition-colors hover:border-black/20 dark:border-white/10 dark:hover:border-white/20">
      <details className="group">
        <summary className="flex cursor-pointer list-none flex-col gap-1.5 px-3 py-2.5 marker:hidden [&::-webkit-details-marker]:hidden">
          <div className="flex items-start justify-between gap-2">
            {/*
              Sin onClick/stopPropagation a propósito: este es un Server Component (el
              <details> nativo ya da expandir/colapsar sin JS). Un manejador de evento aquí
              rompería esa garantía y forzaría a convertir todo el árbol en Client Component.
              El único costo es un parpadeo del <details> al navegar, que es irrelevante
              porque la navegación reemplaza la página de inmediato.
            */}
            <Link
              href={`/proyectos/${project.code}`}
              className="min-w-0 truncate text-sm font-medium text-foreground hover:underline"
            >
              {project.name}
            </Link>
            <span className="shrink-0 rounded-md bg-black/5 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-foreground dark:bg-white/10">
              {score.total.toFixed(1)}
            </span>
          </div>

          <p className="truncate text-xs text-foreground/60">
            {project.clientAlias} · {project.ownerAlias ?? 'sin responsable'}
          </p>

          <div className="flex flex-wrap items-center gap-1.5">
            {flags.map((flag) => (
              <span
                key={flag.kind}
                className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${FLAG_BADGE[flag.kind].className}`}
              >
                {FLAG_BADGE[flag.kind].label}
              </span>
            ))}
            {statusClass && (
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${statusClass}`}>
                {fields.status}
              </span>
            )}
            <span className="ml-auto shrink-0 text-[11px] tabular-nums text-foreground/50">
              {formatUsd(project.businessValueUsd)}
            </span>
          </div>

          <span className="text-[11px] text-foreground/40 group-open:hidden">
            Ver desglose del score ▾
          </span>
          <span className="hidden text-[11px] text-foreground/40 group-open:inline">
            Ocultar desglose ▴
          </span>
        </summary>

        <div className="border-t border-black/10 px-3 pb-3 pt-2 dark:border-white/10">
          <ScoreBreakdown score={score} />
        </div>
      </details>
    </li>
  )
}

function QueueSection({
  engagementType,
  views,
}: {
  engagementType: string
  views: ProjectView[]
}) {
  const title = QUEUE_TITLES[engagementType] ?? engagementType

  return (
    <section
      className={`flex min-w-0 flex-1 flex-col gap-3 rounded-lg border border-t-4 border-black/10 bg-black/[0.015] p-3 dark:border-white/10 dark:bg-white/[0.02] ${COLUMN_ACCENT[engagementType] ?? ''}`}
    >
      <header className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs font-medium tabular-nums text-foreground/60 dark:bg-white/10">
          {views.length}
        </span>
      </header>

      {views.length === 0 ? (
        <p className="text-sm text-foreground/50">Sin proyectos en esta cola.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {views.map((view) => (
            <QueueRow key={view.project.code} view={view} />
          ))}
        </ol>
      )}
    </section>
  )
}

/**
 * Tres colas por engagementType, no compiten entre sí (diagnóstico vs proyecto vs
 * mantenimiento son trabajo distinto). El orden por score.total ya viene dado por quien
 * ensambla la página; acá solo se renderiza. Cada fila es expandible con <details> nativo
 * para mostrar el desglose del score sin JS de cliente. Cada columna es un contenedor propio
 * (mismo lenguaje visual que el tablero Kanban de tareas) con un acento de color distinto.
 */
export function Queues({ groups }: QueuesProps) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold tracking-tight text-foreground">Colas por tipo de trabajo</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {groups.map((group) => (
          <QueueSection
            key={group.engagementType}
            engagementType={group.engagementType}
            views={group.views}
          />
        ))}
      </div>
    </div>
  )
}
