import type { Task } from '@/lib/db/schema'
import { isOverdue, today } from '@/lib/clock'
import type { PersonWorkload } from './types'

/**
 * Carga por persona, calculada desde Tasks — no desde la pestaña Team.
 *
 * No es que Team esté desactualizada: sus conteos coinciden exactos con este recálculo. El
 * defecto es que omite a Andrea Molina (4 tareas, responsable de PRJ-19); Team suma 78
 * tareas y hay 82. Se recalcula por completitud.
 */
export function computeWorkload(tasks: Task[], teamAliases: Set<string>, now = today()): PersonWorkload[] {
  const byAlias = new Map<string, Task[]>()
  for (const t of tasks) {
    if (!t.assigneeAlias) continue
    const list = byAlias.get(t.assigneeAlias) ?? []
    list.push(t)
    byAlias.set(t.assigneeAlias, list)
  }

  const total = tasks.length || 1

  const rows: PersonWorkload[] = []
  for (const [alias, mine] of byAlias) {
    rows.push({
      alias,
      openTasks: mine.length,
      blockedTasks: mine.filter((t) => t.status === 'Bloqueada').length,
      highOrCriticalOpen: mine.filter((t) => t.priority === 'Critica' || t.priority === 'Alta').length,
      overdueTasksToday: mine.filter((t) => t.dueDate && isOverdue(t.dueDate, now)).length,
      projects: [...new Set(mine.map((t) => t.projectCode))],
      shareOfBacklog: mine.length / total,
      inTeamSheet: teamAliases.has(alias),
    })
  }

  return rows.sort((a, b) => b.openTasks - a.openTasks)
}
