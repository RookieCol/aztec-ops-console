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
  priorityLabel: 'Critica' | 'Alta' | 'Media' | 'Baja'
  /**
   * De dónde salió esa prioridad. Son tres casos, no dos: un booleano `isOverride` hacía que el
   * caso `empty-backlog` se mostrara como "derivada de tareas" en un proyecto sin ninguna tarea
   * — la UI contradecía al dato en el ejemplo más visible del sistema (PRJ-21).
   */
  prioritySource: 'override' | 'tasks' | 'empty-backlog'
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
