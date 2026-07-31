import type { Project, ProjectFields, Task } from '@/lib/db/schema'
import { daysOverdue, daysUntil, isOverdue, today } from '@/lib/clock'
import type { Flag, ScoreBreakdown } from './types'
import { PRIORITY_LABELS, type PriorityLabel } from '@/lib/config'

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n))

/**
 * Urgencia continua, no por escalones. Con escalones fijos los 13 proyectos vencidos
 * empatarían en 100 y el orden colapsaría sobre prioridad+flags (DATASET-HALLAZGOS.md: hay
 * 101 días de dispersión entre PRJ-21 y PRJ-12). Vencido crece con los días de atraso;
 * por vencer decae con la distancia; sin fecha es neutro y visible en la UI, no oculto.
 */
export function urgencyScore(targetDate: string | null, now = today()): number {
  if (!targetDate) return 35

  const overdue = daysOverdue(targetDate, now)
  if (overdue > 0) return clamp(70 + Math.min(30, overdue / 6))

  const until = daysUntil(targetDate, now) ?? 0
  if (until <= 7) return 60
  if (until <= 14) return 50
  if (until <= 30) return 40
  // Decae de 40 (a 30 días) a 20 (a 180 días o más), nunca por debajo.
  return clamp(40 - ((until - 30) / 150) * 20, 20, 40)
}

const PRIORITY_WEIGHT: Record<PriorityLabel, number> = {
  Critica: 40,
  Alta: 20,
  Media: 8,
  Baja: 3,
}

const PRIORITY_BASE: Record<PriorityLabel, number> = {
  Critica: 100,
  Alta: 75,
  Media: 50,
  Baja: 25,
}

/**
 * Prioridad de proyecto no existe en el dataset (§3 en PLAN.md): se deriva del conteo
 * ponderado de tareas abiertas por prioridad, capado a 100. Tomar solo la máxima no
 * discrimina — daría 13 proyectos en "Critica" y 8 en "Alta" sin más matiz; el conteo sí
 * separa un proyecto con 1 crítica de uno con 1 crítica + 2 altas.
 */
export function derivedPriority(tasks: Task[]): { label: PriorityLabel; score: number } {
  const counts: Record<PriorityLabel, number> = { Critica: 0, Alta: 0, Media: 0, Baja: 0 }
  for (const t of tasks) {
    const p = t.priority as PriorityLabel
    if (p in counts) counts[p]++
  }
  const score = clamp(
    PRIORITY_WEIGHT.Critica * counts.Critica +
      PRIORITY_WEIGHT.Alta * counts.Alta +
      PRIORITY_WEIGHT.Media * counts.Media +
      PRIORITY_WEIGHT.Baja * counts.Baja,
  )
  const label = counts.Critica > 0 ? 'Critica' : counts.Alta > 0 ? 'Alta' : counts.Media > 0 ? 'Media' : 'Baja'
  return { label, score }
}

export function priorityScore(
  tasks: Task[],
  override: string | null,
  targetIsOverdue = false,
): { score: number; label: PriorityLabel; isOverride: boolean } {
  if (override && (PRIORITY_LABELS as readonly string[]).includes(override)) {
    const label = override as PriorityLabel
    return { score: PRIORITY_BASE[label], label, isOverride: true }
  }

  if (tasks.length === 0) {
    // Sin tareas no hay de dónde derivar prioridad — `derivedPriority` caería a 0/"Baja"
    // por defecto, y eso confunde "sin actividad todavía" con "sin actividad y ya venció".
    // PRJ-21 es el caso real: 171 días vencido, 0 tareas, y con el fallback viejo su
    // prioridad derivada era 0 — la urgencia casi máxima (98.5) quedaba diluida por una
    // prioridad falsamente mínima y el proyecto desaparecía de la mitad superior de la cola.
    // Un proyecto vencido sin backlog no es de baja prioridad: es uno que nadie replanificó,
    // y eso exige triage, no que se lo ignore. Uno sano sin tareas (recién creado, fecha
    // futura) sí es neutro: no hay señal para reclamar urgencia todavía.
    const label: PriorityLabel = targetIsOverdue ? 'Alta' : 'Media'
    return { score: PRIORITY_BASE[label], label, isOverride: false }
  }

  const derived = derivedPriority(tasks)
  return { score: derived.score, label: derived.label, isOverride: false }
}

/** bloqueado +60, sin siguiente paso +40, cap 100. Un proyecto puede tener ambos. */
export function flagsScore(flags: Flag[]): number {
  let s = 0
  if (flags.some((f) => f.kind === 'bloqueado')) s += 60
  if (flags.some((f) => f.kind === 'sin_siguiente_paso')) s += 40
  return clamp(s)
}

export function computeScore(
  project: Project,
  fields: ProjectFields,
  tasks: Task[],
  flags: Flag[],
  now = today(),
): ScoreBreakdown {
  const urgencia = urgencyScore(project.targetDate, now)
  const targetIsOverdue = project.targetDate ? isOverdue(project.targetDate, now) : false
  const prio = priorityScore(tasks, fields.priorityOverride, targetIsOverdue)
  const flagsPart = flagsScore(flags)
  const total = clamp(0.5 * urgencia + 0.3 * prio.score + 0.2 * flagsPart)

  return {
    urgencia,
    prioridad: prio.score,
    flags: flagsPart,
    total,
    priorityLabel: prio.label,
    priorityIsOverride: prio.isOverride,
  }
}

/**
 * Desempate por valor de negocio en USD, descendente. Desconocido (null) va último —
 * nunca se trata como cero, que lo pondría antes que un proyecto de bajo valor real.
 */
export function compareForRanking(
  a: { score: ScoreBreakdown; project: Project },
  b: { score: ScoreBreakdown; project: Project },
): number {
  if (b.score.total !== a.score.total) return b.score.total - a.score.total
  const av = a.project.businessValueUsd
  const bv = b.project.businessValueUsd
  if (av === null && bv === null) return 0
  if (av === null) return 1
  if (bv === null) return -1
  return bv - av
}
