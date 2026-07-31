import type { Project, ProjectFields, Task } from '@/lib/db/schema'

export function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    code: 'PRJ-TEST',
    engagementType: 'Proyecto',
    clientAlias: 'Cliente Test',
    name: 'Proyecto de prueba',
    projectTypeApi: null,
    stage: null,
    ownerAlias: null,
    ownerRole: null,
    declaredStatus: null,
    declaredHealth: null,
    declaredOpenTasks: null,
    declaredOverdueTasks: null,
    startDate: null,
    targetDate: null,
    businessValue: null,
    currency: null,
    businessValueUsd: null,
    blockers: null,
    summary: null,
    recentCompletedExamples: null,
    isExample: false,
    sourceRow: null,
    importedAt: '2026-07-31T00:00:00.000Z',
    ...overrides,
  }
}

export function makeFields(overrides: Partial<ProjectFields> = {}): ProjectFields {
  return {
    code: 'PRJ-TEST',
    status: 'Activo',
    priorityOverride: null,
    nextStep: null,
    notes: null,
    updatedAt: '2026-07-31T00:00:00.000Z',
    ...overrides,
  }
}

let taskSeq = 0
export function makeTask(overrides: Partial<Task> = {}): Task {
  taskSeq++
  return {
    code: `PRJ-TEST-T${taskSeq}`,
    projectCode: 'PRJ-TEST',
    engagementType: 'Proyecto',
    assigneeAlias: 'Persona Test',
    assigneeRole: 'Delivery',
    priority: 'Media',
    status: 'Por hacer',
    dueDate: null,
    declaredIsOverdue: null,
    dependencyTitle: null,
    dependencyCode: null,
    title: 'Tarea de prueba',
    detail: null,
    lastProgress: null,
    sourceRow: null,
    importedAt: '2026-07-31T00:00:00.000Z',
    ...overrides,
  }
}
