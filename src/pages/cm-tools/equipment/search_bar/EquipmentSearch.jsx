import { useState, useMemo, useRef, useEffect } from "react";
import "./EquipmentSearch.css";

/**
 * Get photo URL for a model if available
 * Uses the url field from the database which contains the full URL (GCS in production)
 */
const getModelPhotoUrl = (classCode, makeCode, modelCode, equipmentPhotos) => {
  if (!equipmentPhotos?.classes) return null;

  const classEntry = equipmentPhotos.classes.find((c) => c.class === classCode);
  if (!classEntry) return null;

  const makeEntry = classEntry.makes.find((m) => m.make === makeCode);
  if (!makeEntry) return null;

  // Find matching model - models can be objects with {model, filename, url} or strings with asterisks
  const matchingModel = makeEntry.models.find((m) => {
    if (typeof m === "object") {
      return m.model === modelCode;
    }
    // Legacy format: strings with trailing asterisks
    const cleanModel = m.replace(/\*+$/, "");
    return cleanModel === modelCode;
  });

  if (!matchingModel) return null;

  // Use the url field directly (contains full GCS URL in production)
  if (typeof matchingModel === "object" && matchingModel.url) {
    return matchingModel.url;
  }

  // Fallback for old format with filename only
  if (typeof matchingModel === "object" && matchingModel.filename) {
    return `/equipment_photos/${matchingModel.filename}`;
  }

  // Legacy fallback: construct filename from codes (for old static data)
  const cleanModel =
    typeof matchingModel === "string"
      ? matchingModel.replace(/\*+$/, "")
      : matchingModel.model;
  return `/equipment_photos/${classCode}_${makeCode}_${cleanModel}.jpg`;
};

function EquipmentSearch({
  standard = [],
  misc = [],
  categories = [],
  equipmentPhotos = null,
  onSelectModel,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [hoveredPhoto, setHoveredPhoto] = useState(null); // Track hovered photo for tooltip
  const hoveredPhotoUrlRef = useRef(null); // Track which photo URL is being hovered
  const searchRef = useRef(null);
  const resultsRef = useRef(null);

  // Build searchable data from standard and misc
  const searchableData = useMemo(() => {
    const allEquipment = [
      ...standard.map((item) => ({ ...item, _source: "standard" })),
      ...misc.map((item) => ({ ...item, _source: "misc" })),
    ];

    // First pass: build a map of make -> models list for index calculation
    // Don't sort - keep the order consistent with useSunburstData which uses insertion order
    const makeToModels = new Map();
    allEquipment.forEach((item) => {
      const makeKey = `${item.CLASS}-${item.MAKE}`;
      if (!makeToModels.has(makeKey)) {
        makeToModels.set(makeKey, []);
      }
      const models = makeToModels.get(makeKey);
      const modelStr = String(item.MODEL);
      if (!models.includes(modelStr)) {
        models.push(modelStr);
      }
    });

    // Group by unique MODEL (CLASS + MAKE + MODEL combination)
    const modelMap = new Map();

    allEquipment.forEach((item) => {
      const key = `${item.CLASS}-${item.MAKE}-${item.MODEL}`;
      if (!modelMap.has(key)) {
        // Find category info
        let categoryIndex = -1;
        let categoryName = "";
        let categoryAbbr = "";

        for (let i = 0; i < categories.length; i++) {
          const cat = categories[i];
          if (cat.classes.some((cls) => cls.CLASS === item.CLASS)) {
            categoryIndex = i;
            categoryName = cat.category;
            categoryAbbr = cat.abbr;
            break;
          }
        }

        // Find this model's index within its make (for pagination)
        const makeKey = `${item.CLASS}-${item.MAKE}`;
        const modelsInMake = makeToModels.get(makeKey) || [];
        const modelIndexInMake = modelsInMake.indexOf(String(item.MODEL));

        modelMap.set(key, {
          ...item,
          categoryIndex,
          categoryName,
          categoryAbbr,
          modelIndexInMake,
          photoUrl: getModelPhotoUrl(
            item.CLASS,
            item.MAKE,
            item.MODEL,
            equipmentPhotos
          ),
          // Create searchable text combining all relevant fields
          searchText: [
            item.CLASS,
            item.MAKE,
            item.MODEL,
            item.CLASS_DESC,
            item.MAKE_DESC,
            item.MODEL_DESC,
            item.REMARKS,
          ]
            .filter((val) => val != null)
            .map((val) => String(val))
            .join(" ")
            .toLowerCase(),
        });
      }
    });

    return Array.from(modelMap.values());
  }, [standard, misc, categories, equipmentPhotos]);

  // Filter results based on search term
  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return [];

    const terms = searchTerm.toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return [];

    const results = searchableData.filter((item) => {
      // All terms must match somewhere in the searchText
      return terms.every((term) => item.searchText.includes(term));
    });

    // Sort by relevance (standard items first, then exact matches, then by MODEL)
    results.sort((a, b) => {
      // Standard items come before misc items
      if (a._source === "standard" && b._source === "misc") return -1;
      if (a._source === "misc" && b._source === "standard") return 1;

      const aModel = String(a.MODEL || "").toLowerCase();
      const bModel = String(b.MODEL || "").toLowerCase();
      const searchLower = searchTerm.toLowerCase();

      // Exact MODEL match first
      if (aModel === searchLower && bModel !== searchLower) return -1;
      if (bModel === searchLower && aModel !== searchLower) return 1;

      // MODEL starts with search term
      if (aModel.startsWith(searchLower) && !bModel.startsWith(searchLower))
        return -1;
      if (bModel.startsWith(searchLower) && !aModel.startsWith(searchLower))
        return 1;

      // Alphabetical by MODEL
      return aModel.localeCompare(bModel);
    });

    // Limit results
    return results.slice(0, 50);
  }, [searchTerm, searchableData]);

  // Handle click outside to close results
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowResults(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reset highlighted index when results change
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [searchResults]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && resultsRef.current) {
      const items = resultsRef.current.querySelectorAll(".search-result-item");
      if (items[highlightedIndex]) {
        items[highlightedIndex].scrollIntoView({
          block: "nearest",
          behavior: "smooth",
        });
      }
    }
  }, [highlightedIndex]);

  const handleKeyDown = (event) => {
    if (!showResults || searchResults.length === 0) return;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setHighlightedIndex((prev) =>
          prev < searchResults.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        event.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : searchResults.length - 1
        );
        break;
      case "Enter":
        event.preventDefault();
        if (highlightedIndex >= 0 && searchResults[highlightedIndex]) {
          handleSelectResult(searchResults[highlightedIndex]);
        }
        break;
      case "Escape":
        setShowResults(false);
        setHighlightedIndex(-1);
        break;
      default:
        break;
    }
  };

  const handleSelectResult = (result) => {
    // Clear the photo tooltip
    hoveredPhotoUrlRef.current = null;
    setHoveredPhoto(null);

    if (onSelectModel) {
      onSelectModel({
        categoryIndex: result.categoryIndex,
        categoryName: result.categoryName,
        categoryAbbr: result.categoryAbbr,
        classCode: result.CLASS,
        classDesc: result.CLASS_DESC,
        classSource: result._source,
        makeCode: result.MAKE,
        makeDesc: result.MAKE_DESC,
        makeSource: result._source,
        modelCode: result.MODEL,
        modelDesc: result.MODEL_DESC,
        modelIndexInMake: result.modelIndexInMake, // For pagination
        rentalRate: result.RENTAL_RATE,
        rwDelay: result.RW_DELAY,
        overtime: result.OVERTIME,
        source: result._source,
        photoUrl: result.photoUrl,
        beginDate: result.BEGIN_DATE,
        endDate: result.END_DATE,
        lastUpdateDate: result.LAST_UPDATE_DATE,
        remarks: result.REMARKS,
      });
    }
    setSearchTerm("");
    setShowResults(false);
  };

  // Highlight matching text in results
  const highlightMatch = (text, searchTerm) => {
    if (text == null || !searchTerm.trim()) return text;

    // Convert to string in case it's a number
    const textStr = String(text);
    const terms = searchTerm.toLowerCase().split(/\s+/).filter(Boolean);

    if (terms.length === 0) return textStr;

    // Build a single regex that matches any of the terms to avoid
    // multiple passes that could corrupt already-inserted <mark> tags
    const escapedTerms = terms.map((term) =>
      term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    );
    const combinedRegex = new RegExp(`(${escapedTerms.join("|")})`, "gi");

    return textStr.replace(combinedRegex, "<mark>$1</mark>");
  };

  return (
    <div className="equipment-search" ref={searchRef}>
      <div className="search-input-wrapper">
        <label htmlFor="equipment-search" className="visually-hidden">
          Search Equipment
        </label>
        <input
          type="text"
          id="equipment-search"
          name="equipment-search"
          className="search-input"
          placeholder="Search equipment by class, make, model, description..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setShowResults(true);
          }}
          onFocus={() => setShowResults(true)}
          onKeyDown={handleKeyDown}
          aria-label="Search equipment by class, make, model, description"
        />
        {searchTerm && (
          <button
            className="search-clear-btn"
            onClick={() => {
              setSearchTerm("");
              setShowResults(false);
            }}
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>

      {showResults && searchResults.length > 0 && (
        <div className="search-results" ref={resultsRef}>
          {searchResults.map((result, index) => (
            <div
              key={`${result.CLASS}-${result.MAKE}-${result.MODEL}`}
              className={`search-result-item ${
                index === highlightedIndex ? "highlighted" : ""
              } ${result._source === "misc" ? "misc-source" : ""}`}
              onClick={() => handleSelectResult(result)}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              <div className="result-content">
                <div className="result-model">
                  <span
                    className="result-model-code"
                    dangerouslySetInnerHTML={{
                      __html: highlightMatch(result.MODEL, searchTerm),
                    }}
                  />
                  {result.MODEL_DESC && (
                    <span
                      className="result-model-desc"
                      dangerouslySetInnerHTML={{
                        __html: ` - ${highlightMatch(
                          result.MODEL_DESC,
                          searchTerm
                        )}`,
                      }}
                    />
                  )}
                </div>
                <div className="result-hierarchy">
                  <span
                    dangerouslySetInnerHTML={{
                      __html: highlightMatch(result.CLASS, searchTerm),
                    }}
                  />
                  {result.CLASS_DESC && (
                    <span
                      className="result-desc"
                      dangerouslySetInnerHTML={{
                        __html: ` (${highlightMatch(
                          result.CLASS_DESC,
                          searchTerm
                        )})`,
                      }}
                    />
                  )}
                  <span className="separator"> → </span>
                  <span
                    dangerouslySetInnerHTML={{
                      __html: highlightMatch(result.MAKE, searchTerm),
                    }}
                  />
                  {result.MAKE_DESC && (
                    <span
                      className="result-desc"
                      dangerouslySetInnerHTML={{
                        __html: ` (${highlightMatch(
                          result.MAKE_DESC,
                          searchTerm
                        )})`,
                      }}
                    />
                  )}
                </div>
                {result.REMARKS && (
                  <div
                    className="result-remarks"
                    dangerouslySetInnerHTML={{
                      __html: highlightMatch(result.REMARKS, searchTerm),
                    }}
                  />
                )}
              </div>
              {result.photoUrl && (
                <div
                  className="result-photo"
                  onMouseEnter={(e) => {
                    const photoUrl = result.photoUrl;
                    hoveredPhotoUrlRef.current = photoUrl; // Track which URL we're hovering

                    const rect = e.currentTarget.getBoundingClientRect();
                    const padding = 10; // Padding from viewport edge
                    const maxSize = 400; // Maximum dimension
                    const borderPadding = 12; // Border (2px * 2) + padding (4px * 2)

                    // Preload image to get dimensions
                    const img = new Image();
                    img.onload = () => {
                      // Check if we're still hovering the same photo
                      if (hoveredPhotoUrlRef.current !== photoUrl) return;

                      const imgWidth = img.naturalWidth;
                      const imgHeight = img.naturalHeight;
                      const aspectRatio = imgWidth / imgHeight;

                      // Calculate tooltip size maintaining aspect ratio
                      let tooltipWidth, tooltipHeight;
                      if (aspectRatio >= 1) {
                        // Landscape or square
                        tooltipWidth = Math.min(maxSize, imgWidth);
                        tooltipHeight = tooltipWidth / aspectRatio;
                      } else {
                        // Portrait
                        tooltipHeight = Math.min(maxSize, imgHeight);
                        tooltipWidth = tooltipHeight * aspectRatio;
                      }

                      const totalWidth = tooltipWidth + borderPadding;
                      const totalHeight = tooltipHeight + borderPadding;

                      // Calculate initial position (to the left of thumbnail)
                      let left = rect.left - totalWidth - 10;
                      let top = rect.top;

                      // Adjust if tooltip goes off the left edge
                      if (left < padding) {
                        left = rect.right + 10;
                        if (left + totalWidth > window.innerWidth - padding) {
                          left = padding;
                        }
                      }

                      // Adjust if tooltip goes off the top edge
                      if (top < padding) {
                        top = padding;
                      }

                      // Adjust if tooltip goes off the bottom edge
                      if (top + totalHeight > window.innerHeight - padding) {
                        top = window.innerHeight - totalHeight - padding;
                      }

                      setHoveredPhoto({
                        url: result.photoUrl,
                        x: left,
                        y: top,
                        width: tooltipWidth,
                        height: tooltipHeight,
                      });
                    };
                    img.src = result.photoUrl;
                  }}
                  onMouseLeave={() => {
                    hoveredPhotoUrlRef.current = null;
                    setHoveredPhoto(null);
                  }}
                >
                  <img
                    src={result.photoUrl}
                    alt={result.MODEL}
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showResults && searchTerm.trim() && searchResults.length === 0 && (
        <div className="search-results">
          <div className="search-no-results">No matches found</div>
        </div>
      )}

      {/* Photo tooltip */}
      {hoveredPhoto && (
        <div
          className="photo-tooltip"
          style={{
            left: `${hoveredPhoto.x}px`,
            top: `${hoveredPhoto.y}px`,
            width: hoveredPhoto.width ? `${hoveredPhoto.width}px` : "auto",
            height: hoveredPhoto.height ? `${hoveredPhoto.height}px` : "auto",
          }}
        >
          <img src={hoveredPhoto.url} alt="Equipment" />
        </div>
      )}
    </div>
  );
}

export default EquipmentSearch;
