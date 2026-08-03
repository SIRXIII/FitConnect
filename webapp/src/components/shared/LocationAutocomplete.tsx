import { useState, useRef, useCallback, useEffect } from 'react';
import { APIProvider, useMapsLibrary } from '@vis.gl/react-google-maps';
import { MapPin } from 'lucide-react';

interface LocationAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Inner component that uses Google Places autocomplete.
 * Must be rendered inside an <APIProvider>.
 */
const AutocompleteInput: React.FC<LocationAutocompleteProps> = ({
  value,
  onChange,
  placeholder = 'City, State (e.g. Miami, FL)',
  className,
}) => {
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompleteSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const placesLib = useMapsLibrary('places');

  const handleInput = useCallback(
    (inputValue: string) => {
      onChange(inputValue);
      setSuggestions([]);

      if (!placesLib || inputValue.length < 3) {
        setOpen(false);
        return;
      }

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        try {
          const { suggestions: results } =
            await placesLib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
              input: inputValue,
              includedPrimaryTypes: ['(cities)'],
            });
          setSuggestions(results ?? []);
          setOpen((results?.length ?? 0) > 0);
        } catch {
          // non-critical
        }
      }, 300);
    },
    [placesLib, onChange]
  );

  const handleSelect = useCallback(
    async (suggestion: google.maps.places.AutocompleteSuggestion) => {
      setOpen(false);
      setSuggestions([]);
      try {
        const place = suggestion.placePrediction?.toPlace();
        if (!place) return;
        await place.fetchFields({ fields: ['formattedAddress'] });
        const addr = place.formattedAddress;
        if (addr) {
          onChange(addr);
        }
      } catch {
        // Fall back to the prediction text
        const text = suggestion.placePrediction?.text?.text;
        if (text) onChange(text);
      }
    },
    [onChange]
  );

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <MapPin
          size={14}
          className="absolute left-0 top-1/2 -translate-y-1/2 text-ink/30 pointer-events-none"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className={
            className ??
            'w-full border-b border-ink/20 bg-transparent pl-5 pb-2 text-base font-light outline-none focus:border-ink/60 transition-colors placeholder:text-ink/20'
          }
        />
      </div>

      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 mt-1 bg-white border border-ink/10 shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map((s, i) => {
            const text = s.placePrediction?.text?.text ?? '';
            return (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => handleSelect(s)}
                  className="w-full text-left px-4 py-3 text-sm text-ink/80 hover:bg-ink/5 transition-colors flex items-center gap-2"
                >
                  <MapPin size={12} className="text-ink/30 flex-shrink-0" />
                  {text}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

/**
 * Google Places city autocomplete wrapped in APIProvider.
 * Drop-in replacement for a plain text input.
 */
const LocationAutocomplete: React.FC<LocationAutocompleteProps> = (props) => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;

  if (!apiKey) {
    // Fallback to plain input if no API key
    return (
      <input
        type="text"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder ?? 'City, State (e.g. Miami, FL)'}
        className={
          props.className ??
          'w-full border-b border-ink/20 bg-transparent pb-2 text-base font-light outline-none focus:border-ink/60 transition-colors placeholder:text-ink/20'
        }
      />
    );
  }

  return (
    <APIProvider apiKey={apiKey}>
      <AutocompleteInput {...props} />
    </APIProvider>
  );
};

export default LocationAutocomplete;
