'use client'

import { useId, useState } from 'react'
import type { ImportIssue } from '@/lib/db/schema'

export type DataQualityPanelProps = {
  issues: ImportIssue[]
  lastRun: { appToday: string; projectsCount: number; tasksCount: number; issuesCount: number } | null
}

const SEVERITY_META: Record<string, { label: string; dot: string }> = {
  error: { label: 'error', dot: 'bg-red-600 dark:bg-red-500' },
  warn: { label: 'advertencia', dot: 'bg-amber-500 dark:bg-amber-400' },
  info: { label: 'info', dot: 'bg-sky-500 dark:bg-sky-400' },
}

const SEVERITY_ORDER = ['error', 'warn', 'info']

/** Traducciones cortas para los codigos de hallazgo mas frecuentes; fallback al code crudo. */
const CODE_LABELS: Record<string, string> = {
  declared_overdue_mismatch: 'fechas mal declaradas',
  declared_overdue_count_mismatch: 'conteo de vencidas mal declarado',
  declared_open_count_mismatch: 'conteo de tareas abiertas mal declarado',
  target_date_missing: 'fechas limite faltantes',
  member_missing_in_team: 'miembro no listado en Team',
  possible_duplicate: 'posible duplicado',
  dependency_unresolved: 'dependencia sin resolver',
}

function codeLabel(code: string): string {
  return CODE_LABELS[code] ?? code.replace(/_/g, ' ')
}

/**
 * Estos códigos son la prueba de que la fuente contradice sus propios campos declarados
 * (DATASET-HALLAZGOS.md §2 y §6) — la evidencia que sostiene la tesis del sistema. El resto
 * es aseo de importación (fechas mal formadas, filas vacías, valores faltantes). Antes todo
 * se ordenaba por frecuencia nada más, así que "34 fechas mal declaradas" pesaba lo mismo
 * visualmente que "1 fila de prueba descartada" — se separan para que no compitan.
 */
const THESIS_CODES = new Set([
  'declared_overdue_mismatch',
  'declared_overdue_count_mismatch',
  'declared_open_count_mismatch',
  'member_missing_in_team',
  'possible_duplicate',
])

function summarize(issues: ImportIssue[]) {
  const bySeverity = new Map<string, number>()
  const byCode = new Map<string, number>()
  for (const issue of issues) {
    bySeverity.set(issue.severity, (bySeverity.get(issue.severity) ?? 0) + 1)
    byCode.set(issue.code, (byCode.get(issue.code) ?? 0) + 1)
  }
  const sorted = [...byCode.entries()].sort((a, b) => b[1] - a[1])
  return {
    bySeverity,
    thesisCodes: sorted.filter(([code]) => THESIS_CODES.has(code)),
    housekeepingCodes: sorted.filter(([code]) => !THESIS_CODES.has(code)),
  }
}

/**
 * Snapshot secundario de calidad de datos: colapsado por defecto para no competir
 * visualmente con AlertStrip. Un resumen de una linea + badges por severidad, con
 * detalle expandible — separado en "declarado vs. real" (evidencia de la tesis del
 * sistema) y "aseo de importación" (housekeeping), luego la lista completa para
 * quien quiera auditar.
 */
export function DataQualityPanel({ issues, lastRun }: DataQualityPanelProps) {
  const [open, setOpen] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const panelId = useId()

  const { bySeverity, thesisCodes, housekeepingCodes } = summarize(issues)
  const allCodesSorted = [...thesisCodes, ...housekeepingCodes]
  // El resumen colapsado destaca primero la evidencia de la tesis (declarado vs real),
  // no lo que sea más frecuente — "34 fechas mal declaradas" importa más que "1 fila de
  // prueba descartada" aunque hubiera menos de lo primero.
  const topCodes = (thesisCodes.length ? thesisCodes : housekeepingCodes).slice(0, 3)

  const summaryLine =
    issues.length === 0
      ? 'Sin hallazgos de calidad de datos.'
      : `${issues.length} hallazgos de calidad` +
        (topCodes.length
          ? `: ${topCodes.map(([code, n]) => `${n} ${codeLabel(code)}`).join(', ')}` +
            (allCodesSorted.length > topCodes.length ? '...' : '')
          : '')

  return (
    <section className="rounded-lg border border-black/10 bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.02]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left"
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-foreground/50">
            Calidad de datos
          </span>
          <span className="truncate text-xs text-foreground/70">{summaryLine}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {SEVERITY_ORDER.filter((s) => bySeverity.get(s)).map((s) => (
            <span
              key={s}
              className="flex items-center gap-1 rounded-full bg-black/5 px-2 py-0.5 text-[11px] text-foreground/70 dark:bg-white/10"
            >
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${SEVERITY_META[s].dot}`} aria-hidden />
              {bySeverity.get(s)}
            </span>
          ))}
          <span className="text-xs text-foreground/40">{open ? '−' : '+'}</span>
        </div>
      </button>

      {open && (
        <div id={panelId} className="border-t border-black/10 px-4 py-3 dark:border-white/10">
          {lastRun && (
            <p className="mb-3 text-xs text-foreground/50">
              Ultima importacion: {lastRun.projectsCount} proyectos, {lastRun.tasksCount} tareas, hoy
              del sistema {lastRun.appToday}.
            </p>
          )}

          {thesisCodes.length > 0 && (
            <div className="mb-3">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-400">
                Declarado vs. real
              </p>
              <ul className="flex flex-col gap-1.5">
                {thesisCodes.map(([code, count]) => (
                  <li key={code} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-foreground/70">{codeLabel(code)}</span>
                    <span className="shrink-0 tabular-nums text-foreground/50">{count}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {housekeepingCodes.length > 0 && (
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-foreground/40">
                Aseo de importación
              </p>
              <ul className="flex flex-col gap-1.5">
                {housekeepingCodes.map(([code, count]) => (
                  <li key={code} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-foreground/70">{codeLabel(code)}</span>
                    <span className="shrink-0 tabular-nums text-foreground/50">{count}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {issues.length > 0 && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className="text-xs font-medium text-foreground/60 underline decoration-dotted underline-offset-2 hover:text-foreground"
              >
                {showAll ? 'Ocultar detalle completo' : `Ver los ${issues.length} hallazgos`}
              </button>

              {showAll && (
                <div className="mt-2 max-h-72 overflow-y-auto rounded border border-black/10 dark:border-white/10">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-background text-foreground/50">
                      <tr>
                        <th className="px-2 py-1 font-medium">Severidad</th>
                        <th className="px-2 py-1 font-medium">Codigo</th>
                        <th className="px-2 py-1 font-medium">Entidad</th>
                        <th className="px-2 py-1 font-medium">Mensaje</th>
                      </tr>
                    </thead>
                    <tbody>
                      {issues.map((issue) => (
                        <tr key={issue.id} className="border-t border-black/5 dark:border-white/5">
                          <td className="whitespace-nowrap px-2 py-1 align-top">
                            <span className="flex items-center gap-1">
                              <span
                                className={`inline-block h-1.5 w-1.5 rounded-full ${
                                  SEVERITY_META[issue.severity]?.dot ?? 'bg-foreground/30'
                                }`}
                                aria-hidden
                              />
                              {SEVERITY_META[issue.severity]?.label ?? issue.severity}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-2 py-1 align-top text-foreground/70">
                            {codeLabel(issue.code)}
                          </td>
                          <td className="whitespace-nowrap px-2 py-1 align-top text-foreground/60">
                            {issue.entityCode ?? '-'}
                          </td>
                          <td className="px-2 py-1 align-top text-foreground/70">{issue.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
