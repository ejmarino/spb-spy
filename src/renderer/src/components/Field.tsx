export function Field({
  label,
  hint,
  error,
  children
}: {
  label: string
  hint?: string
  error?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <label className={`field${error ? ' has-error' : ''}`}>
      <span className="field-label">{label}</span>
      {children}
      {error ? <span className="field-error">{error}</span> : null}
      {!error && hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  )
}
