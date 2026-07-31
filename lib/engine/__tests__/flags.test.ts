import { describe, it, expect } from 'vitest'
import { computeFlags } from '@/lib/engine/flags'
import { makeFields, makeProject, makeTask } from './fixtures'

const NOW = '2026-07-31'

describe('computeFlags', () => {
  it('sin tareas y sin target: solo dispara sin_siguiente_paso', () => {
    const flags = computeFlags(makeProject(), makeFields(), [], NOW)
    expect(flags.map((f) => f.kind)).toEqual(['sin_siguiente_paso'])
  })

  it('bloqueado: >=1 tarea Bloqueada dispara el flag, con severidad creciente por cantidad', () => {
    const oneBlocked = computeFlags(makeProject(), makeFields({ nextStep: 'x' }), [
      makeTask({ status: 'Bloqueada', dueDate: '2026-07-20' }),
      makeTask({ status: 'En progreso' }),
    ], NOW)
    const twoBlocked = computeFlags(makeProject(), makeFields({ nextStep: 'x' }), [
      makeTask({ status: 'Bloqueada', dueDate: '2026-07-20' }),
      makeTask({ status: 'Bloqueada', dueDate: '2026-07-25' }),
      makeTask({ status: 'En progreso' }),
    ], NOW)

    const one = oneBlocked.find((f) => f.kind === 'bloqueado')!
    const two = twoBlocked.find((f) => f.kind === 'bloqueado')!
    expect(one).toBeDefined()
    expect(two.severity).toBeGreaterThan(one.severity)
  })

  it('deadlock de dependencias (PRJ-04) dispara bloqueado con severidad máxima aunque no haya tareas Bloqueada', () => {
    const t02 = makeTask({ code: 'PRJ-04-T02', status: 'Por hacer', title: 'T02' })
    const t03 = makeTask({ code: 'PRJ-04-T03', status: 'Por hacer', title: 'T03' })
    t02.dependencyCode = 'PRJ-04-T03'
    t03.dependencyCode = 'PRJ-04-T02'

    const flags = computeFlags(makeProject({ code: 'PRJ-04' }), makeFields({ nextStep: 'x' }), [t02, t03], NOW)
    const blocked = flags.find((f) => f.kind === 'bloqueado')
    expect(blocked).toBeDefined()
    expect(blocked!.severity).toBe(100)
    expect(blocked!.reasons.join(' ')).toMatch(/ciclo/i)
  })

  it('en_riesgo: target vencida dispara el flag con severidad por antigüedad', () => {
    const flags = computeFlags(
      makeProject({ targetDate: '2026-02-10' }), // PRJ-21: 171 días vencido
      makeFields({ nextStep: 'x' }),
      [],
      NOW,
    )
    const risk = flags.find((f) => f.kind === 'en_riesgo')
    expect(risk).toBeDefined()
    expect(risk!.severity).toBeGreaterThan(70)
  })

  it('en_riesgo: tareas que vencen después del target disparan el flag aunque el target no haya vencido', () => {
    const flags = computeFlags(
      makeProject({ targetDate: '2026-08-10' }),
      makeFields({ nextStep: 'x' }),
      [makeTask({ dueDate: '2026-09-01', status: 'En progreso' })],
      NOW,
    )
    const risk = flags.find((f) => f.kind === 'en_riesgo')
    expect(risk).toBeDefined()
    expect(risk!.reasons.join(' ')).toMatch(/después de la fecha límite/)
  })

  it('sin_siguiente_paso: no dispara si hay next_step aunque no haya tarea en progreso', () => {
    const flags = computeFlags(
      makeProject(),
      makeFields({ nextStep: 'Llamar al cliente' }),
      [makeTask({ status: 'Por hacer' })],
      NOW,
    )
    expect(flags.find((f) => f.kind === 'sin_siguiente_paso')).toBeUndefined()
  })

  it('sin_siguiente_paso: no dispara si hay una tarea En progreso aunque next_step esté vacío', () => {
    const flags = computeFlags(
      makeProject(),
      makeFields({ nextStep: null }),
      [makeTask({ status: 'En progreso' })],
      NOW,
    )
    expect(flags.find((f) => f.kind === 'sin_siguiente_paso')).toBeUndefined()
  })

  it('un proyecto Cerrado no dispara ningún flag aunque tenga fecha vencida y sin tareas', () => {
    const flags = computeFlags(
      makeProject({ targetDate: '2026-01-01' }), // muy vencido
      makeFields({ status: 'Cerrado', nextStep: null }), // y sin next_step
      [], // sin tareas
      NOW,
    )
    expect(flags).toHaveLength(0)
  })

  it('blockers de texto libre no genera ningún flag por sí solo', () => {
    const flags = computeFlags(
      makeProject({ blockers: 'There are external dependencies or pending accesses.' }),
      makeFields({ nextStep: 'x' }),
      [makeTask({ status: 'En progreso' })],
      NOW,
    )
    expect(flags).toHaveLength(0)
  })
})
