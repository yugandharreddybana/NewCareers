import { useRef } from 'react';

type OtpInputProps = {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
};

export function OtpInput({ value, onChange, disabled }: OtpInputProps) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(6, ' ').split('').slice(0, 6);

  const setDigit = (index: number, char: string) => {
    const next = value.split('');
    next[index] = char;
    onChange(next.join('').replace(/\s/g, '').slice(0, 6));
  };

  return (
    <div className="flex justify-center gap-2 sm:gap-3" role="group" aria-label="6-digit verification code">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={el => {
            inputsRef.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          disabled={disabled}
          value={d.trim()}
          aria-label={`Digit ${i + 1}`}
          className="w-11 h-12 sm:w-12 sm:h-14 text-center text-lg font-semibold rounded border border-outline-variant bg-surface-container-lowest text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-60"
          onChange={e => {
            const v = e.target.value.replace(/\D/g, '').slice(-1);
            setDigit(i, v);
            if (v && i < 5) inputsRef.current[i + 1]?.focus();
          }}
          onKeyDown={e => {
            if (e.key === 'Backspace' && !digits[i]?.trim() && i > 0) {
              inputsRef.current[i - 1]?.focus();
            }
          }}
          onPaste={e => {
            e.preventDefault();
            const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
            if (pasted) onChange(pasted);
          }}
        />
      ))}
    </div>
  );
}
