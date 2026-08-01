import { Progress as ProgressPrimitive } from '@base-ui/react/progress'
import type { ScoreBreakdown as ScoreBreakdownType } from '@/lib/engine/types'
import { displayLabel } from '@/lib/format'
import { Card } from '@/components/ui/card'
import { ProgressTrack, ProgressIndicator } from '@/components/ui/progress'

export type ScoreBreakdownProps = {
  score: ScoreBreakdownType
}

const COMPONENTS: {
  key: 'urgencia' | 'prioridad' | 'flags'
  label: string
  weight: number
  indicator: string
}[] = [
  { key: 'urgencia', label: 'Urgencia', weight: 0.5, indicator: 'bg-red-500/70 dark:bg-red-400/70' },
  { key: 'prioridad', label: 'Prioridad', weight: 0.3, indicator: 'bg-sky-500/70 dark:bg-sky-400/70' },
  { key: 'flags', label: 'Flags', weight: 0.2, indicator: 'bg-amber-500/70 dark:bg-amber-400/70' },
]

/**
 * Tres orígenes, no dos. Con un booleano "es override / no lo es", un proyecto sin ninguna tarea
 * mostraba "(derivada de tareas)" — y ese es justo el caso más visible del sistema: PRJ-21,
 * vencido y con el backlog vacío. La etiqueta contradecía al número que estaba al lado.
 */
const PRIORITY_SOURCE: Record<ScoreBreakdownType['prioritySource'], string> = {
  override: '(fijada manualmente)',
  tasks: '(derivada de tareas)',
  'empty-backlog': '(vencido y sin tareas)',
}

/**
 * Desglose visible del score = 0.5*urgencia + 0.3*prioridad + 0.2*flags. El enunciado pide
 * un criterio de priorización claro: aquí se ve la fórmula, cada componente (0-100), su peso,
 * la contribución (peso*valor) y de dónde sale la prioridad (derivada de tareas u override manual).
 */
export function ScoreBreakdown({ score }: ScoreBreakdownProps) {
  return (
    <Card className="gap-3 p-3 text-sm">
      <p className="font-mono text-xs text-muted-foreground">
        score = 0.5·urgencia + 0.3·prioridad + 0.2·flags
      </p>

      <div className="flex flex-col gap-2">
        {COMPONENTS.map(({ key, label, weight, indicator }) => {
          const value = score[key]
          const contribution = weight * value
          return (
            <div key={key} className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-xs text-muted-foreground">{label}</span>
              <ProgressPrimitive.Root
                value={Math.max(0, Math.min(100, value))}
                className="flex-1"
                aria-label={`${label}: ${value.toFixed(0)} de 100, peso ${weight}, contribución ${contribution.toFixed(1)}`}
              >
                <ProgressTrack className="h-2">
                  <ProgressIndicator className={indicator} />
                </ProgressTrack>
              </ProgressPrimitive.Root>
              <span className="w-14 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                {value.toFixed(0)}
              </span>
              <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground/70">
                ×{weight}
              </span>
              <span className="w-12 shrink-0 text-right text-xs font-medium tabular-nums text-foreground">
                {contribution.toFixed(1)}
              </span>
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-between border-t pt-2">
        <span className="text-xs text-muted-foreground">
          Prioridad:{' '}
          <span className="font-medium text-foreground">{displayLabel(score.priorityLabel)}</span>{' '}
          <span className="text-muted-foreground/80">{PRIORITY_SOURCE[score.prioritySource]}</span>
        </span>
        <span className="text-sm font-semibold tabular-nums text-foreground">
          Total: {score.total.toFixed(1)}
        </span>
      </div>
    </Card>
  )
}
