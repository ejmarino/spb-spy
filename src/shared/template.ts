import type { SpProperty, SpValue } from './types'

/** Miembro de un UDT. Viaja dentro del valor de la metrica como un objeto plano */
export interface TemplateMember {
  name: string
  type: string
  value: SpValue
  alias?: string
  timestamp?: number
  isNull?: boolean
  properties?: Record<string, SpProperty>
  /** Los completa el modelo de datos al aplicar una actualizacion parcial */
  updatedAt?: number
  updates?: number
}

export interface TemplateParameter {
  name: string
  type: string
  value: SpValue
}

/** Valor de una metrica de tipo Template: una definicion de UDT o una instancia */
export interface TemplateValue {
  templateRef?: string
  version?: string
  isDefinition?: boolean
  parameters?: TemplateParameter[]
  metrics: TemplateMember[]
}

export function asTemplate(type: string, value: SpValue): TemplateValue | null {
  if (type !== 'Template' || value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  return Array.isArray(value.metrics) ? (value as unknown as TemplateValue) : null
}

/**
 * Los miembros de un UDT suelen venir sin timestamp propio: se les fija el del
 * mensaje que los trajo, para que despues no parezca que cambiaron cuando solo
 * se actualizo otro miembro. Devuelve una copia; el valor original no se toca.
 */
export function stampTemplate(value: SpValue, timestamp: number | undefined): SpValue {
  const template = asTemplate('Template', value)
  if (!template || timestamp === undefined) return value
  const stamped: TemplateValue = {
    ...template,
    metrics: template.metrics.map((member) => ({
      ...member,
      timestamp: member.timestamp ?? timestamp,
      value:
        member.type === 'Template'
          ? stampTemplate(member.value, member.timestamp ?? timestamp)
          : member.value
    }))
  }
  return stamped as unknown as SpValue
}

export interface MergeStamp {
  /** Momento en que se recibio la actualizacion */
  at: number
  /** Timestamp de la metrica o del payload, para los miembros que no traen el suyo */
  timestamp?: number
}

/**
 * Un DATA de un UDT trae solo los miembros que cambiaron: se combinan con los
 * que ya se conocian. No modifica ninguno de los dos valores (el anterior sigue
 * siendo el del evento que lo trajo): devuelve uno nuevo, y avisa si aparecieron
 * miembros o parametros que antes no estaban.
 */
export function mergeTemplate(
  current: SpValue,
  update: SpValue,
  stamp: MergeStamp
): { value: SpValue; grew: boolean } {
  const base = asTemplate('Template', current)
  const next = asTemplate('Template', update)
  if (!base || !next) return { value: update, grew: true }

  let grew = false
  const metrics = base.metrics.slice()
  const position = new Map(metrics.map((member, i) => [member.name, i]))
  for (const member of next.metrics) {
    const timestamp = member.timestamp ?? stamp.timestamp
    const i = position.get(member.name)
    if (i === undefined) {
      position.set(member.name, metrics.length)
      metrics.push({
        ...member,
        timestamp,
        value: stampTemplate(member.value, timestamp),
        updatedAt: stamp.at,
        updates: 1
      })
      grew = true
      continue
    }
    const previous = metrics[i]
    let value = member.value
    if (member.type === 'Template' && previous.type === 'Template') {
      const nested = mergeTemplate(previous.value, member.value, { at: stamp.at, timestamp })
      value = nested.value
      grew ||= nested.grew
    }
    metrics[i] = {
      ...previous,
      value,
      type: member.type === 'Unknown' ? previous.type : member.type,
      isNull: member.isNull,
      timestamp,
      properties: member.properties ?? previous.properties,
      updatedAt: stamp.at,
      updates: (previous.updates ?? 1) + 1
    }
  }

  const merged: TemplateValue = { ...base, metrics }
  if (next.templateRef !== undefined) merged.templateRef = next.templateRef
  if (next.version !== undefined) merged.version = next.version
  if (next.parameters?.length) {
    const parameters = (base.parameters ?? []).slice()
    for (const parameter of next.parameters) {
      const i = parameters.findIndex((known) => known.name === parameter.name)
      if (i < 0) {
        parameters.push(parameter)
        grew = true
      } else {
        parameters[i] = parameter
      }
    }
    merged.parameters = parameters
  }
  return { value: merged as unknown as SpValue, grew }
}
