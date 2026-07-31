'use client'

import { useId, useState } from 'react'
import type { ImportIssue } from '@/lib/db/schema'
import { formatDate } from '@/lib/format'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'

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

/**
 * El código interno (`declared_overdue_mismatch`) no le dice nada a quien mira la consola.
 * Cada etiqueta describe el hallazgo en los términos del negocio; lo que no esté acá cae al
 * código con guiones bajos convertidos en espacios, para que un código nuevo se vea legible
 * en vez de romper.
 */
const CODE_LABELS: Record<string, { one: string; many: string }> = {
  declared_overdue_mismatch: {
    one: 'tarea cuyo estado de vencimiento no coincide con su fecha',
    many: 'tareas cuyo estado de vencimiento no coincide con su fecha',
  },
  declared_overdue_count_mismatch: {
    one: 'proyecto que declara mal cuántas tareas tiene vencidas',
    many: 'proyectos que declaran mal cuántas tareas tienen vencidas',
  },
  declared_open_count_mismatch: {
    one: 'proyecto que declara mal cuántas tareas tiene abiertas',
    many: 'proyectos que declaran mal cuántas tareas tienen abiertas',
  },
  target_date_missing: { one: 'proyecto sin fecha límite', many: 'proyectos sin fecha límite' },
  member_missing_in_team: {
    one: 'persona con tareas que no figura en la hoja Team',
    many: 'personas con tareas que no figuran en la hoja Team',
  },
  possible_duplicate: {
    one: 'proyecto que parece duplicado',
    many: 'proyectos que parecen duplicados',
  },
  dependency_unresolved: {
    one: 'dependencia que apunta a una tarea inexistente',
    many: 'dependencias que apuntan a una tarea inexistente',
  },
  zero_length_window: {
    one: 'proyecto que vence el día que arranca',
    many: 'proyectos que vencen el día que arrancan',
  },
  value_converted: {
    one: 'valor convertido de pesos a dólares',
    many: 'valores convertidos de pesos a dólares',
  },
  value_missing: {
    one: 'proyecto sin valor de negocio',
    many: 'proyectos sin valor de negocio',
  },
  date_format_mixed: {
    one: 'fecha con formato distinto al del resto de la columna',
    many: 'fechas con formato distinto al del resto de la columna',
  },
  junk_rows_skipped: { one: 'fila de prueba descartada', many: 'filas de prueba descartadas' },
  absent_in_source: {
    one: 'proyecto que ya no viene en la fuente',
    many: 'proyectos que ya no vienen en la fuente',
  },
  orphan_task: {
    one: 'tarea que apunta a un proyecto inexistente',
    many: 'tareas que apuntan a un proyecto inexistente',
  },
}

/** Las etiquetas son frases con sujeto, así que necesitan concordar en número: sin esto el
 *  resumen decía "1 proyectos que parecen duplicados". */
function codeLabel(code: string, count = 2): string {
  const entry = CODE_LABELS[code]
  if (!entry) return code.replace(/_/g, ' ')
  return count === 1 ? entry.one : entry.many
}

/**
 * Estos códigos son la prueba de que la fuente contradice sus propios campos declarados
 * (`is_overdue` que se desmiente a sí mismo, conteos que no cuadran, un miembro del equipo
 * que la pestaña Team omite) — la evidencia que sostiene la tesis del sistema. El resto
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
          ? `: ${topCodes.map(([code, n]) => `${n} ${codeLabel(code, n)}`).join(', ')}` +
            (allCodesSorted.length > topCodes.length ? '...' : '')
          : '')

  return (
    <Card className="gap-0 bg-muted/30 p-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left"
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Calidad de datos
          </span>
          <span className="truncate text-xs text-muted-foreground/90">{summaryLine}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {SEVERITY_ORDER.filter((s) => bySeverity.get(s)).map((s) => (
            <Badge key={s} variant="secondary" className="gap-1">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${SEVERITY_META[s].dot}`} aria-hidden />
              {bySeverity.get(s)}
              {/* El punto de color era el único portador del nivel: sin esto un lector de
                  pantalla anunciaba "34, 7, 2" sin saber cuál es error y cuál info. */}
              <span className="sr-only"> de nivel {SEVERITY_META[s].label}</span>
            </Badge>
          ))}
          <span className="text-xs text-muted-foreground/60" aria-hidden>
            {open ? '−' : '+'}
          </span>
        </div>
      </button>

      {open && (
        <div id={panelId} className="border-t px-4 py-3">
          {lastRun && (
            <p className="mb-3 text-xs text-muted-foreground">
              Última importación: {lastRun.projectsCount} proyectos, {lastRun.tasksCount} tareas, hoy
              del sistema {formatDate(lastRun.appToday)}.
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
                    <span className="truncate text-muted-foreground">{codeLabel(code, count)}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground/70">{count}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {housekeepingCodes.length > 0 && (
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                Aseo de importación
              </p>
              <ul className="flex flex-col gap-1.5">
                {housekeepingCodes.map(([code, count]) => (
                  <li key={code} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-muted-foreground">{codeLabel(code, count)}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground/70">{count}</span>
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
                className="text-xs font-medium text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground"
              >
                {showAll ? 'Ocultar detalle completo' : `Ver los ${issues.length} hallazgos`}
              </button>

              {showAll && (
                <Card className="mt-2 gap-0 p-0">
                  <ScrollArea className="max-h-72">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Severidad</TableHead>
                          <TableHead>Código</TableHead>
                          <TableHead>Entidad</TableHead>
                          <TableHead>Mensaje</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {issues.map((issue) => (
                          <TableRow key={issue.id}>
                            <TableCell className="whitespace-nowrap align-top">
                              <span className="flex items-center gap-1">
                                <span
                                  className={`inline-block h-1.5 w-1.5 rounded-full ${
                                    SEVERITY_META[issue.severity]?.dot ?? 'bg-foreground/30'
                                  }`}
                                  aria-hidden
                                />
                                {SEVERITY_META[issue.severity]?.label ?? issue.severity}
                              </span>
                            </TableCell>
                            <TableCell className="whitespace-nowrap align-top text-muted-foreground">
                              {codeLabel(issue.code, 1)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap align-top text-muted-foreground">
                              {issue.entityCode ?? '-'}
                            </TableCell>
                            <TableCell className="align-top text-muted-foreground">
                              {issue.message}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </Card>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
