import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Banknote } from 'lucide-react';

/** Map ISO 4217 currency codes to symbols */
const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: '€',
  GBP: '£',
  USD: '$',
  CAD: 'CA$',
  AUD: 'A$',
};

function currencySymbol(code?: string | null): string {
  if (!code) return '€'; // default to € (Ireland-first product)
  return CURRENCY_SYMBOLS[code.toUpperCase()] ?? code;
}

interface SalaryRangeFilterProps {
  minSalary?: number;
  maxSalary?: number;
  /** ISO 4217 currency code from the job data, e.g. "EUR", "GBP", "USD" */
  currency?: string | null;
  onChange: (min?: number, max?: number) => void;
}

export default function SalaryRangeFilter({
  minSalary,
  maxSalary,
  currency,
  onChange,
}: SalaryRangeFilterProps) {
  const [min, setMin] = useState<string>(minSalary?.toString() ?? '');
  const [max, setMax] = useState<string>(maxSalary?.toString() ?? '');

  const symbol = currencySymbol(currency);

  const handleApply = () => {
    const parsedMin = min ? parseInt(min, 10) : undefined;
    const parsedMax = max ? parseInt(max, 10) : undefined;
    onChange(parsedMin, parsedMax);
  };

  const handleClear = () => {
    setMin('');
    setMax('');
    onChange(undefined, undefined);
  };

  return (
    <div className="flex flex-col gap-2 p-3 border rounded-lg bg-card">
      <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
        <Banknote className="h-4 w-4" />
        <span>Salary Range ({symbol})</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Label htmlFor="salary-min" className="sr-only">Min Salary</Label>
          <Input
            id="salary-min"
            type="number"
            placeholder="Min"
            value={min}
            onChange={(e) => setMin(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <span className="text-muted-foreground text-xs">–</span>
        <div className="flex-1">
          <Label htmlFor="salary-max" className="sr-only">Max Salary</Label>
          <Input
            id="salary-max"
            type="number"
            placeholder="Max"
            value={max}
            onChange={(e) => setMax(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" className="flex-1 h-7 text-xs" onClick={handleApply}>
          Apply
        </Button>
        {(min || max) && (
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={handleClear}>
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
