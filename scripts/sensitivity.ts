/**
 * Análisis de sensibilidad del criterio de priorización.
 *
 * El score pondera 0.5 urgencia / 0.3 prioridad / 0.2 flags, y esos números son una decisión
 * de diseño. Este script existe para no tener que defenderlos como intuición: recalcula el
 * ranking completo bajo esquemas de pesos deliberadamente distintos —incluido uno plano y uno
 * de urgencia pura— y mide cuánto se mueve el resultado.
 *
 *   pnpm tsx scripts/sensitivity.ts
 *
 * Si el orden resiste, la conclusión útil es que la señal vive en los insumos recalculados
 * (fechas contra hoy, conteo de tareas, flags derivados) y no en los coeficientes. Si algún
 * día deja de resistir, este script lo va a mostrar antes que un usuario.
 */

import { db } from '@/lib/db'
import { projects, projectFields, tasks } from '@/lib/db/schema'
import { computeFlags } from '@/lib/engine/flags'
import { urgencyScore, priorityScore, flagsScore } from '@/lib/engine/score'
import { isOverdue, today } from '@/lib/clock'

const now = today()

const allProjects = db.select().from(projects).all()
const allFields = db.select().from(projectFields).all()
const allTasks = db.select().from(tasks).all()
const fieldsByCode = new Map(allFields.map((f) => [f.code, f]))

/** Los tres términos se calculan una sola vez: lo único que varía entre esquemas son los pesos. */
const terms = allProjects.map((p) => {
  const fields = fieldsByCode.get(p.code)
  if (!fields) throw new Error(`Proyecto sin project_fields: ${p.code}. Corré pnpm db:reset.`)
  const projectTasks = allTasks.filter((t) => t.projectCode === p.code)
  const targetIsOverdue = p.targetDate ? isOverdue(p.targetDate, now) : false
  return {
    code: p.code,
    urgencia: urgencyScore(p.targetDate, now),
    prioridad: priorityScore(projectTasks, fields.priorityOverride, targetIsOverdue).score,
    flags: flagsScore(computeFlags(p, fields, projectTasks, now)),
  }
})

type Scheme = { label: string; u: number; p: number; f: number }

const SCHEMES: Scheme[] = [
  { label: 'base (el del sistema)', u: 0.5, p: 0.3, f: 0.2 },
  { label: 'urgencia dominante', u: 0.7, p: 0.2, f: 0.1 },
  { label: 'prioridad dominante', u: 0.3, p: 0.5, f: 0.2 },
  { label: 'flags dominantes', u: 0.3, p: 0.2, f: 0.5 },
  { label: 'plano (sin criterio)', u: 0.34, p: 0.33, f: 0.33 },
  { label: 'solo urgencia', u: 1, p: 0, f: 0 },
]

const rankBy = ({ u, p, f }: Scheme): string[] =>
  [...terms]
    .sort((a, b) => u * b.urgencia + p * b.prioridad + f * b.flags - (u * a.urgencia + p * a.prioridad + f * a.flags))
    .map((t) => t.code)

const base = rankBy(SCHEMES[0])
const baseTop10 = new Set(base.slice(0, 10))
const half = Math.floor(terms.length / 2)
const baseTopHalf = base.slice(0, half)

console.log(`Sensibilidad del ranking — ${terms.length} proyectos, hoy = ${now}`)
console.log(`Mitad superior = los primeros ${half}.\n`)

for (const scheme of SCHEMES) {
  const ranked = rankBy(scheme)
  const position = new Map(ranked.map((code, i) => [code, i]))
  const overlap = ranked.slice(0, 10).filter((c) => baseTop10.has(c)).length
  // Cruzar la mitad es el cambio que de verdad importa: significa que un proyecto que el
  // sistema pedía atender hoy pasaría a poder esperar. Reordenarse dentro de la mitad no.
  const crossed = baseTopHalf.filter((c) => (position.get(c) ?? 0) >= half).length

  console.log(
    `${scheme.label.padEnd(22)} ${scheme.u}/${scheme.p}/${scheme.f}` +
      `  top10∩base ${overlap}/10  cruzan la mitad ${crossed}` +
      `\n${' '.repeat(22)} top 5: ${ranked.slice(0, 5).join(', ')}`,
  )
}

console.log(
  '\nLectura: si el top 10 y la mitad superior se mantienen aun con pesos planos, el orden lo\n' +
    'está fijando la evidencia recalculada, no la ponderación elegida.',
)
