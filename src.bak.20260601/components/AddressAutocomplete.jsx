import { useState, useEffect, useRef, useCallback } from 'react'
import { MapPin, Loader2 } from 'lucide-react'
import { autocompleteAddress } from '../utils/googleMaps'

export default function AddressAutocomplete({
  value,
  onChange,
  onSelect,       // called with full address string when user picks a suggestion
  placeholder,
  className,
  pinColor = 'text-gray-400',
  required,
  error,
}) {
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading]         = useState(false)
  const [open, setOpen]               = useState(false)
  const timerRef  = useRef(null)
  const wrapRef   = useRef(null)

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const fetchSuggestions = useCallback((input) => {
    clearTimeout(timerRef.current)
    if (!input || input.length < 3) { setSuggestions([]); setOpen(false); return }
    timerRef.current = setTimeout(async () => {
      setLoading(true)
      const results = await autocompleteAddress(input)
      setSuggestions(results)
      setOpen(results.length > 0)
      setLoading(false)
    }, 380)
  }, [])

  function handleChange(e) {
    const v = e.target.value
    onChange(v)
    fetchSuggestions(v)
  }

  function handleSelect(address) {
    onChange(address)
    if (onSelect) onSelect(address)
    setSuggestions([])
    setOpen(false)
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <MapPin size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 flex-shrink-0 ${pinColor}`} />
        <input
          type="text"
          value={value}
          onChange={handleChange}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          required={required}
          className={`!pl-8 ${className} ${error ? 'border-red-300 ring-1 ring-red-200' : ''}`}
        />
        {loading && (
          <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />
        )}
      </div>

      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-56 overflow-y-auto">
          {suggestions.map((addr, i) => (
            <li key={i}>
              <button
                type="button"
                onMouseDown={() => handleSelect(addr)}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-800 hover:bg-gray-50 flex items-start gap-2 border-b border-gray-50 last:border-0"
              >
                <MapPin size={13} className="text-gray-400 flex-shrink-0 mt-0.5" />
                <span className="leading-snug">{addr}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
