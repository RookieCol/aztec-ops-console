import type { Project, ProjectFields, Task } from '@/lib/db/schema'

export type FlagKind = 'bloqueado' | 'en_riesgo' | 'sin_siguiente_paso'

export type Flag = {
  kind: FlagKind
  /** 0-100. Ordena dentro del flag y decide el top-N de la franja de alertas. */
  severity: number
  reasons: string[]
}

export type ScoreBreakdown = {
  urgencia: number
  prioridad: number
  flags: number
  total: number
  /** Prioridad Critica/Alta/Media/Baja usada, y si viene de override manual o derivada. */
  priorityLabel: 'Critica' | 'Alta' | 'Media' | 'Baja'
  priorityIsOverride: boolean
}

export type ProjectView = {
  project: Project
  fields: ProjectFields
  tasks: Task[]
  flags: Flag[]
  score: ScoreBreakdown
  /** Discrepancias entre lo declarado por la fuente y lo recalculado contra hoy. */
  declaredMismatch: {
    healthVsFlags: boolean
    overdueTasksCount: { declared: number; real: number } | null
  }
}

export type PersonWorkload = {
  alias: string
  openTasks: number
  blockedTasks: number
  highOrCriticalOpen: number
  overdueTasksToday: number
  projects: string[]
  shareOfBacklog: number // 0-1
  inTeamSheet: boolean
}
