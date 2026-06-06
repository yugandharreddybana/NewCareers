import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { authApi, type WordCaptchaChallenge } from '@/services/api';

type Props = {
  value: string | null;
  onChange: (token: string | null) => void;
  disabled?: boolean;
  onRefresh?: () => void;
};

const inputClass =
  'w-full px-4 py-3 text-sm border border-gray-200 rounded-xl bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#022c22]/15 focus:border-[#022c22] transition-colors placeholder:text-gray-400 disabled:opacity-60 uppercase tracking-widest font-mono';

export function WordCaptchaField({ value: _value, onChange, disabled, onRefresh }: Props) {
  const [challenge, setChallenge] = useState<WordCaptchaChallenge | null>(null);
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadChallenge = useCallback(async () => {
    setLoading(true);
    setError('');
    setAnswer('');
    onChange(null);
    try {
      const next = await authApi.getWordCaptchaChallenge();
      setChallenge(next);
      onRefresh?.();
    } catch {
      setError('Could not load security check. Please try again.');
      setChallenge(null);
    } finally {
      setLoading(false);
    }
  }, [onChange, onRefresh]);

  useEffect(() => {
    void loadChallenge();
  }, [loadChallenge]);

  useEffect(() => {
    if (!challenge) {
      onChange(null);
      return;
    }
    const trimmed = answer.trim();
    if (trimmed.length >= challenge.letters.length) {
      onChange(`${challenge.challengeId}:${trimmed}`);
    } else {
      onChange(null);
    }
  }, [answer, challenge, onChange]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label htmlFor="word-captcha" className="block text-xs font-semibold text-gray-700">
          Security check
        </label>
        <button
          type="button"
          onClick={() => void loadChallenge()}
          disabled={disabled || loading}
          className="inline-flex items-center gap-1 text-xs font-medium text-[#10b981] hover:text-[#047857] disabled:opacity-50 transition-colors"
          aria-label="Refresh security check"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="flex items-stretch gap-3 rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white px-4 py-3 min-h-[52px]">
        {loading ? (
          <div className="flex flex-1 items-center justify-center py-1">
            <Loader2 size={18} className="animate-spin text-gray-400" />
          </div>
        ) : error ? (
          <p className="flex-1 text-xs text-red-600 py-1">{error}</p>
        ) : challenge ? (
          <div
            className="flex flex-1 flex-wrap items-center justify-center gap-1.5 select-none"
            aria-hidden
          >
            {challenge.letters.map((glyph, i) => (
              <span
                key={`${glyph.character}-${i}`}
                className="inline-block font-mono text-xl font-bold leading-none"
                style={{
                  color: glyph.color,
                  transform: `rotate(${glyph.rotate}deg) translateY(${glyph.translateY}px)`,
                }}
              >
                {glyph.character}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <input
        id="word-captcha"
        name="word-captcha"
        className={inputClass}
        type="text"
        inputMode="text"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        placeholder="Type the characters above"
        maxLength={8}
        value={answer}
        onChange={e => setAnswer(e.target.value.toUpperCase())}
        disabled={disabled || loading || !challenge}
        aria-describedby="word-captcha-hint"
      />
      <p id="word-captcha-hint" className="text-[11px] text-gray-400">
        Enter the jumbled characters left to right. Not case-sensitive.
      </p>
    </div>
  );
}
