import type { Project, ProjectFields, Task } from '@/lib/db/schema'
import { today } from '@/lib/clock'
import { computeFlags } from './flags'
import { computeScore } from './score'
import type { ProjectView } from './types'

/** Ensambla la vista completa de un proyecto: flags, score y discrepancias declarado vs hoy. */
export function buildProjectView(
  project: Project,
  fields: ProjectFields,
  tasks: Task[],
  now = today(),
): ProjectView {
  const flags = computeFlags(project, fields, tasks, now)
  const score = computeScore(project, fields, tasks, flags, now)

  const isHealthyDeclared = project.declaredHealth === 'Sano'
  const hasComputedFlags = flags.length > 0

  const realOverdue = tasks.filter((t) => t.dueDate && t.dueDate < now).length
  const overdueTasksCount =
    project.declaredOverdueTasks !== null && project.declaredOverdueTasks !== undefined
      ? { declared: project.declaredOverdueTasks, real: realOverdue }
      : null

  return {
    project,
    fields,
    tasks,
    flags,
    score,
    declaredMismatch: {
      healthVsFlags: isHealthyDeclared && hasComputedFlags,
      overdueTasksCount:
        overdueTasksCount && overdueTasksCount.declared !== overdueTasksCount.real
          ? overdueTasksCount
          : null,
    },
  }
}

export function groupByEngagementType(views: ProjectView[]): Map<string, ProjectView[]> {
  const groups = new Map<string, ProjectView[]>()
  for (const v of views) {
    const key = v.project.engagementType
    const list = groups.get(key) ?? []
    list.push(v)
    groups.set(key, list)
  }
  for (const list of groups.values()) {
    list.sort((a, b) => b.score.total - a.score.total)
  }
  return groups
}

export function topBySeverity(views: ProjectView[], kind: 'bloqueado' | 'en_riesgo' | 'sin_siguiente_paso', n = 3) {
  return views
    .map((v) => ({ view: v, flag: v.flags.find((f) => f.kind === kind) }))
    .filter((x): x is { view: ProjectView; flag: NonNullable<typeof x.flag> } => !!x.flag)
    .sort((a, b) => b.flag.severity - a.flag.severity)
    .slice(0, n)
}
