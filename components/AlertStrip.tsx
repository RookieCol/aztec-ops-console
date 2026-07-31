import Link from 'next/link'
import type { Flag, FlagKind, ProjectView } from '@/lib/engine/types'

export type AlertStripProps = {
  bloqueado: { view: ProjectView; flag: Flag }[]
  en_riesgo: { view: ProjectView; flag: Flag }[]
  sin_siguiente_paso: { view: ProjectView; flag: Flag }[]
  totalCounts: { bloqueado: number; en_riesgo: number; sin_siguiente_paso: number }
}

const FLAG_META: Record<
  FlagKind,
  { label: string; singular: string; accent: string; dot: string }
> = {
  bloqueado: {
    label: 'Bloqueados',
    singular: 'bloqueado',
    accent:
      'border-red-200 bg-red-50/60 dark:border-red-900/50 dark:bg-red-950/20',
    dot: 'bg-red-600 dark:bg-red-500',
  },
  en_riesgo: {
    label: 'En riesgo',
    singular: 'en riesgo',
    accent:
      'border-amber-200 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/20',
    dot: 'bg-amber-500 dark:bg-amber-400',
  },
  sin_siguiente_paso: {
    label: 'Sin siguiente paso',
    singular: 'sin siguiente paso',
    accent:
      'border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900/30',
    dot: 'bg-slate-500 dark:bg-slate-400',
  },
}

const ORDER: FlagKind[] = ['bloqueado', 'en_riesgo', 'sin_siguiente_paso']

function SeverityBar({ severity }: { severity: number }) {
  const pct = Math.max(0, Math.min(100, severity))
  return (
    <div
      className="h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-black/10 dark:bg-white/10"
      title={`Severidad ${pct}`}
    >
      <div
        className="h-full rounded-full bg-current opacity-70"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
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
    <section className={`flex min-w-0 flex-1 flex-col rounded-lg border p-4 ${meta.accent}`}>
      <header className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <span className={`inline-block h-2 w-2 rounded-full ${meta.dot}`} aria-hidden />
          {meta.label}
        </h2>
        <span className="text-xs font-medium tabular-nums text-foreground/60">
          {total} {total === 1 ? 'proyecto' : 'proyectos'}
        </span>
      </header>

      {entries.length === 0 ? (
        <p className="text-sm text-foreground/50">Sin proyectos {meta.singular}.</p>
      ) : (
        <ol className="flex max-h-80 flex-col gap-2 overflow-y-auto pr-1">
          {entries.map(({ view, flag }) => (
            <li key={view.project.code}>
              <Link
                href={`/proyectos/${view.project.code}`}
                className="group flex flex-col gap-1 rounded-md border border-transparent px-2 py-1.5 -mx-2 transition-colors hover:border-black/10 hover:bg-white/60 dark:hover:border-white/10 dark:hover:bg-white/5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-foreground group-hover:underline">
                    {view.project.name}
                  </span>
                  <SeverityBar severity={flag.severity} />
                </div>
                {flag.reasons[0] && (
                  <p className="truncate text-xs text-foreground/60">{flag.reasons[0]}</p>
                )}
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

/**
 * Franja principal: responde "que atiendo hoy". Tres columnas por tipo de flag, cada una
 * con el conteo total y TODOS los proyectos de ese flag ordenados por severidad — no solo
 * el top-3 — con scroll propio (max-h-80) para que una columna con 18 proyectos no empuje
 * el resto de la pantalla hacia abajo. Es lo primero que se ve en la pantalla — el panel de
 * calidad de datos va debajo, compacto.
 */
export function AlertStrip(props: AlertStripProps) {
  const byKind: Record<FlagKind, { view: ProjectView; flag: Flag }[]> = {
    bloqueado: props.bloqueado,
    en_riesgo: props.en_riesgo,
    sin_siguiente_paso: props.sin_siguiente_paso,
  }

  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-lg font-semibold tracking-tight text-foreground">Que atiendo hoy</h1>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {ORDER.map((kind) => (
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
