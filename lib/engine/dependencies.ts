import type { Task } from '@/lib/db/schema'

/**
 * Detección de ciclos en el grafo de dependencias de un proyecto.
 *
 * Las dependencias se resolvieron por título al importar (`dependencyCode`, ver
 * scripts/import.ts). PRJ-04 tiene un ciclo real de 2 nodos (T02 <-> T03): ninguna de las
 * dos puede empezar y ningún campo del dataset lo dice (DATASET-HALLAZGOS.md §4). Se detecta
 * con DFS simple porque el grafo por proyecto es minúsculo (4 tareas).
 */
export function findDependencyCycles(tasks: Task[]): string[][] {
  const byCode = new Map(tasks.map((t) => [t.code, t]))
  const cycles: string[][] = []
  const seenCycleKeys = new Set<string>()

  const WHITE = 0,
    GRAY = 1,
    BLACK = 2
  const color = new Map<string, number>()
  for (const t of tasks) color.set(t.code, WHITE)

  function visit(code: string, stack: string[]) {
    color.set(code, GRAY)
    stack.push(code)

    const next = byCode.get(code)?.dependencyCode
    if (next && byCode.has(next)) {
      const c = color.get(next)
      if (c === GRAY) {
        const start = stack.indexOf(next)
        const cycle = stack.slice(start)
        const key = [...cycle].sort().join('|')
        if (!seenCycleKeys.has(key)) {
          seenCycleKeys.add(key)
          cycles.push(cycle)
        }
      } else if (c === WHITE) {
        visit(next, stack)
      }
    }

    stack.pop()
    color.set(code, BLACK)
  }

  for (const t of tasks) {
    if (color.get(t.code) === WHITE) visit(t.code, [])
  }

  return cycles
}

/** Códigos de tarea que participan en algún ciclo — para marcarlas en el tablero Kanban. */
export function cycleTaskCodes(tasks: Task[]): Set<string> {
  return new Set(findDependencyCycles(tasks).flat())
}
