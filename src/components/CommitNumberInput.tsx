import { useState, type InputHTMLAttributes } from 'react';

type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type'
> & {
  value: number;
  /** Called once with the parsed value on Enter or blur — never per keystroke. */
  onCommit: (value: number) => void;
};

/**
 * Number field that edits a draft and commits on Enter or blur (Escape
 * reverts). Typing "1200" no longer drags the geometry through 1 → 12 → 120.
 */
export function CommitNumberInput({ value, onCommit, onBlur, onKeyDown, ...rest }: Props) {
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft === null) return;
    const v = parseFloat(draft);
    setDraft(null);
    if (Number.isFinite(v) && v !== value) onCommit(v);
  };

  return (
    <input
      {...rest}
      type="number"
      value={draft ?? String(value)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => {
        commit();
        onBlur?.(e);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
        } else if (e.key === 'Escape' && draft !== null) {
          e.preventDefault();
          e.stopPropagation(); // revert the draft, don't close the dialog
          setDraft(null);
        }
        onKeyDown?.(e);
      }}
    />
  );
}
