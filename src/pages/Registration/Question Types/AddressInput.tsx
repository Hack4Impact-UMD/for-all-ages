import { useState, useEffect, useRef } from "react";
import { Country, State } from "country-state-city";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import styles from "../Registration.module.css";

// Guard: setOptions must only be called once per page load
let mapsOptionsInitialized = false;

export default function AddressInput({
  namePrefix,
  required,
}: {
  namePrefix: string;
  required: boolean;
}) {
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [stateVal, setStateVal] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [countryName, setCountryName] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompleteSuggestion[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const allCountriesRef = useRef(Country.getAllCountries());
  const placesLibRef = useRef<google.maps.PlacesLibrary | null>(null);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  const allCountries = allCountriesRef.current;
  const states = countryCode ? State.getStatesOfCountry(countryCode) : [];

  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
    if (!apiKey) return;

    if (!mapsOptionsInitialized) {
      setOptions({ key: apiKey });
      mapsOptionsInitialized = true;
    }

    importLibrary("places").then((lib) => {
      const pl = lib as google.maps.PlacesLibrary;
      placesLibRef.current = pl;
      sessionTokenRef.current = new pl.AutocompleteSessionToken();
    });
  }, []);

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const name = e.target.value;
    const found = allCountries.find((c) => c.name === name);
    setCountryName(name);
    setCountryCode(found?.isoCode ?? "");
    setStateVal("");
  };

  const handleLine1Change = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLine1(value);

    if (!value.trim() || !placesLibRef.current) {
      setSuggestions([]);
      return;
    }

    try {
      const { AutocompleteSuggestion } = placesLibRef.current;
      const result = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: value,
        sessionToken: sessionTokenRef.current ?? undefined,
        includedPrimaryTypes: ["street_address"],
      });
      setSuggestions(result.suggestions);
      setHighlightedIndex(-1);
    } catch {
      setSuggestions([]);
      setHighlightedIndex(-1);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && highlightedIndex >= 0) {
      e.preventDefault();
      handleSelectSuggestion(suggestions[highlightedIndex]);
    } else if (e.key === "Escape") {
      setSuggestions([]);
      setHighlightedIndex(-1);
    }
  };

  const handleSelectSuggestion = async (
    suggestion: google.maps.places.AutocompleteSuggestion,
  ) => {
    setSuggestions([]);
    const place = suggestion.placePrediction!.toPlace();
    await place.fetchFields({ fields: ["addressComponents"] });

    let streetNumber = "";
    let route = "";

    for (const component of place.addressComponents ?? []) {
      const types = component.types;
      if (types.includes("street_number")) streetNumber = component.longText ?? "";
      if (types.includes("route")) route = component.shortText ?? "";
      if (types.includes("locality")) setCity(component.longText ?? "");
      if (types.includes("postal_code")) setPostalCode(component.longText ?? "");
      if (types.includes("administrative_area_level_1"))
        setStateVal(component.longText ?? "");
      if (types.includes("country")) {
        const name = component.longText ?? "";
        const found = allCountriesRef.current.find((c) => c.name === name);
        setCountryName(name);
        setCountryCode(found?.isoCode ?? "");
      }
    }

    setLine1(`${streetNumber} ${route}`.trim());
    setHighlightedIndex(-1);

    // Refresh session token after each completed selection
    if (placesLibRef.current) {
      sessionTokenRef.current =
        new placesLibRef.current.AutocompleteSessionToken();
    }
  };

  return (
    <div>
      {/* Street Address */}
      <div className={styles.fieldGroup}>
        <span className={styles.fieldLabel}>Street Address</span>
        <div style={{ position: "relative" }}>
          <input
            className={styles.fieldInput}
            type="text"
            name={`${namePrefix}.line1`}
            value={line1}
            onChange={handleLine1Change}
            onKeyDown={handleKeyDown}
            onBlur={() => { setSuggestions([]); setHighlightedIndex(-1); }}
            required={required}
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={suggestions.length > 0}
          />
          {suggestions.length > 0 && (
            <ul className={styles.suggestionsList}>
              {suggestions.map((s, i) => (
                <li
                  key={i}
                  className={`${styles.suggestionItem}${i === highlightedIndex ? ` ${styles.suggestionItemHighlighted}` : ""}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelectSuggestion(s);
                  }}
                  onMouseEnter={() => setHighlightedIndex(i)}
                >
                  {s.placePrediction?.text?.toString() ?? ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Street Address 2 */}
      <div className={styles.fieldGroup}>
        <span className={styles.fieldLabel}>Street Address 2</span>
        <input
          className={styles.fieldInput}
          type="text"
          name={`${namePrefix}.line2`}
          value={line2}
          onChange={(e) => setLine2(e.target.value)}
        />
      </div>

      {/* City / State / Postal Code / Country */}
      <div className={styles.addressSubRow}>
        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>City</span>
          <input
            className={styles.fieldInput}
            type="text"
            name={`${namePrefix}.city`}
            value={city}
            onChange={(e) => setCity(e.target.value)}
            required={required}
          />
        </div>

        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>State / Province</span>
          {states.length > 0 ? (
            <select
              className={styles.fieldSelect}
              name={`${namePrefix}.state`}
              value={stateVal}
              onChange={(e) => setStateVal(e.target.value)}
              required={required}
            >
              <option value="">Select a state</option>
              {states.map((s) => (
                <option key={s.isoCode} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              className={styles.fieldInput}
              type="text"
              name={`${namePrefix}.state`}
              value={stateVal}
              onChange={(e) => setStateVal(e.target.value)}
              required={required}
            />
          )}
        </div>

        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>Postal / Zip Code</span>
          <input
            className={styles.fieldInput}
            type="text"
            name={`${namePrefix}.postalCode`}
            value={postalCode}
            onChange={(e) => setPostalCode(e.target.value)}
            required={required}
          />
        </div>

        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>Country</span>
          <select
            className={styles.fieldSelect}
            name={`${namePrefix}.country`}
            value={countryName}
            onChange={handleCountryChange}
            required={required}
          >
            <option value="">Select a country</option>
            {allCountries.map((c) => (
              <option key={c.isoCode} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
