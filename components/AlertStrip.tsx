import Link from 'next/link'
import { Progress as ProgressPrimitive } from '@base-ui/react/progress'
import type { Flag, FlagKind, ProjectView } from '@/lib/engine/types'
import { FLAG_META, FLAG_ORDER } from '@/lib/ui-tokens'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ProgressTrack, ProgressIndicator } from '@/components/ui/progress'

export type AlertStripProps = {
  bloqueado: { view: ProjectView; flag: Flag }[]
  en_riesgo: { view: ProjectView; flag: Flag }[]
  sin_siguiente_paso: { view: ProjectView; flag: Flag }[]
  totalCounts: { bloqueado: number; en_riesgo: number; sin_siguiente_paso: number }
}

function AlertColumn({
  kind,
  entries,
  total,
}: {
  kind: FlagKind
  entries: { view: ProjectView; flag: Flag }[]
  total: number
}) {
  const meta = FLAG_META[kind]

  return (
    <Card className={`min-w-0 flex-1 gap-3 p-4 ring-2 ${meta.ring}`}>
      <header className="flex items-baseline justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <span className={`inline-block h-2 w-2 rounded-full ${meta.dot}`} aria-hidden />
          {meta.heading}
        </h3>
        <span className="text-xs font-medium tabular-nums text-muted-foreground">
          {total} {total === 1 ? 'proyecto' : 'proyectos'}
        </span>
      </header>

      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin proyectos {meta.singular}.</p>
      ) : (
        <ScrollArea className="max-h-80 pr-1">
          <ol className="flex flex-col gap-2">
            {entries.map(({ view, flag }) => (
              <li key={view.project.code}>
                <Link
                  href={`/proyectos/${view.project.code}`}
                  className="group -mx-2 flex flex-col gap-1.5 rounded-md border border-transparent px-2 py-1.5 transition-colors hover:border-border hover:bg-accent"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-foreground group-hover:underline">
                      {view.project.name}
                    </span>
                    {/* El número solo, sin etiqueta, se confunde con un score o un conteo.
                        "sev" lo ancla a la barra que va justo debajo. El aria-label completo
                        vive en la barra, así que acá no se repite. */}
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground" aria-hidden>
                      <span className="text-muted-foreground/60">sev</span>{' '}
                      <span className="font-medium">{Math.round(flag.severity)}</span>
                    </span>
                  </div>
                  <ProgressPrimitive.Root
                    value={Math.max(0, Math.min(100, flag.severity))}
                    aria-label={`Severidad ${Math.round(flag.severity)} de 100 — ordena los proyectos dentro de esta columna`}
                  >
                    <ProgressTrack className="h-1.5">
                      <ProgressIndicator className={meta.indicator} />
                    </ProgressTrack>
                  </ProgressPrimitive.Root>
                  {flag.reasons[0] && (
                    <p className="truncate text-xs text-muted-foreground">{flag.reasons[0]}</p>
                  )}
                </Link>
              </li>
            ))}
          </ol>
        </ScrollArea>
      )}
    </Card>
  )
}

/**
 * Franja principal: responde "que atiendo hoy". Tres columnas por tipo de flag, cada una
 * con el conteo total y TODOS los proyectos de ese flag ordenados por severidad — no solo
 * el top-3 — con scroll propio (ScrollArea, max-h-80) para que una columna con 18 proyectos
 * no empuje el resto de la pantalla hacia abajo. Es lo primero que se ve en la pantalla — el
 * panel de calidad de datos va debajo, compacto.
 */
export function AlertStrip(props: AlertStripProps) {
  const byKind: Record<FlagKind, { view: ProjectView; flag: Flag }[]> = {
    bloqueado: props.bloqueado,
    en_riesgo: props.en_riesgo,
    sin_siguiente_paso: props.sin_siguiente_paso,
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold tracking-tight text-foreground">Qué atiendo hoy</h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {FLAG_ORDER.map((kind) => (
          <AlertColumn
            key={kind}
            kind={kind}
            entries={byKind[kind]}
            total={props.totalCounts[kind]}
          />
        ))}
      </div>
    </div>
  )
}
