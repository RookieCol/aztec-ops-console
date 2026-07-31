import path from 'node:path'

/**
 * Tasa fija y documentada. Solo dos proyectos del dataset vienen en COP (PRJ-18: 85.000.000,
 * PRJ-20: 120.000.000). No se consulta ninguna API: una tasa variable haría que el ranking
 * cambie entre corridas sin que nada del portafolio haya cambiado.
 */
export const COP_PER_USD = 4000

export const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), 'data', 'aztec.db')

export const SOURCE_XLSX =
  process.env.SOURCE_XLSX ??
  path.join(process.cwd(), 'Dataset — Reto Desarrollador de Soluciones con IA _ Aztec.xlsx')

export const SHEETS = {
  projects: 'Projects',
  tasks: 'Tasks',
  team: 'Team',
  notes: 'Notas',
} as const

/** Vocabulario de estado del sistema. El dataset trae "Activo" en 22 de 22 filas. */
export const PROJECT_STATUSES = ['Activo', 'En pausa', 'Bloqueado', 'Cerrado'] as const
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

export const PRIORITY_LABELS = ['Critica', 'Alta', 'Media', 'Baja'] as const
export type PriorityLabel = (typeof PRIORITY_LABELS)[number]

/** Estados de tarea tal como los trae la fuente. No hay ninguna tarea completada. */
export const TASK_STATUSES = ['Por hacer', 'En progreso', 'En revision', 'Bloqueada'] as const

export const ENGAGEMENT_TYPES = [
  'Proyecto',
  'Diagnostico',
  'Mantenimiento o recurrente',
] as const
export type EngagementType = (typeof ENGAGEMENT_TYPES)[number]
