export function Toggle({
  checked,
  onChange,
  label,
  hint
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  hint?: string
}): React.JSX.Element {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-track" />
      <span className="toggle-text">
        {label}
        {hint ? <span className="field-hint">{hint}</span> : null}
      </span>
    </label>
  )
}
