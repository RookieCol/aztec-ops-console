/**
 * Reloj único e inyectable del sistema.
 *
 * Todo cálculo derivado (vencimientos, riesgo, score) pasa por acá — la razón es la tesis
 * del sistema hecha código: el dataset trae `is_overdue` precalculado y contradictorio (ocho
 * tareas vencen el mismo día y cuatro dicen "Si" mientras cuatro dicen "No", según la rama
 * del generador). Nada derivado se persiste: se recalcula contra este reloj en
 * cada lectura, nunca contra una referencia congelada.
 *
 * Por defecto usa la fecha real de hoy — es justamente lo que el sistema le exige al
 * dataset (no confiar en un "hoy" viejo) y sería inconsistente pedírselo a los datos y no
 * a la propia app. `APP_TODAY=YYYY-MM-DD` congela una fecha puntual solo cuando hace falta
 * reproducibilidad explícita (por ejemplo, al grabar una demo). Los tests no dependen de
 * este default: cada uno pasa su propio `now` a las funciones directamente.
 */

/**
 * Fecha de calendario **local**, no UTC. `toDay()` sí usa UTC — ahí es correcto, porque
 * compara dos fechas ISO y así el resultado no depende del huso. Pero "hoy" es distinto:
 * es el día en el que está parado quien mira la consola. Con getUTC* la app se quedaba un
 * día atrás durante las horas en que el huso local ya pasó de medianoche y UTC no (en
 * +02:00, entre las 00:00 y las 02:00 mostraba la fecha de ayer y contaba un día menos de
 * atraso en cada tarea vencida).
 */
function realToday(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function today(): string {
  const raw = process.env.APP_TODAY?.trim()
  if (!raw) return realToday()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new Error(`APP_TODAY debe ser YYYY-MM-DD, llegó: ${raw}`)
  }
  return raw
}

/** Fecha ISO (YYYY-MM-DD) → epoch day en UTC. Evita zonas horarias por completo. */
export function toDay(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000)
}

/** Días de `from` a `to`. Positivo si `to` es posterior. */
export function daysBetween(from: string, to: string): number {
  return toDay(to) - toDay(from)
}

/** Días de atraso contra hoy. Positivo = vencido. 0 si no hay fecha. */
export function daysOverdue(due: string | null, now = today()): number {
  if (!due) return 0
  return Math.max(0, daysBetween(due, now))
}

/** Días que faltan para la fecha. Negativo = ya venció. null si no hay fecha. */
export function daysUntil(due: string | null, now = today()): number | null {
  if (!due) return null
  return daysBetween(now, due)
}

export function isOverdue(due: string | null, now = today()): boolean {
  return due !== null && toDay(due) < toDay(now)
}
