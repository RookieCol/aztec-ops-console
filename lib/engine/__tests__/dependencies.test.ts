import { describe, it, expect } from 'vitest'
import { findDependencyCycles, cycleTaskCodes } from '@/lib/engine/dependencies'
import { makeTask } from './fixtures'

describe('findDependencyCycles', () => {
  it('detecta el ciclo real de 2 nodos de PRJ-04 (T02 <-> T03)', () => {
    const t02 = makeTask({ code: 'PRJ-04-T02', dependencyCode: 'PRJ-04-T03' })
    const t03 = makeTask({ code: 'PRJ-04-T03', dependencyCode: 'PRJ-04-T02' })
    const cycles = findDependencyCycles([t02, t03])
    expect(cycles).toHaveLength(1)
    expect(cycles[0].sort()).toEqual(['PRJ-04-T02', 'PRJ-04-T03'])
  })

  it('una cadena lineal sin ciclo no reporta nada', () => {
    const a = makeTask({ code: 'A', dependencyCode: null })
    const b = makeTask({ code: 'B', dependencyCode: 'A' })
    const c = makeTask({ code: 'C', dependencyCode: 'B' })
    expect(findDependencyCycles([a, b, c])).toHaveLength(0)
  })
})

describe('cycleTaskCodes', () => {
  it('marca las 2 tareas del ciclo real de PRJ-04, ninguna otra', () => {
    const t01 = makeTask({ code: 'PRJ-04-T01', dependencyCode: null })
    const t02 = makeTask({ code: 'PRJ-04-T02', dependencyCode: 'PRJ-04-T03' })
    const t03 = makeTask({ code: 'PRJ-04-T03', dependencyCode: 'PRJ-04-T02' })
    const t04 = makeTask({ code: 'PRJ-04-T04', dependencyCode: 'PRJ-04-T01' })

    const codes = cycleTaskCodes([t01, t02, t03, t04])

    expect(codes.has('PRJ-04-T02')).toBe(true)
    expect(codes.has('PRJ-04-T03')).toBe(true)
    expect(codes.has('PRJ-04-T01')).toBe(false)
    expect(codes.has('PRJ-04-T04')).toBe(false)
  })

  it('conjunto vacío cuando no hay ciclos', () => {
    const a = makeTask({ code: 'A', dependencyCode: null })
    const b = makeTask({ code: 'B', dependencyCode: 'A' })
    expect(cycleTaskCodes([a, b]).size).toBe(0)
  })
})
