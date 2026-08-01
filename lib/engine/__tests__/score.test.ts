import { describe, it, expect } from 'vitest'
import { urgencyScore, priorityScore, flagsScore, compareForRanking } from '@/lib/engine/score'
import type { ScoreBreakdown } from '@/lib/engine/types'
import { makeProject, makeTask } from './fixtures'

const NOW = '2026-07-31'

describe('urgencyScore', () => {
  it('no satura: más días de atraso siempre puntúa más alto, sin techo compartido', () => {
    // PRJ-12 (70d), PRJ-03 (151d), PRJ-21 (171d) — deben quedar en ese orden estricto.
    const s12 = urgencyScore('2026-05-22', NOW)
    const s03 = urgencyScore('2026-03-02', NOW)
    const s21 = urgencyScore('2026-02-10', NOW)
    expect(s12).toBeLessThan(s03)
    expect(s03).toBeLessThan(s21)
  })

  it('sin fecha es neutro, ni el más urgente ni el menos', () => {
    const none = urgencyScore(null, NOW)
    const overdue = urgencyScore('2026-07-01', NOW)
    const farFuture = urgencyScore('2027-01-01', NOW)
    expect(none).toBeGreaterThan(farFuture)
    expect(none).toBeLessThan(overdue)
  })

  it('a más cerca la fecha futura, mayor la urgencia', () => {
    const in5 = urgencyScore('2026-08-05', NOW)
    const in20 = urgencyScore('2026-08-20', NOW)
    const in60 = urgencyScore('2026-09-29', NOW)
    expect(in5).toBeGreaterThan(in20)
    expect(in20).toBeGreaterThan(in60)
  })
})

describe('priorityScore', () => {
  it('el conteo pondera distinto a solo tomar la máxima', () => {
    const oneCritica = priorityScore([makeTask({ priority: 'Critica' })], null)
    const criticaMasAltas = priorityScore(
      [makeTask({ priority: 'Critica' }), makeTask({ priority: 'Alta' }), makeTask({ priority: 'Alta' })],
      null,
    )
    expect(criticaMasAltas.score).toBeGreaterThan(oneCritica.score)
    expect(oneCritica.label).toBe('Critica')
    expect(criticaMasAltas.label).toBe('Critica')
  })

  it('el override manual gana sobre la prioridad derivada', () => {
    const derived = priorityScore([makeTask({ priority: 'Baja' })], null)
    const overridden = priorityScore([makeTask({ priority: 'Baja' })], 'Critica')
    expect(overridden.label).toBe('Critica')
    expect(overridden.source).toBe('override')
    expect(overridden.score).toBeGreaterThan(derived.score)
  })

  it('capa en 100 aunque haya muchas tareas críticas', () => {
    const many = priorityScore(Array.from({ length: 5 }, () => makeTask({ priority: 'Critica' })), null)
    expect(many.score).toBe(100)
  })

  it('sin tareas y con target vencida no cae a Baja/0 (caso PRJ-21)', () => {
    // Antes: 0 tareas -> derivedPriority caía a Baja/0, y la urgencia casi máxima de un
    // proyecto vencido con backlog vacío quedaba diluida hasta desaparecer de la mitad
    // superior de la cola. Vencido + sin backlog es una señal de alerta, no de baja prioridad.
    const abandoned = priorityScore([], null, true)
    expect(abandoned.label).not.toBe('Baja')
    expect(abandoned.score).toBeGreaterThan(0)
  })

  it('sin tareas y sin target vencida (proyecto nuevo) es neutro, no Baja ni Alta', () => {
    const fresh = priorityScore([], null, false)
    expect(fresh.label).toBe('Media')
  })

  it('el override sigue ganando aunque no haya tareas', () => {
    const overridden = priorityScore([], 'Baja', true)
    expect(overridden.label).toBe('Baja')
    expect(overridden.source).toBe('override')
  })
})

describe('flagsScore', () => {
  it('bloqueado y sin_siguiente_paso combinados capan en 100, no en 100+', () => {
    const s = flagsScore([
      { kind: 'bloqueado', severity: 90, reasons: [] },
      { kind: 'sin_siguiente_paso', severity: 100, reasons: [] },
    ])
    expect(s).toBe(100)
  })

  it('sin flags es 0', () => {
    expect(flagsScore([])).toBe(0)
  })
})

describe('compareForRanking (desempate por valor de negocio)', () => {
  it('a igual score, gana el de mayor valor conocido', () => {
    const a = { score: { total: 80 } as ScoreBreakdown, project: makeProject({ code: 'A', businessValueUsd: 5000 }) }
    const b = { score: { total: 80 } as ScoreBreakdown, project: makeProject({ code: 'B', businessValueUsd: 20000 }) }
    expect(compareForRanking(a, b)).toBeGreaterThan(0) // b antes que a
  })

  it('valor desconocido (PRJ-07-like) va después de valores conocidos, nunca antes', () => {
    const known = { score: { total: 80 } as ScoreBreakdown, project: makeProject({ code: 'K', businessValueUsd: 1 }) }
    const unknown = { score: { total: 80 } as ScoreBreakdown, project: makeProject({ code: 'U', businessValueUsd: null }) }
    expect(compareForRanking(known, unknown)).toBeLessThan(0) // known antes que unknown
  })
})
