import type { FlagKind } from '@/lib/engine/types'

/**
 * Tokens visuales compartidos entre componentes.
 *
 * Antes cada componente definía su propio mapa: `FLAG_META` en AlertStrip y `FLAG_BADGE` en
 * Queues eran dos `Record<FlagKind, …>` paralelos que había que mantener sincronizados a
 * mano, y los acentos de columna divergían (un mapa iba `500 → dark:400` y otro invertía la
 * escala). Centralizarlos hace que un cambio de color se aplique en todos lados a la vez.
 *
 * `AUTO_PRIORITY` vive acá por una razón distinta: es un valor que viaja del formulario a la
 * server action. Estaba duplicado en los dos formularios, así que cambiarlo en uno rompía el
 * otro en silencio.
 */

/** Sentinela para "prioridad derivada automáticamente" — un Select no admite value="". */
export const AUTO_PRIORITY = '__auto__'
export const AUTO_PRIORITY_LABEL = 'Derivada automáticamente'

export const FLAG_META: Record<
  FlagKind,
  {
    /** Plural, para cabecera de columna. */
    heading: string
    /** Singular, para badge en una tarjeta. */
    badge: string
    /** Frase para el estado vacío ("Sin proyectos …"). */
    singular: string
    ring: string
    dot: string
    indicator: string
    chip: string
  }
> = {
  bloqueado: {
    heading: 'Bloqueados',
    badge: 'Bloqueado',
    singular: 'bloqueado',
    ring: 'ring-red-200 dark:ring-red-900/50',
    dot: 'bg-red-600 dark:bg-red-500',
    indicator: 'bg-red-600/70 dark:bg-red-500/70',
    chip: 'bg-red-500/15 text-red-700 dark:text-red-400',
  },
  en_riesgo: {
    heading: 'En riesgo',
    badge: 'En riesgo',
    singular: 'en riesgo',
    ring: 'ring-amber-200 dark:ring-amber-900/50',
    dot: 'bg-amber-500 dark:bg-amber-400',
    indicator: 'bg-amber-500/70 dark:bg-amber-400/70',
    chip: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  },
  sin_siguiente_paso: {
    heading: 'Sin siguiente paso',
    badge: 'Sin siguiente paso',
    singular: 'sin siguiente paso',
    ring: 'ring-slate-300 dark:ring-slate-700',
    dot: 'bg-slate-500 dark:bg-slate-400',
    indicator: 'bg-slate-500/70 dark:bg-slate-400/70',
    chip: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
  },
}

export const FLAG_ORDER: FlagKind[] = ['bloqueado', 'en_riesgo', 'sin_siguiente_paso']

/** Chip gris neutro. Un solo valor: antes era `/60` en un componente y `/70` en otro. */
export const NEUTRAL_CHIP = 'bg-foreground/10 text-foreground/70'

/** Prioridad de tarea/proyecto. */
export const PRIORITY_CHIP: Record<string, string> = {
  Critica: 'bg-red-500/15 text-red-700 dark:text-red-400',
  Alta: 'bg-orange-500/15 text-orange-700 dark:text-orange-400',
  Media: 'bg-amber-500/15 text-amber-700 dark:text-amber-500',
  Baja: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
}

/** Estado del proyecto. "Activo" no está: es el estado esperado, mostrarlo sería ruido. */
export const PROJECT_STATUS_CHIP: Record<string, string> = {
  'En pausa': 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  Bloqueado: 'bg-red-500/15 text-red-700 dark:text-red-400',
  Cerrado: NEUTRAL_CHIP,
}

/** Acento superior de columna. Todos van `500 → dark:400`, sin invertir la escala. */
export const ENGAGEMENT_ACCENT: Record<string, string> = {
  Proyecto: 'border-t-sky-500 dark:border-t-sky-400',
  Diagnostico: 'border-t-violet-500 dark:border-t-violet-400',
  'Mantenimiento o recurrente': 'border-t-emerald-500 dark:border-t-emerald-400',
}

export const TASK_STATUS_ACCENT: Record<string, string> = {
  'Por hacer': 'border-t-slate-500 dark:border-t-slate-400',
  'En progreso': 'border-t-sky-500 dark:border-t-sky-400',
  'En revision': 'border-t-amber-500 dark:border-t-amber-400',
  Bloqueada: 'border-t-red-600 dark:border-t-red-500',
}

/** Títulos de cola: plural, distinto del singular de `displayLabel`. */
export const QUEUE_TITLES: Record<string, string> = {
  Proyecto: 'Proyectos',
  Diagnostico: 'Diagnósticos',
  'Mantenimiento o recurrente': 'Mantenimiento',
}
