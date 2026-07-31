import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'

/**
 * Tres clases de datos, en tablas distintas y a propósito:
 *
 *  - `projects` / `tasks` / `teamDeclared`: lo que dice la fuente. Se sobreescribe en cada
 *    importación. Los campos que la fuente calculó mal se conservan con prefijo `declared`
 *    para poder contrastarlos, nunca para decidir con ellos.
 *  - `projectFields`: lo que edita el humano. Vive aparte para que una reimportación no lo pise.
 *  - derivados (flags, severidad, score, carga por persona): no existen como tabla. Se calculan
 *    en lectura contra `lib/clock`. Persistirlos sería repetir el bug del dataset.
 */

export const projects = sqliteTable('projects', {
  code: text('code').primaryKey(),
  engagementType: text('engagement_type').notNull(),
  clientAlias: text('client_alias').notNull(),
  name: text('name').notNull(),
  projectTypeApi: text('project_type_api'),
  stage: text('stage'),
  ownerAlias: text('owner_alias'),
  ownerRole: text('owner_role'),

  // Declarado por la fuente — solo para contrastar, nunca para decidir.
  declaredStatus: text('declared_status'),
  declaredHealth: text('declared_health'),
  declaredOpenTasks: integer('declared_open_tasks'),
  declaredOverdueTasks: integer('declared_overdue_tasks'),

  startDate: text('start_date'), // ISO o null
  targetDate: text('target_date'), // ISO o null

  businessValue: real('business_value'),
  currency: text('currency'),
  businessValueUsd: real('business_value_usd'), // normalizado en la importación

  blockers: text('blockers'),
  summary: text('summary'),
  recentCompletedExamples: text('recent_completed_examples'),

  /** 1 = proyecto de ejemplo creado por el sistema, no viene del xlsx. */
  isExample: integer('is_example', { mode: 'boolean' }).notNull().default(false),
  sourceRow: integer('source_row'),
  importedAt: text('imported_at').notNull(),
})

/** Campos que el enunciado pide guardar y el dataset no trae. Sobreviven a la reimportación. */
export const projectFields = sqliteTable('project_fields', {
  code: text('code').primaryKey(),
  status: text('status').notNull().default('Activo'), // Activo | En pausa | Bloqueado | Cerrado
  priorityOverride: text('priority_override'), // Critica | Alta | Media | Baja | null = derivada
  nextStep: text('next_step'),
  notes: text('notes'),
  updatedAt: text('updated_at').notNull(),
})

export const tasks = sqliteTable('tasks', {
  code: text('code').primaryKey(),
  projectCode: text('project_code').notNull(),
  engagementType: text('engagement_type'),
  assigneeAlias: text('assignee_alias'),
  assigneeRole: text('assignee_role'),
  priority: text('priority').notNull(),
  status: text('status').notNull(),
  dueDate: text('due_date'), // ISO o null
  /** Declarado por la fuente. Inconsistente consigo mismo: no se usa para decidir. */
  declaredIsOverdue: integer('declared_is_overdue', { mode: 'boolean' }),
  /** La fuente referencia dependencias por título, no por código. Se resuelve al importar. */
  dependencyTitle: text('dependency_title'),
  dependencyCode: text('dependency_code'),
  title: text('title').notNull(),
  detail: text('detail'),
  lastProgress: text('last_progress'),
  sourceRow: integer('source_row'),
  importedAt: text('imported_at').notNull(),
})

/** La pestaña Team tal como viene. Solo para contrastar: omite a un miembro real. */
export const teamDeclared = sqliteTable('team_declared', {
  memberAlias: text('member_alias').primaryKey(),
  role: text('role'),
  projectsInPortfolio: integer('projects_in_portfolio'),
  openTasksAssigned: integer('open_tasks_assigned'),
  blockedTasksAssigned: integer('blocked_tasks_assigned'),
  highOrCriticalOpen: integer('high_or_critical_open'),
  diagnosticoProjects: integer('diagnostico_projects'),
  proyectoProjects: integer('proyecto_projects'),
  mantenimientoProjects: integer('mantenimiento_projects'),
  importedAt: text('imported_at').notNull(),
})

export const importRuns = sqliteTable('import_runs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sourceFile: text('source_file').notNull(),
  startedAt: text('started_at').notNull(),
  finishedAt: text('finished_at'),
  appToday: text('app_today').notNull(),
  fxCopPerUsd: real('fx_cop_per_usd').notNull(),
  projectsCount: integer('projects_count').notNull().default(0),
  tasksCount: integer('tasks_count').notNull().default(0),
  teamCount: integer('team_count').notNull().default(0),
  issuesCount: integer('issues_count').notNull().default(0),
})

/**
 * Cuarentena y bitácora de calidad de datos. Nada se corrige en silencio: cada normalización,
 * dato faltante o contradicción queda acá y se puede mostrar en la UI.
 */
export const importIssues = sqliteTable('import_issues', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  runId: integer('run_id').notNull(),
  sheet: text('sheet').notNull(),
  rowRef: text('row_ref'),
  entityCode: text('entity_code'),
  severity: text('severity').notNull(), // info | warn | error
  code: text('code').notNull(),
  message: text('message').notNull(),
  rawValue: text('raw_value'),
})

/** Bitácora append-only de ediciones humanas. El estado actual no cuenta la historia. */
export const changeLog = sqliteTable('change_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  entity: text('entity').notNull(), // project | task
  entityCode: text('entity_code').notNull(),
  field: text('field').notNull(),
  oldValue: text('old_value'),
  newValue: text('new_value'),
  at: text('at').notNull(),
  source: text('source').notNull().default('ui'), // ui | import | seed
})

export const schema = {
  projects,
  projectFields,
  tasks,
  teamDeclared,
  importRuns,
  importIssues,
  changeLog,
}

export type Project = typeof projects.$inferSelect
export type ProjectFields = typeof projectFields.$inferSelect
export type Task = typeof tasks.$inferSelect
export type ImportIssue = typeof importIssues.$inferSelect
export type ChangeLogEntry = typeof changeLog.$inferSelect
