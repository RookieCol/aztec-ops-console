import type { ScoreBreakdown as ScoreBreakdownType } from '@/lib/engine/types'

export type ScoreBreakdownProps = {
  score: ScoreBreakdownType
}

const COMPONENTS: {
  key: 'urgencia' | 'prioridad' | 'flags'
  label: string
  weight: number
  bar: string
}[] = [
  { key: 'urgencia', label: 'Urgencia', weight: 0.5, bar: 'bg-red-500/70 dark:bg-red-400/70' },
  { key: 'prioridad', label: 'Prioridad', weight: 0.3, bar: 'bg-blue-500/70 dark:bg-blue-400/70' },
  { key: 'flags', label: 'Flags', weight: 0.2, bar: 'bg-amber-500/70 dark:bg-amber-400/70' },
]

/**
 * Desglose visible del score = 0.5*urgencia + 0.3*prioridad + 0.2*flags. El enunciado pide
 * un criterio de priorización claro: aquí se ve la fórmula, cada componente (0-100), su peso,
 * la contribución (peso*valor) y de dónde sale la prioridad (derivada de tareas u override manual).
 */
export function ScoreBreakdown({ score }: ScoreBreakdownProps) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-black/10 bg-black/[.02] p-3 text-sm dark:border-white/10 dark:bg-white/[.03]">
      <p className="font-mono text-xs text-foreground/60">
        score = 0.5·urgencia + 0.3·prioridad + 0.2·flags
      </p>

      <div className="flex flex-col gap-2">
        {COMPONENTS.map(({ key, label, weight, bar }) => {
          const value = score[key]
          const contribution = weight * value
          return (
            <div key={key} className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-xs text-foreground/70">{label}</span>
              <div
                className="h-2 flex-1 overflow-hidden rounded-full bg-black/10 dark:bg-white/10"
                role="img"
                aria-label={`${label}: ${value.toFixed(0)} de 100, peso ${weight}, contribución ${contribution.toFixed(1)}`}
              >
                <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
              </div>
              <span className="w-14 shrink-0 text-right text-xs tabular-nums text-foreground/70">
                {value.toFixed(0)}
              </span>
              <span className="w-10 shrink-0 text-right text-xs tabular-nums text-foreground/40">
                ×{weight}
              </span>
              <span className="w-12 shrink-0 text-right text-xs font-medium tabular-nums text-foreground">
                {contribution.toFixed(1)}
              </span>
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-between border-t border-black/10 pt-2 dark:border-white/10">
        <span className="text-xs text-foreground/60">
          Prioridad:{' '}
          <span className="font-medium text-foreground">{score.priorityLabel}</span>{' '}
          {score.priorityIsOverride ? (
            <span className="text-foreground/50">(fijada manualmente)</span>
          ) : (
            <span className="text-foreground/50">(derivada de tareas)</span>
          )}
        </span>
        <span className="text-sm font-semibold tabular-nums text-foreground">
          Total: {score.total.toFixed(1)}
        </span>
      </div>
    </div>
  )
}
