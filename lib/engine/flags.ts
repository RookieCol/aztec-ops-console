import type { Project, ProjectFields, Task } from '@/lib/db/schema'
import { daysOverdue, isOverdue, today } from '@/lib/clock'
import type { Flag } from './types'
import { findDependencyCycles } from './dependencies'
import { urgencyScore } from './score'

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n))

/**
 * Los 3 estados que pide el enunciado, cada uno con severidad graduada — no binaria.
 *
 * Por qué graduar: el dataset son dos cohortes pegadas (DATASET-HALLAZGOS.md §1). 17 de 22
 * proyectos comparten la misma crisis idéntica (1 tarea bloqueada, mismo texto de blockers).
 * Un flag sí/no deja 17 proyectos empatados; la severidad es lo único que los vuelve a
 * distinguir para decidir cuál atender primero dentro del mismo flag.
 *
 * `blockers` (texto libre de la fuente) NO es señal: marca exactamente los mismos 17
 * proyectos que "tiene tarea Bloqueada", con 4 valores de plantilla para 22 filas.
 */
export function computeFlags(project: Project, fields: ProjectFields, tasks: Task[], now = today()): Flag[] {
  // Un proyecto Cerrado ya no está en operación: no tiene sentido alertar sobre una fecha
  // vencida ni un siguiente paso que ya no aplica. Sin este corte, DEMO-02 (creado
  // justamente para probar "cerrado con fecha vencida no debe alarmar") dispararía
  // sin_siguiente_paso por tener 0 tareas — el propio ejemplo delataba el hueco.
  if (fields.status === 'Cerrado') return []

  const flags: Flag[] = []

  // ---------------------------------------------------------------- Bloqueado
  const blocked = tasks.filter((t) => t.status === 'Bloqueada')
  const cycles = findDependencyCycles(tasks)
  if (blocked.length > 0 || cycles.length > 0) {
    const oldestDue = blocked
      .map((t) => t.dueDate)
      .filter((d): d is string => !!d)
      .sort()[0]
    const staleDays = oldestDue ? daysOverdue(oldestDue, now) : 0
    const reasons: string[] = []
    if (blocked.length > 0) {
      reasons.push(
        `${blocked.length} tarea${blocked.length > 1 ? 's' : ''} bloqueada${blocked.length > 1 ? 's' : ''}` +
          (oldestDue ? ` (la más antigua vencía ${oldestDue})` : ''),
      )
    }
    if (cycles.length > 0) {
      reasons.push(
        `ciclo de dependencias: ${cycles.map((c) => c.join(' → ') + ` → ${c[0]}`).join('; ')}`,
      )
    }
    const severity = cycles.length > 0 ? 100 : clamp(40 + blocked.length * 15 + staleDays * 0.5)
    flags.push({ kind: 'bloqueado', severity, reasons })
  }

  // ---------------------------------------------------------------- En riesgo
  const targetOverdueDays = project.targetDate ? daysOverdue(project.targetDate, now) : 0
  const targetIsOverdue = project.targetDate ? isOverdue(project.targetDate, now) : false
  const hiOverdue = tasks.filter(
    (t) => (t.priority === 'Critica' || t.priority === 'Alta') && t.dueDate && isOverdue(t.dueDate, now),
  )
  const outOfPlan = project.targetDate
    ? tasks.filter((t) => t.dueDate && t.dueDate > project.targetDate!)
    : []

  if (targetIsOverdue || hiOverdue.length > 0 || outOfPlan.length > 0) {
    const reasons: string[] = []
    if (targetIsOverdue) reasons.push(`fecha límite vencida hace ${targetOverdueDays} días`)
    if (hiOverdue.length > 0) reasons.push(`${hiOverdue.length} tarea(s) Alta/Crítica vencidas`)
    if (outOfPlan.length > 0) {
      reasons.push(
        `${outOfPlan.length} de ${tasks.length} tareas vencen después de la fecha límite del proyecto`,
      )
    }
    // Reutiliza urgencyScore (score.ts) como base en vez de tener una segunda curva de
    // "qué tan vencido está esto" calculada aparte. Antes había dos fórmulas independientes
    // — la de acá (por tramos de días fijos a este dataset) y la de score.ts (continua) —
    // que podían rankear el mismo par de proyectos en órdenes distintos: el top-3 de esta
    // alerta y el top-3 de la cola por score.total llegaron a compartir solo 1 de 3
    // proyectos. Con una sola fuente para el componente de fecha (y un solo peso de bonus,
    // sin la asimetría *8 vs *0.4 que quedó de la versión anterior), ambas vistas coinciden
    // en "qué tan vencido está" y solo pueden diferir por unos pocos puntos de bonus.
    const dayComponent = urgencyScore(project.targetDate, now)
    const bonus = hiOverdue.length * 0.4 + outOfPlan.length * 0.2
    const severity = clamp(dayComponent + bonus)
    flags.push({ kind: 'en_riesgo', severity, reasons })
  }

  // ------------------------------------------------------- Sin siguiente paso
  const hasInProgress = tasks.some((t) => t.status === 'En progreso')
  const hasNextStep = !!fields.nextStep?.trim()
  if (!hasNextStep && !hasInProgress) {
    flags.push({
      kind: 'sin_siguiente_paso',
      severity: 100,
      reasons: [
        tasks.length === 0
          ? 'sin next_step y sin tareas abiertas'
          : 'sin next_step y ninguna tarea En progreso',
      ],
    })
  }

  return flags
}

export function flagOf(flags: Flag[], kind: Flag['kind']): Flag | undefined {
  return flags.find((f) => f.kind === kind)
}
