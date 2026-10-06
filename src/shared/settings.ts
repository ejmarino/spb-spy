import type { AppSettings, UpdateFrequency } from './types'

const DAY_MS = 24 * 60 * 60 * 1000

export const MIN_MAX_EVENTS = 500
export const MAX_MAX_EVENTS = 50_000
export const MAX_EVENTS_RANGE = `${MIN_MAX_EVENTS} y ${MAX_MAX_EVENTS.toLocaleString('es-AR')}`
/** Lo que la lista puede pasarse del maximo antes de recortarla */
const TRIM_SLACK = 1.2

/** Sparkplug no los admite en un id, asi que nunca separarian nada */
const RESERVED_SEPARATORS = '/+#'

export const DEFAULT_SETTINGS: AppSettings = {
  updateFrequency: 'daily',
  maxEvents: 10_000,
  splitLevels: true,
  levelSeparator: ':'
}

export const UPDATE_FREQUENCIES: { value: UpdateFrequency; label: string }[] = [
  { value: 'daily', label: 'Diaria' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensual' },
  { value: 'never', label: 'Nunca' }
]

/** Dias entre dos busquedas automaticas */
const FREQUENCY_DAYS: Record<Exclude<UpdateFrequency, 'never'>, number> = {
  daily: 1,
  weekly: 7,
  monthly: 30
}

function isUpdateFrequency(value: unknown): value is UpdateFrequency {
  return UPDATE_FREQUENCIES.some((frequency) => frequency.value === value)
}

/** Motivo por el que el valor no sirve como maximo de eventos, o null si sirve */
export function validateMaxEvents(value: unknown): string | null {
  const valid =
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= MIN_MAX_EVENTS &&
    value <= MAX_MAX_EVENTS
  return valid ? null : `Un número entero entre ${MAX_EVENTS_RANGE}`
}

/** Motivo por el que el valor no sirve como separador de niveles, o null si sirve */
export function validateLevelSeparator(value: unknown): string | null {
  // por puntos de codigo: un caracter fuera del plano basico cuenta como uno
  if (typeof value !== 'string' || [...value].length !== 1) return 'Un solo carácter'
  if (/\s/u.test(value)) return 'No puede ser un espacio en blanco'
  if (RESERVED_SEPARATORS.includes(value)) {
    return `No puede ser ${value}: no se admite en un id de Sparkplug`
  }
  return null
}

/** Motivos por los que no se pueden aplicar los cambios; vacio si son validos */
export function validateSettings(changes: Partial<AppSettings>): string[] {
  const errors: string[] = []
  if (changes.updateFrequency !== undefined && !isUpdateFrequency(changes.updateFrequency)) {
    errors.push('Periodicidad desconocida')
  }
  if (changes.maxEvents !== undefined) {
    const error = validateMaxEvents(changes.maxEvents)
    if (error) errors.push(`Máximo de eventos: ${error}`)
  }
  if (changes.splitLevels !== undefined && typeof changes.splitLevels !== 'boolean') {
    errors.push('Separar en niveles: tiene que ser sí o no')
  }
  if (changes.levelSeparator !== undefined) {
    const error = validateLevelSeparator(changes.levelSeparator)
    if (error) errors.push(`Carácter separador: ${error}`)
  }
  return errors
}

/**
 * Arma la configuracion a partir de lo guardado: lo que falta o no es valido
 * toma su valor por defecto. Las versiones anteriores guardaban una casilla
 * `autoUpdateCheck` en lugar de la periodicidad.
 */
export function normalizeSettings(raw: unknown): AppSettings {
  const stored = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  let updateFrequency = DEFAULT_SETTINGS.updateFrequency
  if (isUpdateFrequency(stored.updateFrequency)) updateFrequency = stored.updateFrequency
  else if (stored.autoUpdateCheck === false) updateFrequency = 'never'
  const maxEvents =
    validateMaxEvents(stored.maxEvents) === null
      ? (stored.maxEvents as number)
      : DEFAULT_SETTINGS.maxEvents
  const splitLevels =
    typeof stored.splitLevels === 'boolean' ? stored.splitLevels : DEFAULT_SETTINGS.splitLevels
  const levelSeparator =
    validateLevelSeparator(stored.levelSeparator) === null
      ? (stored.levelSeparator as string)
      : DEFAULT_SETTINGS.levelSeparator
  return { updateFrequency, maxEvents, splitLevels, levelSeparator }
}

/** Ya paso el intervalo de la periodicidad desde la ultima busqueda */
export function updateCheckDue(
  frequency: UpdateFrequency,
  lastCheck: number,
  now: number
): boolean {
  if (frequency === 'never') return false
  return now - lastCheck >= FREQUENCY_DAYS[frequency] * DAY_MS
}

/**
 * Deja los `max` eventos mas recientes. Mientras llegan eventos se tolera un
 * excedente para no recortar con cada uno; con `force` se recorta al maximo justo.
 */
export function trimEvents<T>(events: T[], max: number, force = false): T[] {
  const limit = force ? max : max * TRIM_SLACK
  return events.length > limit ? events.slice(-max) : events
}
