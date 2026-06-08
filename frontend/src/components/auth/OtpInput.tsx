import { useRef } from 'react';

const DEFAULT_OTP_LENGTH = 8;

type OtpInputProps = {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  length?: number;
};

export function OtpInput({ value, onChange, disabled, length = DEFAULT_OTP_LENGTH }: OtpInputProps) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(length, ' ').split('').slice(0, length);

  const setDigit = (index: number, char: string) => {
    const next = value.split('');
    next[index] = char;
    onChange(next.join('').replace(/\s/g, '').slice(0, length));
  };

  return (
    <div className="flex justify-center gap-2 sm:gap-3" role="group" aria-label={`${length}-digit verification code`}>
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
          className="w-10 h-12 sm:w-11 sm:h-14 text-center text-lg font-semibold rounded border border-outline-variant bg-surface-container-lowest text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-60"
          onChange={e => {
            const v = e.target.value.replace(/\D/g, '').slice(-1);
            setDigit(i, v);
            if (v && i < length - 1) inputsRef.current[i + 1]?.focus();
          }}
          onKeyDown={e => {
            if (e.key === 'Backspace' && !digits[i]?.trim() && i > 0) {
              inputsRef.current[i - 1]?.focus();
            }
          }}
          onPaste={e => {
            e.preventDefault();
            const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
            if (pasted) onChange(pasted);
          }}
        />
      ))}
    </div>
  );
}

export { DEFAULT_OTP_LENGTH as OTP_INPUT_LENGTH };
