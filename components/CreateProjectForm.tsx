'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { PROJECT_STATUSES, PRIORITY_LABELS, ENGAGEMENT_TYPES } from '@/lib/config'
import { createProject } from '@/lib/actions'
import { displayLabel } from '@/lib/format'
import { AUTO_PRIORITY, AUTO_PRIORITY_LABEL } from '@/lib/ui-tokens'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Field } from '@/components/Field'

export type CreateProjectFormProps = Record<string, never>

/**
 * Formulario de creación de un proyecto nuevo. Los 7 campos que el enunciado pide guardar
 * (responsable, estado, prioridad, fecha límite, siguiente paso, bloqueos, notas) se piden
 * desde el inicio, para no obligar a un segundo paso de edición inmediatamente después de
 * crear. `blockers` en particular tiene que poder fijarse acá: un proyecto nuevo no tiene
 * ninguna "fuente" de la cual heredarlo más adelante.
 */
export function CreateProjectForm() {
  const router = useRouter()

  const [name, setName] = useState('')
  const [clientAlias, setClientAlias] = useState('')
  const [engagementType, setEngagementType] = useState<string>(ENGAGEMENT_TYPES[0])
  const [ownerAlias, setOwnerAlias] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [businessValue, setBusinessValue] = useState('')
  const [status, setStatus] = useState<string>('Activo')
  const [priorityOverride, setPriorityOverride] = useState(AUTO_PRIORITY)
  const [nextStep, setNextStep] = useState('')
  const [notes, setNotes] = useState('')
  const [blockers, setBlockers] = useState('')

  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const parsedValue = businessValue.trim() ? Number(businessValue) : null
    if (parsedValue !== null && Number.isNaN(parsedValue)) {
      setError('El valor de negocio debe ser un número')
      return
    }

    startTransition(async () => {
      try {
        const { code } = await createProject({
          name,
          clientAlias,
          engagementType,
          ownerAlias: ownerAlias.trim() || undefined,
          targetDate: targetDate || null,
          businessValue: parsedValue,
          status,
          priorityOverride: priorityOverride === AUTO_PRIORITY ? null : priorityOverride,
          nextStep: nextStep || null,
          notes: notes || null,
          blockers: blockers || null,
        })
        router.push(`/proyectos/${code}`)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al crear el proyecto')
      }
    })
  }

  return (
    <Card className="max-w-2xl p-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">Nuevo proyecto</h1>

        <Field label="Nombre *">
          {(id) => (
            <Input
              id={id}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre del proyecto"
              required
            />
          )}
        </Field>

        <Field label="Cliente *">
          {(id) => (
            <Input
              id={id}
              value={clientAlias}
              onChange={(e) => setClientAlias(e.target.value)}
              placeholder="Alias del cliente"
              required
            />
          )}
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Tipo de trabajo *">
            {(id) => (
              <Select
                value={engagementType}
                onValueChange={(v) => setEngagementType(v ?? ENGAGEMENT_TYPES[0])}
              >
                <SelectTrigger id={id} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENGAGEMENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {displayLabel(t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>

          <Field label="Responsable">
            {(id) => (
              <Input
                id={id}
                value={ownerAlias}
                onChange={(e) => setOwnerAlias(e.target.value)}
                placeholder="Alias del responsable"
              />
            )}
          </Field>

          <Field label="Fecha límite">
            {(id) => (
              <Input
                id={id}
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
              />
            )}
          </Field>

          <Field label="Valor de negocio (USD)">
            {(id) => (
              <Input
                id={id}
                type="number"
                min="0"
                step="1"
                value={businessValue}
                onChange={(e) => setBusinessValue(e.target.value)}
                placeholder="Ej. 50000"
              />
            )}
          </Field>

          <Field label="Estado inicial">
            {(id) => (
              <Select value={status} onValueChange={(v) => setStatus(v ?? 'Activo')}>
                <SelectTrigger id={id} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>

          <Field label="Prioridad inicial">
            {(id) => (
              <Select
                value={priorityOverride}
                onValueChange={(v) => setPriorityOverride(v ?? AUTO_PRIORITY)}
              >
                <SelectTrigger id={id} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={AUTO_PRIORITY}>{AUTO_PRIORITY_LABEL}</SelectItem>
                  {PRIORITY_LABELS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {displayLabel(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
        </div>

        <Field label="Siguiente paso">
          {(id) => (
            <Textarea
              id={id}
              rows={2}
              value={nextStep}
              onChange={(e) => setNextStep(e.target.value)}
              placeholder="Qué sigue para este proyecto"
            />
          )}
        </Field>

        <Field label="Notas">
          {(id) => (
            <Textarea
              id={id}
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contexto adicional"
            />
          )}
        </Field>

        <Field label="Bloqueos">
          {(id) => (
            <Textarea
              id={id}
              rows={2}
              value={blockers}
              onChange={(e) => setBlockers(e.target.value)}
              placeholder="Qué está bloqueando a este proyecto, si algo lo está"
            />
          )}
        </Field>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Creando…' : 'Crear proyecto'}
          </Button>
        </div>
      </form>
    </Card>
  )
}
