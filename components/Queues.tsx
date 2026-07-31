import Link from 'next/link'
import type { ProjectView } from '@/lib/engine/types'
import { formatUsd } from '@/lib/format'
import { ENGAGEMENT_ACCENT, FLAG_META, PROJECT_STATUS_CHIP, QUEUE_TITLES } from '@/lib/ui-tokens'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScoreBreakdown } from './ScoreBreakdown'

export type QueuesProps = {
  groups: { engagementType: string; views: ProjectView[] }[]
}

function QueueRow({ view }: { view: ProjectView }) {
  const { project, fields, flags, score } = view
  const statusClass = PROJECT_STATUS_CHIP[fields.status]

  return (
    <Card
      size="sm"
      className="gap-0 p-0 ring-1 transition-colors hover:ring-foreground/20"
    >
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
            {/* Igual que "sev" en la franja de alertas: el número sin etiqueta se confunde
                con un conteo. Acá el ancho no da para la palabra completa, así que la lleva
                el tooltip y el lector de pantalla. */}
            <Badge
              variant="secondary"
              className="shrink-0 font-semibold tabular-nums"
              title={`Score de priorización ${score.total.toFixed(1)} de 100`}
              aria-label={`Score de priorización ${score.total.toFixed(1)} de 100`}
            >
              {score.total.toFixed(1)}
            </Badge>
          </div>

          <p className="truncate text-xs text-muted-foreground">
            {project.clientAlias} · {project.ownerAlias ?? 'sin responsable'}
          </p>

          <div className="flex flex-wrap items-center gap-1.5">
            {flags.map((flag) => (
              <Badge key={flag.kind} variant="outline" className={`border-0 ${FLAG_META[flag.kind].chip}`}>
                {FLAG_META[flag.kind].badge}
              </Badge>
            ))}
            {statusClass && (
              <Badge variant="outline" className={`border-0 ${statusClass}`}>
                {fields.status}
              </Badge>
            )}
            <span className="ml-auto shrink-0 text-[11px] tabular-nums text-muted-foreground">
              {formatUsd(project.businessValueUsd)}
            </span>
          </div>

          <span className="text-[11px] text-muted-foreground/70 group-open:hidden">
            Ver desglose del score ▾
          </span>
          <span className="hidden text-[11px] text-muted-foreground/70 group-open:inline">
            Ocultar desglose ▴
          </span>
        </summary>

        <div className="border-t px-3 pb-3 pt-2">
          <ScoreBreakdown score={score} />
        </div>
      </details>
    </Card>
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
    <Card
      className={`min-w-0 flex-1 gap-3 border-t-4 bg-muted/30 p-3 ${ENGAGEMENT_ACCENT[engagementType] ?? ''}`}
    >
      <header className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <Badge variant="secondary" className="tabular-nums">
          {views.length}
        </Badge>
      </header>

      {views.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin proyectos en esta cola.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {views.map((view) => (
            <li key={view.project.code}>
              <QueueRow view={view} />
            </li>
          ))}
        </ol>
      )}
    </Card>
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
      <h2 className="text-lg font-semibold tracking-tight text-foreground">Colas por tipo de trabajo</h2>
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
