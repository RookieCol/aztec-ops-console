import { describe, it, expect } from 'vitest'
import { daysBetween, daysOverdue, daysUntil, isOverdue, toDay } from '@/lib/clock'

const NOW = '2026-07-31'

describe('clock', () => {
  it('daysBetween cuenta en días de calendario, no en horas', () => {
    expect(daysBetween('2026-02-10', NOW)).toBe(171) // PRJ-21
    expect(daysBetween('2026-03-02', NOW)).toBe(151) // PRJ-03
  })

  it('daysOverdue es 0 si no hay fecha o si aún no vence', () => {
    expect(daysOverdue(null, NOW)).toBe(0)
    expect(daysOverdue('2026-08-01', NOW)).toBe(0)
    expect(daysOverdue('2026-07-30', NOW)).toBe(1)
  })

  it('isOverdue es estricta: el mismo día no cuenta como vencido', () => {
    expect(isOverdue(NOW, NOW)).toBe(false)
    expect(isOverdue('2026-07-30', NOW)).toBe(true)
  })

  it('daysUntil es negativo para fechas pasadas', () => {
    expect(daysUntil('2026-08-05', NOW)).toBe(5)
    expect(daysUntil('2026-07-25', NOW)).toBe(-6)
  })

  it('toDay no se mueve con la zona horaria del proceso', () => {
    expect(toDay('2026-01-01')).toBe(toDay('2026-01-01'))
    expect(toDay('2026-01-02') - toDay('2026-01-01')).toBe(1)
  })
})
