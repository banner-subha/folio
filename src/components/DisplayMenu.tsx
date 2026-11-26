import { SIZES, THEMES, type Settings, type ThemeChoice } from '../lib/theme'
import { usePopover } from '../lib/usePopover'

type Props = {
  settings: Settings
  defaults: Settings
  update: (patch: Partial<Settings>) => void
  stepSize: (dir: 1 | -1) => void
}

/** Top-bar "Display" button and its panel: theme, text size, line width, body font. */
export function DisplayMenu({ settings, defaults, update, stepSize }: Props) {
  const { open, setOpen, wrap, button } = usePopover()

  const choices: { id: ThemeChoice; label: string; note: string }[] = [
    { id: 'auto', label: 'Match Windows', note: 'Paper or Ink' },
    ...THEMES,
  ]

  return (
    <div className="display" ref={wrap}>
      <button
        ref={button}
        type="button"
        className="btn-quiet"
        aria-expanded={open}
        aria-controls="display-panel"
        onClick={() => setOpen((o) => !o)}
        title="Theme, text size and width"
      >
        Display
      </button>

      {open && (
        <div id="display-panel" className="display-panel" role="dialog" aria-label="Display settings">
          <fieldset>
            <legend>Theme</legend>
            <div className="swatches">
              {choices.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="swatch"
                  aria-pressed={settings.theme === c.id}
                  onClick={() => update({ theme: c.id })}
                >
                  {/* The sample carries the theme's own tokens via data-theme. */}
                  <span className="swatch-sample" data-theme={c.id === 'auto' ? undefined : c.id}>
                    {c.id === 'auto' ? (
                      <>
                        <span className="swatch-half" data-theme="paper">Aa</span>
                        <span className="swatch-half" data-theme="ink">Aa</span>
                      </>
                    ) : (
                      <>
                        Aa<i />
                      </>
                    )}
                  </span>
                  <span className="swatch-label">{c.label}</span>
                  <span className="swatch-note">{c.note}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Text size</legend>
            <div className="stepper">
              <button
                type="button"
                onClick={() => stepSize(-1)}
                disabled={settings.size === SIZES[0]}
                aria-label="Smaller text"
                title="Smaller text (Ctrl+-)"
              >
                A−
              </button>
              <output aria-live="polite">{settings.size}px</output>
              <button
                type="button"
                onClick={() => stepSize(1)}
                disabled={settings.size === SIZES[SIZES.length - 1]}
                aria-label="Larger text"
                title="Larger text (Ctrl+=)"
              >
                A+
              </button>
              <button
                type="button"
                className="stepper-reset"
                onClick={() => update({ size: defaults.size })}
                disabled={settings.size === defaults.size}
              >
                Reset
              </button>
            </div>
          </fieldset>

          <fieldset>
            <legend>Line width</legend>
            <Segmented
              name="width"
              value={settings.width}
              options={[
                ['narrow', 'Narrow'],
                ['wide', 'Wide'],
                ['full', 'Full window'],
              ]}
              onChange={(width) => update({ width })}
            />
          </fieldset>

          <fieldset>
            <legend>Body font</legend>
            <Segmented
              name="font"
              value={settings.font}
              options={[
                ['serif', 'Serif'],
                ['sans', 'Sans'],
              ]}
              onChange={(font) => update({ font })}
            />
          </fieldset>
        </div>
      )}
    </div>
  )
}

function Segmented<T extends string>({
  name,
  value,
  options,
  onChange,
}: {
  name: string
  value: T
  options: [T, string][]
  onChange: (v: T) => void
}) {
  return (
    <div className="segmented" role="radiogroup">
      {options.map(([v, label]) => (
        <label key={v} className={value === v ? 'is-on' : undefined}>
          <input type="radio" name={name} value={v} checked={value === v} onChange={() => onChange(v)} />
          {label}
        </label>
      ))}
    </div>
  )
}
