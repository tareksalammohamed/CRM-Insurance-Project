import { Search, X } from 'lucide-react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

/**
 * حقل بحث عام بأيقونة بحث وزر مسح.
 * استُخرج من الأنماط المتطابقة فى صفحات العملاء، الوثائق والتحصيل.
 */
export function SearchInput({ value, onChange, placeholder }: SearchInputProps) {
  return (
    <div className="relative flex-1">
      <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400 pointer-events-none" aria-hidden="true" />
      <input
        type="search"
        inputMode="search"
        enterKeyHint="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        // Escape يمسح الحقل — اختصار متوقّع فى حقول البحث
        onKeyDown={(e) => { if (e.key === 'Escape' && value) { e.stopPropagation(); onChange(''); } }}
        className="input-field pr-10 pl-11 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="مسح البحث"
          title="مسح البحث"
          className="absolute left-0.5 top-1/2 -translate-y-1/2 grid h-11 w-11 place-items-center rounded-lg text-secondary-400 transition-colors hover:bg-secondary-100 hover:text-secondary-700"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
