/**
 * Capa de presentación: convierte valores del dominio en el texto que ve el usuario.
 *
 * Regla que la sostiene: **los valores crudos nunca se tocan**. El dataset trae `Critica`,
 * `Diagnostico`, `En revision` sin tilde, y así viven en la base, en `lib/config.ts`, en la
 * validación de `lib/actions.ts` y en los tests. Acentuarlos en el origen rompería las tres
 * cosas. Se acentúan solo acá, al mostrarlos.
 *
 * Antes esto estaba disperso: `formatUsd` existía dos veces con textos distintos para el
 * mismo caso ("desconocido" vs "valor desconocido"), `formatDate` existía una sola vez sin
 * exportar (así que 3 de las 4 fechas visibles salían en ISO crudo), y el vocabulario se
 * traducía en las colas pero no en el detalle — el mismo proyecto se llamaba "Diagnósticos"
 * en una pantalla y "Diagnostico" en otra.
 */

const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/**
 * "2026-07-10" → "10 jul 2026". Se parsea a mano en vez de `new Date(iso)` a propósito:
 * `new Date('2026-07-10')` es medianoche UTC y `toLocaleDateString` la corre un día hacia
 * atrás en husos negativos — el mismo cuidado que ya toma `lib/clock`.
 */
export function formatDate(iso: string | null | undefined, fallback = 'sin fecha'): string {
  if (!iso) return fallback
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d || !MONTHS_ES[m - 1]) return iso
  return `${d} ${MONTHS_ES[m - 1]} ${y}`
}

/** Valor de negocio en USD. Desconocido nunca se muestra como 0. */
export function formatUsd(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'valor desconocido'
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

/**
 * Vocabulario del dataset → texto acentuado. Lo que no está mapeado pasa tal cual, así que
 * un valor nuevo en la fuente se muestra crudo en vez de romper o desaparecer.
 */
const DISPLAY_LABELS: Record<string, string> = {
  Critica: 'Crítica',
  Diagnostico: 'Diagnóstico',
  'En revision': 'En revisión',
}

export function displayLabel(raw: string): string {
  return DISPLAY_LABELS[raw] ?? raw
}
