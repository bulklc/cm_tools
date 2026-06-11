import { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";
import { SunburstTooltip, useSunburstData, MODEL_PAGE_SIZE } from "./index";
import {
  baseColors,
  ANIMATION_DURATION,
  SEGMENT_GAP,
  RING_GAP_FRACTION,
  createRingConfig,
  LABEL_COLOR_STANDARD,
  LABEL_COLOR_MISC,
} from "./index";
import { clampTooltipPosition } from "./index";

const EquipmentSunburst = ({
  equipmentData = {},
  standard = [],
  misc = [],
  equipmentPhotos = null,
  onModelSelect = null,
  onCategorySelect = null,
  onClassSelect = null,
  onMakeSelect = null,
  activeCategory: controlledActiveCategory,
  setActiveCategory: controlledSetActiveCategory,
  activeClass: controlledActiveClass,
  setActiveClass: controlledSetActiveClass,
  activeMake: controlledActiveMake,
  setActiveMake: controlledSetActiveMake,
  focusedModelCode: controlledFocusedModelCode = null, // Model code to focus (from search)
  targetModelPage: controlledTargetModelPage = null, // Target page for pagination (from search)
  onFocusHandled = null, // Callback when focus has been applied (to clear the controlled prop)
}) => {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const tooltipRef = useRef(null);
  const prevActiveCategoryRef = useRef(null);
  const prevAnglesRef = useRef(null);
  const targetModelPageRef = useRef(null); // Store target page for immediate access

  // Keep ref updated with prop value
  targetModelPageRef.current = controlledTargetModelPage;

  // Use controlled state if provided, otherwise use local state
  const [localActiveCategory, localSetActiveCategory] = useState(null);
  const [localActiveClass, localSetActiveClass] = useState(null);
  const [localActiveMake, localSetActiveMake] = useState(null);

  const activeCategory =
    controlledActiveCategory !== undefined
      ? controlledActiveCategory
      : localActiveCategory;
  const setActiveCategory =
    controlledSetActiveCategory || localSetActiveCategory;
  const activeClass =
    controlledActiveClass !== undefined
      ? controlledActiveClass
      : localActiveClass;
  const setActiveClass = controlledSetActiveClass || localSetActiveClass;
  const activeMake =
    controlledActiveMake !== undefined ? controlledActiveMake : localActiveMake;
  const setActiveMake = controlledSetActiveMake || localSetActiveMake;

  const [tooltip, setTooltip] = useState({
    visible: false,
    x: 0,
    y: 0,
    content: "",
  });

  // Track currently focused model for keyboard navigation
  const [focusedModelIndex, setFocusedModelIndex] = useState(null);

  // Track if keyboard navigation is active (to show highlighting on current level)
  const [keyboardFocusActive, setKeyboardFocusActive] = useState(false);

  // Pagination state for models (when a make has more than MODEL_PAGE_SIZE models)
  const [modelPage, setModelPage] = useState(0);

  // Use the custom hook for data preparation
  const {
    categoryAngles,
    classData,
    makeData,
    modelData,
    classToMakeToModels,
  } = useSunburstData({
    equipmentData,
    standard,
    misc,
    activeCategory,
    activeClass,
    activeMake,
    equipmentPhotos,
    modelPage,
  });

  // Tooltip handler
  const handleTooltip = useCallback((action, event, data = {}) => {
    if (action === "show") {
      const [x, y] = d3.pointer(event, containerRef.current);
      const { x: clampedX, y: clampedY } = clampTooltipPosition(
        x + 10,
        y + 10,
        containerRef.current,
        tooltipRef.current
      );
      setTooltip({
        visible: true,
        x: clampedX,
        y: clampedY,
        ...data,
      });
    } else if (action === "move") {
      const [x, y] = d3.pointer(event, containerRef.current);
      const { x: clampedX, y: clampedY } = clampTooltipPosition(
        x + 10,
        y + 10,
        containerRef.current,
        tooltipRef.current
      );
      setTooltip((prev) => ({
        ...prev,
        x: clampedX,
        y: clampedY,
      }));
    } else if (action === "hide") {
      setTooltip((prev) => ({ ...prev, visible: false }));
    }
  }, []);

  // Get source label for tooltips
  // For models: show "Misc" instead of "Misc Only"
  // For classes/makes: only show badge if misc-only (return null otherwise)
  const getSourceLabel = (source, isModel = false) => {
    if (isModel) {
      // Models always show their source
      if (source === "misc") return "Misc";
      return null; // Don't show badge for standard models
    } else {
      // Classes/Makes only show badge if misc-only
      if (source === "misc") return "Misc Only";
      return null; // No badge for standard or mixed
    }
  };

  // Get representative photo for a class (models with ** or isClassThumbnail, or first available)
  const getClassPhoto = useCallback(
    (classCode) => {
      if (!equipmentPhotos?.classes) return null;
      const classEntry = equipmentPhotos.classes.find(
        (c) => c.class === classCode
      );
      if (!classEntry) return null;

      // First, find a model with class-level thumbnail flag
      for (const makeEntry of classEntry.makes) {
        const classThumbnailModel = makeEntry.models.find((m) => {
          if (typeof m === "object") {
            return m.isClassThumbnail;
          }
          // Legacy format: strings with ** suffix
          return m.endsWith("**");
        });
        if (classThumbnailModel) {
          if (typeof classThumbnailModel === "object") {
            if (classThumbnailModel.url) return classThumbnailModel.url;
            if (classThumbnailModel.filename)
              return `/equipment_photos/${classThumbnailModel.filename}`;
          }
          const modelCode = classThumbnailModel.replace(/\*+$/, "");
          return `/equipment_photos/${classCode}_${makeEntry.make}_${modelCode}.jpg`;
        }
      }

      // Fallback: use first available photo in this class
      for (const makeEntry of classEntry.makes) {
        if (makeEntry.models && makeEntry.models.length > 0) {
          const firstModel = makeEntry.models[0];
          if (typeof firstModel === "object") {
            if (firstModel.url) return firstModel.url;
            if (firstModel.filename)
              return `/equipment_photos/${firstModel.filename}`;
          }
          const modelCode =
            typeof firstModel === "string"
              ? firstModel.replace(/\*+$/, "")
              : firstModel.model;
          return `/equipment_photos/${classCode}_${makeEntry.make}_${modelCode}.jpg`;
        }
      }
      return null;
    },
    [equipmentPhotos]
  );

  // Get representative photo for a make (models with * or isMakeThumbnail, or first available)
  const getMakePhoto = useCallback(
    (classCode, makeCode) => {
      if (!equipmentPhotos?.classes) return null;
      const classEntry = equipmentPhotos.classes.find(
        (c) => c.class === classCode
      );
      if (!classEntry) return null;

      const makeEntry = classEntry.makes.find((m) => m.make === makeCode);
      if (!makeEntry) return null;

      // First look for make-level thumbnail, then class-level
      const makeThumbnailModel =
        makeEntry.models.find((m) => {
          if (typeof m === "object") {
            return m.isMakeThumbnail;
          }
          // Legacy format: single * but not ** or ***
          return m.endsWith("*") && !m.endsWith("**");
        }) ||
        makeEntry.models.find((m) => {
          if (typeof m === "object") {
            return m.isClassThumbnail;
          }
          return m.endsWith("**");
        });

      if (makeThumbnailModel) {
        if (typeof makeThumbnailModel === "object") {
          if (makeThumbnailModel.url) return makeThumbnailModel.url;
          if (makeThumbnailModel.filename)
            return `/equipment_photos/${makeThumbnailModel.filename}`;
        }
        const modelCode = makeThumbnailModel.replace(/\*+$/, "");
        return `/equipment_photos/${classCode}_${makeCode}_${modelCode}.jpg`;
      }

      // Fallback: use first available photo in this make
      if (makeEntry.models && makeEntry.models.length > 0) {
        const firstModel = makeEntry.models[0];
        if (typeof firstModel === "object") {
          if (firstModel.url) return firstModel.url;
          if (firstModel.filename)
            return `/equipment_photos/${firstModel.filename}`;
        }
        const modelCode =
          typeof firstModel === "string"
            ? firstModel.replace(/\*+$/, "")
            : firstModel.model;
        return `/equipment_photos/${classCode}_${makeCode}_${modelCode}.jpg`;
      }
      return null;
    },
    [equipmentPhotos]
  );

  // Get representative photo for a category (models with *** or isCategoryThumbnail, or first available)
  const getCategoryPhoto = useCallback(
    (categoryData) => {
      if (!equipmentPhotos?.classes || !categoryData?.classes) return null;

      // First, search for explicit category thumbnail
      for (const cls of categoryData.classes) {
        const classEntry = equipmentPhotos.classes.find(
          (c) => c.class === cls.CLASS
        );
        if (!classEntry) continue;

        for (const makeEntry of classEntry.makes) {
          const categoryThumbnailModel = makeEntry.models.find((m) => {
            if (typeof m === "object") {
              return m.isCategoryThumbnail;
            }
            return m.endsWith("***");
          });
          if (categoryThumbnailModel) {
            if (typeof categoryThumbnailModel === "object") {
              if (categoryThumbnailModel.url) return categoryThumbnailModel.url;
              if (categoryThumbnailModel.filename)
                return `/equipment_photos/${categoryThumbnailModel.filename}`;
            }
            const modelCode = categoryThumbnailModel.replace(/\*+$/, "");
            return `/equipment_photos/${cls.CLASS}_${makeEntry.make}_${modelCode}.jpg`;
          }
        }
      }

      // Fallback: use first available photo in this category
      for (const cls of categoryData.classes) {
        const classEntry = equipmentPhotos.classes.find(
          (c) => c.class === cls.CLASS
        );
        if (!classEntry) continue;

        for (const makeEntry of classEntry.makes) {
          if (makeEntry.models && makeEntry.models.length > 0) {
            const firstModel = makeEntry.models[0];
            if (typeof firstModel === "object") {
              if (firstModel.url) return firstModel.url;
              if (firstModel.filename)
                return `/equipment_photos/${firstModel.filename}`;
            }
            const modelCode =
              typeof firstModel === "string"
                ? firstModel.replace(/\*+$/, "")
                : firstModel.model;
            return `/equipment_photos/${cls.CLASS}_${makeEntry.make}_${modelCode}.jpg`;
          }
        }
      }
      return null;
    },
    [equipmentPhotos]
  );

  // Reset focused model and pagination when make changes
  // If a target page is provided (from search), use that instead of resetting to 0
  useEffect(() => {
    setFocusedModelIndex(null);
    // Use the ref to get the most current value of targetModelPage
    const targetPage = targetModelPageRef.current;
    if (targetPage !== null) {
      setModelPage(targetPage);
    } else {
      setModelPage(0);
    }
  }, [activeMake]);

  // Set focus when controlledFocusedModelCode is provided (from search)
  // The page is already set correctly by the reset effect above
  useEffect(() => {
    if (controlledFocusedModelCode && activeMake) {
      // Find the model in the current page's modelData
      const modelsInMake = modelData.filter((m) => m.makeCode === activeMake);
      const modelIndex = modelsInMake.findIndex(
        (m) =>
          !m.isPaginationNav &&
          String(m.MODEL) === String(controlledFocusedModelCode)
      );

      if (modelIndex !== -1) {
        setFocusedModelIndex(modelIndex);
        setKeyboardFocusActive(true);

        // Notify parent that focus has been handled so it can clear the prop
        // This allows keyboard navigation to work without bouncing back
        if (onFocusHandled) {
          onFocusHandled();
        }
      }
    }
  }, [controlledFocusedModelCode, activeMake, modelData, onFocusHandled]);

  // Resolve special focus indices after page change
  // -1 means "first actual model on page", -2 means "last actual model on page"
  useEffect(() => {
    if (focusedModelIndex === -1 || focusedModelIndex === -2) {
      const modelsInMake = modelData.filter((m) => m.makeCode === activeMake);
      // Find actual models (exclude pagination nav segments)
      const actualModelIndices = modelsInMake
        .map((m, i) => (!m.isPaginationNav ? i : -1))
        .filter((i) => i >= 0);

      if (actualModelIndices.length > 0) {
        const targetIndex =
          focusedModelIndex === -1
            ? actualModelIndices[0] // First actual model
            : actualModelIndices[actualModelIndices.length - 1]; // Last actual model

        setFocusedModelIndex(targetIndex);

        // Also notify parent of the selection
        const selectedModel = modelsInMake[targetIndex];
        if (onModelSelect && selectedModel && !selectedModel.isPaginationNav) {
          onModelSelect({
            categoryIndex: selectedModel.categoryIndex,
            categoryName: selectedModel.categoryName,
            categoryAbbr: selectedModel.categoryAbbr,
            classCode: selectedModel.classCode,
            classDesc: selectedModel.CLASS_DESC,
            classSource: selectedModel.classSource,
            makeCode: selectedModel.makeCode,
            makeDesc: selectedModel.makeDesc,
            makeSource: selectedModel.makeSource,
            modelCode: selectedModel.MODEL,
            modelDesc: selectedModel.MODEL_DESC,
            rentalRate: selectedModel.RENTAL_RATE,
            rwDelay: selectedModel.RW_DELAY,
            overtime: selectedModel.OVERTIME,
            source: selectedModel.source,
            photoUrl: selectedModel.photoUrl,
            beginDate: selectedModel.BEGIN_DATE,
            endDate: selectedModel.END_DATE,
            lastUpdateDate: selectedModel.LAST_UPDATE_DATE,
            remarks: selectedModel.REMARKS,
          });
        }
      }
    }
  }, [focusedModelIndex, modelData, activeMake, onModelSelect]);

  // Keyboard navigation handler
  // Left/Right: Navigate between siblings at current level
  // Up: Drill down (go deeper into hierarchy)
  // Down: Zoom out (go back up the hierarchy)
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Only handle arrow keys
      if (
        !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
      )
        return;

      // Don't intercept arrow keys when user is in an input field (e.g., search bar)
      const activeElement = document.activeElement;
      const isInputActive =
        activeElement &&
        (activeElement.tagName === "INPUT" ||
          activeElement.tagName === "TEXTAREA" ||
          activeElement.isContentEditable);
      if (isInputActive) return;

      // Prevent default scrolling behavior
      event.preventDefault();

      // Enable keyboard focus highlighting
      setKeyboardFocusActive(true);

      const isHorizontal =
        event.key === "ArrowLeft" || event.key === "ArrowRight";
      const direction =
        event.key === "ArrowRight" || event.key === "ArrowUp" ? 1 : -1;

      if (isHorizontal) {
        // LEFT/RIGHT: Navigate between siblings at current level
        // The "current level" is determined by what is actively selected at the deepest point
        if (focusedModelIndex !== null && activeMake !== null) {
          // Level 4: Navigate between models (we have a focused model)
          const modelsInMake = modelData.filter(
            (m) => m.makeCode === activeMake
          );
          if (modelsInMake.length === 0) return;

          // Find actual models (non-navigation segments) for boundary detection
          const actualModelIndices = modelsInMake
            .map((m, i) => (!m.isPaginationNav ? i : -1))
            .filter((i) => i >= 0);

          if (actualModelIndices.length === 0) return;

          const firstActualIndex = actualModelIndices[0];
          const lastActualIndex =
            actualModelIndices[actualModelIndices.length - 1];

          // Check if we need pagination info
          const hasPrevNav = modelsInMake.some(
            (m) => m.isPaginationNav && m.paginationDirection === "prev"
          );
          const hasNextNav = modelsInMake.some(
            (m) => m.isPaginationNav && m.paginationDirection === "next"
          );
          const paginationInfo = modelsInMake.find((m) => m.isPaginationNav);
          const totalPages = paginationInfo?.totalPages || 1;
          const currentPage = paginationInfo?.currentPage || 0;
          const needsPagination = totalPages > 1;

          // Handle boundary wrap-around with pagination
          if (direction === -1 && focusedModelIndex === firstActualIndex) {
            // Going left from first actual model
            if (hasPrevNav) {
              // There's a previous page, go to it and focus last model
              setModelPage((prev) => Math.max(0, prev - 1));
              setFocusedModelIndex(-2); // Last model on previous page
            } else if (needsPagination) {
              // On first page but there are other pages - wrap to last page, last model
              setModelPage(totalPages - 1);
              setFocusedModelIndex(-2); // Last model on last page
            } else {
              // No pagination, just wrap to last model on current page
              setFocusedModelIndex(lastActualIndex);
              const selectedModel = modelsInMake[lastActualIndex];
              if (onModelSelect && selectedModel) {
                onModelSelect({
                  categoryIndex: selectedModel.categoryIndex,
                  categoryName: selectedModel.categoryName,
                  categoryAbbr: selectedModel.categoryAbbr,
                  classCode: selectedModel.classCode,
                  classDesc: selectedModel.CLASS_DESC,
                  classSource: selectedModel.classSource,
                  makeCode: selectedModel.makeCode,
                  makeDesc: selectedModel.makeDesc,
                  makeSource: selectedModel.makeSource,
                  modelCode: selectedModel.MODEL,
                  modelDesc: selectedModel.MODEL_DESC,
                  rentalRate: selectedModel.RENTAL_RATE,
                  rwDelay: selectedModel.RW_DELAY,
                  overtime: selectedModel.OVERTIME,
                  source: selectedModel.source,
                  photoUrl: selectedModel.photoUrl,
                  beginDate: selectedModel.BEGIN_DATE,
                  endDate: selectedModel.END_DATE,
                  lastUpdateDate: selectedModel.LAST_UPDATE_DATE,
                  remarks: selectedModel.REMARKS,
                });
              }
            }
            return;
          } else if (direction === 1 && focusedModelIndex === lastActualIndex) {
            // Going right from last actual model
            if (hasNextNav) {
              // There's a next page, go to it and focus first model
              setModelPage((prev) => prev + 1);
              setFocusedModelIndex(-1); // First model on next page
            } else if (needsPagination) {
              // On last page but there are other pages - wrap to first page, first model
              setModelPage(0);
              setFocusedModelIndex(-1); // First model on first page
            } else {
              // No pagination, just wrap to first model
              setFocusedModelIndex(firstActualIndex);
              const selectedModel = modelsInMake[firstActualIndex];
              if (onModelSelect && selectedModel) {
                onModelSelect({
                  categoryIndex: selectedModel.categoryIndex,
                  categoryName: selectedModel.categoryName,
                  categoryAbbr: selectedModel.categoryAbbr,
                  classCode: selectedModel.classCode,
                  classDesc: selectedModel.CLASS_DESC,
                  classSource: selectedModel.classSource,
                  makeCode: selectedModel.makeCode,
                  makeDesc: selectedModel.makeDesc,
                  makeSource: selectedModel.makeSource,
                  modelCode: selectedModel.MODEL,
                  modelDesc: selectedModel.MODEL_DESC,
                  rentalRate: selectedModel.RENTAL_RATE,
                  rwDelay: selectedModel.RW_DELAY,
                  overtime: selectedModel.OVERTIME,
                  source: selectedModel.source,
                  photoUrl: selectedModel.photoUrl,
                  beginDate: selectedModel.BEGIN_DATE,
                  endDate: selectedModel.END_DATE,
                  lastUpdateDate: selectedModel.LAST_UPDATE_DATE,
                  remarks: selectedModel.REMARKS,
                });
              }
            }
            return;
          }

          // Normal navigation within page (not at boundary)
          let newIndex = focusedModelIndex + direction;

          // Skip over navigation segments
          while (
            newIndex >= 0 &&
            newIndex < modelsInMake.length &&
            modelsInMake[newIndex]?.isPaginationNav
          ) {
            newIndex += direction;
          }

          // If we've gone out of bounds, this shouldn't happen due to boundary checks above
          if (newIndex < 0 || newIndex >= modelsInMake.length) {
            return;
          }

          const selectedModel = modelsInMake[newIndex];

          setFocusedModelIndex(newIndex);

          if (onModelSelect && selectedModel) {
            onModelSelect({
              categoryIndex: selectedModel.categoryIndex,
              categoryName: selectedModel.categoryName,
              categoryAbbr: selectedModel.categoryAbbr,
              classCode: selectedModel.classCode,
              classDesc: selectedModel.CLASS_DESC,
              classSource: selectedModel.classSource,
              makeCode: selectedModel.makeCode,
              makeDesc: selectedModel.makeDesc,
              makeSource: selectedModel.makeSource,
              modelCode: selectedModel.MODEL,
              modelDesc: selectedModel.MODEL_DESC,
              rentalRate: selectedModel.RENTAL_RATE,
              rwDelay: selectedModel.RW_DELAY,
              overtime: selectedModel.OVERTIME,
              source: selectedModel.source,
              photoUrl: selectedModel.photoUrl,
              beginDate: selectedModel.BEGIN_DATE,
              endDate: selectedModel.END_DATE,
              lastUpdateDate: selectedModel.LAST_UPDATE_DATE,
              remarks: selectedModel.REMARKS,
            });
          }
        } else if (activeMake !== null) {
          // Level 3: Navigate between makes within the active class
          const makesInClass = makeData.filter(
            (m) => m.classCode === activeClass
          );
          if (makesInClass.length === 0) return;

          const currentMakeIndex = makesInClass.findIndex(
            (m) => m.MAKE === activeMake
          );
          if (currentMakeIndex === -1) return;

          let newIndex = currentMakeIndex + direction;
          if (newIndex < 0) newIndex = makesInClass.length - 1;
          if (newIndex >= makesInClass.length) newIndex = 0;

          const selectedMake = makesInClass[newIndex];
          setActiveMake(selectedMake.MAKE);

          if (onMakeSelect && selectedMake) {
            onMakeSelect({
              categoryIndex: selectedMake.categoryIndex,
              categoryName: selectedMake.categoryName,
              categoryAbbr: selectedMake.categoryAbbr,
              classCode: selectedMake.classCode,
              classDesc: selectedMake.classDesc,
              classSource: selectedMake.classSource,
              makeCode: selectedMake.MAKE,
              makeDesc: selectedMake.MAKE_DESC,
              makeSource: selectedMake.source,
            });
          }
        } else if (activeClass !== null) {
          // Level 2: Navigate between classes within the active category
          const classesInCategory = classData.filter(
            (c) => c.categoryIndex === activeCategory
          );
          if (classesInCategory.length === 0) return;

          const currentClassIndex = classesInCategory.findIndex(
            (c) => c.CLASS === activeClass
          );
          if (currentClassIndex === -1) return;

          let newIndex = currentClassIndex + direction;
          if (newIndex < 0) newIndex = classesInCategory.length - 1;
          if (newIndex >= classesInCategory.length) newIndex = 0;

          const selectedClass = classesInCategory[newIndex];
          setActiveClass(selectedClass.CLASS);
          setActiveMake(null);

          if (onClassSelect && selectedClass) {
            onClassSelect({
              categoryIndex: selectedClass.categoryIndex,
              categoryName: selectedClass.categoryName,
              categoryAbbr: selectedClass.categoryAbbr,
              classCode: selectedClass.CLASS,
              classDesc: selectedClass.CLASS_DESC,
              classSource: selectedClass.source,
            });
          }
        } else if (activeCategory !== null) {
          // Level 1: Navigate between categories
          if (!equipmentData?.categories?.length) return;

          const totalCategories = equipmentData.categories.length;
          let newIndex = activeCategory + direction;
          if (newIndex < 0) newIndex = totalCategories - 1;
          if (newIndex >= totalCategories) newIndex = 0;

          setActiveCategory(newIndex);
          setActiveClass(null);
          setActiveMake(null);

          const selectedCategory = equipmentData.categories[newIndex];
          if (onCategorySelect && selectedCategory) {
            onCategorySelect({
              categoryIndex: newIndex,
              categoryName: selectedCategory.category,
              categoryAbbr: selectedCategory.abbr,
            });
          }
        } else {
          // No selection at all - select first or last category
          if (!equipmentData?.categories?.length) return;

          const totalCategories = equipmentData.categories.length;
          const newIndex = direction === 1 ? 0 : totalCategories - 1;

          setActiveCategory(newIndex);
          setActiveClass(null);
          setActiveMake(null);

          const selectedCategory = equipmentData.categories[newIndex];
          if (onCategorySelect && selectedCategory) {
            onCategorySelect({
              categoryIndex: newIndex,
              categoryName: selectedCategory.category,
              categoryAbbr: selectedCategory.abbr,
            });
          }
        }
      } else if (event.key === "ArrowUp") {
        // UP: Drill down (go deeper into hierarchy)
        if (activeMake !== null) {
          // Already at model level with a make selected
          // If no model focused, focus first model
          if (focusedModelIndex === null) {
            const modelsInMake = modelData.filter(
              (m) => m.makeCode === activeMake
            );
            if (modelsInMake.length > 0) {
              setFocusedModelIndex(0);
              const selectedModel = modelsInMake[0];
              if (onModelSelect && selectedModel) {
                onModelSelect({
                  categoryIndex: selectedModel.categoryIndex,
                  categoryName: selectedModel.categoryName,
                  categoryAbbr: selectedModel.categoryAbbr,
                  classCode: selectedModel.classCode,
                  classDesc: selectedModel.CLASS_DESC,
                  classSource: selectedModel.classSource,
                  makeCode: selectedModel.makeCode,
                  makeDesc: selectedModel.makeDesc,
                  makeSource: selectedModel.makeSource,
                  modelCode: selectedModel.MODEL,
                  modelDesc: selectedModel.MODEL_DESC,
                  rentalRate: selectedModel.RENTAL_RATE,
                  rwDelay: selectedModel.RW_DELAY,
                  overtime: selectedModel.OVERTIME,
                  source: selectedModel.source,
                  photoUrl: selectedModel.photoUrl,
                  beginDate: selectedModel.BEGIN_DATE,
                  endDate: selectedModel.END_DATE,
                  lastUpdateDate: selectedModel.LAST_UPDATE_DATE,
                  remarks: selectedModel.REMARKS,
                });
              }
            }
          }
          // If already focused on a model, do nothing (deepest level)
        } else if (activeClass !== null) {
          // Drill down: Select first make in this class
          const makesInClass = makeData.filter(
            (m) => m.classCode === activeClass
          );
          if (makesInClass.length > 0) {
            const selectedMake = makesInClass[0];
            setActiveMake(selectedMake.MAKE);

            if (onMakeSelect && selectedMake) {
              onMakeSelect({
                categoryIndex: selectedMake.categoryIndex,
                categoryName: selectedMake.categoryName,
                categoryAbbr: selectedMake.categoryAbbr,
                classCode: selectedMake.classCode,
                classDesc: selectedMake.classDesc,
                classSource: selectedMake.classSource,
                makeCode: selectedMake.MAKE,
                makeDesc: selectedMake.MAKE_DESC,
                makeSource: selectedMake.source,
              });
            }
          }
        } else if (activeCategory !== null) {
          // Drill down: Select first class in this category
          const classesInCategory = classData.filter(
            (c) => c.categoryIndex === activeCategory
          );
          if (classesInCategory.length > 0) {
            const selectedClass = classesInCategory[0];
            setActiveClass(selectedClass.CLASS);

            if (onClassSelect && selectedClass) {
              onClassSelect({
                categoryIndex: selectedClass.categoryIndex,
                categoryName: selectedClass.categoryName,
                categoryAbbr: selectedClass.categoryAbbr,
                classCode: selectedClass.CLASS,
                classDesc: selectedClass.CLASS_DESC,
                classSource: selectedClass.source,
              });
            }
          }
        } else {
          // No category selected, select first category
          if (equipmentData?.categories?.length > 0) {
            setActiveCategory(0);
            setActiveClass(null);
            setActiveMake(null);

            const selectedCategory = equipmentData.categories[0];
            if (onCategorySelect && selectedCategory) {
              onCategorySelect({
                categoryIndex: 0,
                categoryName: selectedCategory.category,
                categoryAbbr: selectedCategory.abbr,
              });
            }
          }
        }
      } else if (event.key === "ArrowDown") {
        // DOWN: Zoom out (go back up the hierarchy)
        if (focusedModelIndex !== null) {
          // Unfocus model, stay at make level
          setFocusedModelIndex(null);
        } else if (activeMake !== null) {
          // Go back to class level
          setActiveMake(null);
          // Notify parent
          if (onClassSelect && activeClass) {
            const activeClassData = classData.find(
              (c) => c.CLASS === activeClass
            );
            if (activeClassData) {
              onClassSelect({
                categoryIndex: activeClassData.categoryIndex,
                categoryName: activeClassData.categoryName,
                categoryAbbr: activeClassData.categoryAbbr,
                classCode: activeClassData.CLASS,
                classDesc: activeClassData.CLASS_DESC,
                classSource: activeClassData.source,
              });
            }
          }
        } else if (activeClass !== null) {
          // Go back to category level
          setActiveClass(null);
          setActiveMake(null);
          // Notify parent
          if (onCategorySelect && activeCategory !== null) {
            const selectedCategory = equipmentData.categories[activeCategory];
            if (selectedCategory) {
              onCategorySelect({
                categoryIndex: activeCategory,
                categoryName: selectedCategory.category,
                categoryAbbr: selectedCategory.abbr,
              });
            }
          }
        } else if (activeCategory !== null) {
          // Go back to no selection
          setActiveCategory(null);
          setActiveClass(null);
          setActiveMake(null);
          // Notify parent to clear selection
          if (onCategorySelect) {
            onCategorySelect(null);
          }
        }
        // If nothing selected, do nothing
      }
    };

    // Add event listener
    window.addEventListener("keydown", handleKeyDown);

    // Cleanup
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    equipmentData,
    activeCategory,
    activeClass,
    activeMake,
    classData,
    makeData,
    modelData,
    focusedModelIndex,
    modelPage,
    setActiveCategory,
    setActiveClass,
    setActiveMake,
    onCategorySelect,
    onClassSelect,
    onMakeSelect,
    onModelSelect,
  ]);

  useEffect(() => {
    if (
      !equipmentData?.categories?.length ||
      !svgRef.current ||
      !containerRef.current
    )
      return;

    const animationDuration = ANIMATION_DURATION;
    const segmentGap = SEGMENT_GAP;

    // Get dimensions
    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;
    const size = Math.min(containerWidth, containerHeight);
    const radius = size / 2;
    const ringGap = radius * RING_GAP_FRACTION;
    const ringConfig = createRingConfig(radius, ringGap);

    const isInitialRender = d3
      .select(svgRef.current)
      .select("g.main-group")
      .empty();
    const prevActiveCategory = prevActiveCategoryRef.current;
    const isExpanding = prevActiveCategory === null && activeCategory !== null;

    if (isInitialRender) {
      d3.select(svgRef.current).selectAll("*").remove();
    }

    // Create or select SVG group
    let svg;
    if (isInitialRender) {
      svg = d3
        .select(svgRef.current)
        .attr("width", size)
        .attr("height", size)
        .append("g")
        .attr("class", "main-group")
        .attr("transform", `translate(${size / 2},${size / 2})`);
    } else {
      svg = d3.select(svgRef.current).select("g.main-group");
    }

    const color = d3.scaleOrdinal(baseColors);
    const totalCategories = equipmentData.categories.length;

    // Previous angles for animation
    const prevAngles =
      prevAnglesRef.current ||
      categoryAngles.map((a, i) => ({
        startAngle: (i / totalCategories) * 2 * Math.PI,
        endAngle: ((i + 1) / totalCategories) * 2 * Math.PI,
        isActive: false,
      }));

    // ============ CATEGORY RING ============
    const categoryArcGenerator = d3
      .arc()
      .innerRadius(ringConfig.ring1Inner)
      .outerRadius(ringConfig.ring1Outer)
      .cornerRadius(4);

    const createCategoryArcPath = (startAngle, endAngle) => {
      return categoryArcGenerator({ startAngle, endAngle });
    };

    const categoryArcs = svg
      .selectAll("path.category-arc")
      .data(equipmentData.categories, (d, i) => i);

    const categoryArcsEnter = categoryArcs
      .enter()
      .append("path")
      .attr("class", "category-arc")
      .attr("d", (d, i) =>
        createCategoryArcPath(prevAngles[i].startAngle, prevAngles[i].endAngle)
      )
      .style("fill", (d, i) => color(i))
      .style("stroke", "#fff")
      .style("stroke-width", 2)
      .style("cursor", "pointer")
      .style("opacity", (d, i) =>
        activeCategory === null || i === activeCategory ? 0.85 : 0.5
      );

    categoryArcs
      .merge(categoryArcsEnter)
      .transition()
      .duration(animationDuration)
      .ease(d3.easeCubicInOut)
      .attrTween("d", function (d, i) {
        const prevStart =
          prevAngles[i]?.startAngle ?? categoryAngles[i].startAngle;
        const prevEnd = prevAngles[i]?.endAngle ?? categoryAngles[i].endAngle;
        const interpolateStart = d3.interpolate(
          prevStart,
          categoryAngles[i].startAngle
        );
        const interpolateEnd = d3.interpolate(
          prevEnd,
          categoryAngles[i].endAngle
        );
        return function (t) {
          return createCategoryArcPath(interpolateStart(t), interpolateEnd(t));
        };
      })
      .style("opacity", (d, i) =>
        activeCategory === null || i === activeCategory ? 0.85 : 0.5
      );

    // Apply keyboard focus highlighting to categories
    const isCategoryKeyboardFocused = (i) =>
      keyboardFocusActive && activeCategory === i && activeClass === null;

    svg
      .selectAll("path.category-arc")
      .style("stroke", (d, i) =>
        isCategoryKeyboardFocused(i) ? "#017dc3" : "#fff"
      )
      .style("stroke-width", (d, i) => (isCategoryKeyboardFocused(i) ? 4 : 2));

    // Category event handlers
    svg
      .selectAll("path.category-arc")
      .style("cursor", "pointer")
      .on("click", function (event, d) {
        setKeyboardFocusActive(true);
        const index = equipmentData.categories.indexOf(d);

        // If there's an active class or make, clicking any category should zoom to that category level
        // (not deselect the category entirely)
        if (activeClass !== null || activeMake !== null) {
          // Clicking any category when class/make is selected: zoom to category level
          setActiveCategory(index);
          setActiveClass(null);
          setActiveMake(null);
          setFocusedModelIndex(null);
          // Notify parent of category selection
          if (onCategorySelect) {
            onCategorySelect({
              categoryIndex: index,
              categoryName: d.category,
              categoryAbbr: d.abbr,
            });
          }
          // Immediately apply focus highlighting to clicked element
          svg
            .selectAll("path.category-arc")
            .style("stroke", "#fff")
            .style("stroke-width", 2);
          svg
            .selectAll("path.class-arc")
            .style("stroke", "#fff")
            .style("stroke-width", 2);
          svg
            .selectAll("path.make-arc")
            .style("stroke", "#fff")
            .style("stroke-width", 1);
          d3.select(this).style("stroke", "#017dc3").style("stroke-width", 4);
          return;
        }

        const isDeselecting = activeCategory === index;
        if (isDeselecting) {
          setActiveCategory(null);
          // Notify parent to clear selection
          if (onCategorySelect) {
            onCategorySelect(null);
          }
          // Remove highlighting from this element
          d3.select(this).style("stroke", "#fff").style("stroke-width", 2);
        } else {
          setActiveCategory(index);
          // Notify parent of category selection
          if (onCategorySelect) {
            onCategorySelect({
              categoryIndex: index,
              categoryName: d.category,
              categoryAbbr: d.abbr,
            });
          }
          // Immediately apply focus highlighting to clicked element
          svg
            .selectAll("path.category-arc")
            .style("stroke", "#fff")
            .style("stroke-width", 2);
          d3.select(this).style("stroke", "#017dc3").style("stroke-width", 4);
        }
        setActiveClass(null);
        setActiveMake(null);
        setFocusedModelIndex(null);
      })
      .on("dblclick", function (event, d) {
        // Treat double-click same as single click for rings 1-3
        event.preventDefault();
        const index = equipmentData.categories.indexOf(d);
        if (activeCategory === index) {
          setActiveCategory(null);
        } else {
          setActiveCategory(index);
        }
        setActiveClass(null);
        setActiveMake(null);
      })
      .on("mouseover", function (event, d) {
        d3.select(this).style("opacity", 1).style("stroke-width", 3);
        handleTooltip("show", event, {
          content: d.category,
          classCount: d.classes.length,
          photoUrl: getCategoryPhoto(d),
        });
      })
      .on("mousemove", function (event) {
        handleTooltip("move", event);
      })
      .on("mouseout", function () {
        const index = equipmentData.categories.indexOf(d3.select(this).datum());
        const isKeyboardFocused =
          keyboardFocusActive &&
          activeCategory === index &&
          activeClass === null;
        d3.select(this)
          .style(
            "opacity",
            activeCategory === null || index === activeCategory ? 0.85 : 0.5
          )
          .style("stroke", isKeyboardFocused ? "#017dc3" : "#fff")
          .style("stroke-width", isKeyboardFocused ? 4 : 2);
        handleTooltip("hide");
      });

    // Category labels
    const categoryLabelRadius =
      (ringConfig.ring1Inner + ringConfig.ring1Outer) / 2;
    const categoryLabels = svg
      .selectAll("text.category-label")
      .data(equipmentData.categories, (d, i) => i);

    const categoryLabelsEnter = categoryLabels
      .enter()
      .append("text")
      .attr("class", "category-label")
      .attr("text-anchor", "middle")
      .attr("alignment-baseline", "middle")
      .attr("font-size", "0.7rem")
      .attr("font-weight", (d) => (getCategoryPhoto(d) ? "bold" : "normal"))
      .attr("fill", LABEL_COLOR_STANDARD)
      .attr("pointer-events", "none")
      .text((d) => d.abbr);

    categoryLabels
      .merge(categoryLabelsEnter)
      .attr("font-weight", (d) => (getCategoryPhoto(d) ? "bold" : "normal"))
      .transition()
      .duration(animationDuration)
      .ease(d3.easeCubicInOut)
      .attrTween("transform", function (d, i) {
        const prevMidAngle =
          (prevAngles[i].startAngle + prevAngles[i].endAngle) / 2;
        const newMidAngle =
          (categoryAngles[i].startAngle + categoryAngles[i].endAngle) / 2;
        const interpolateMidAngle = d3.interpolate(prevMidAngle, newMidAngle);
        return function (t) {
          const currentMidAngle = interpolateMidAngle(t);
          const x = categoryLabelRadius * Math.sin(currentMidAngle);
          const y = -categoryLabelRadius * Math.cos(currentMidAngle);
          let textAngle = (currentMidAngle * 180) / Math.PI - 90;
          if (textAngle > 90 || textAngle < -90) textAngle += 180;
          return `translate(${x},${y}) rotate(${textAngle})`;
        };
      })
      .style("opacity", (d, i) =>
        activeCategory === null || i === activeCategory ? 0.95 : 0
      );

    // ============ CLASS RING ============
    const classArcGenerator = d3.arc().cornerRadius(4);
    const createClassArcPath = (startAngle, endAngle, innerR, outerR) => {
      return classArcGenerator({
        startAngle,
        endAngle,
        innerRadius: innerR,
        outerRadius: outerR,
      });
    };

    // Capture current class angles
    const capturedClassAngles = {};
    svg.selectAll("path.class-arc").each(function () {
      const el = d3.select(this);
      const currentData = el.datum();
      if (currentData) {
        const key = `${currentData.categoryIndex}-${currentData.CLASS}`;
        capturedClassAngles[key] = {
          startAngle: currentData.startAngle,
          endAngle: currentData.endAngle,
        };
      }
    });

    const classArcs = svg
      .selectAll("path.class-arc")
      .data(classData, (d) => `${d.categoryIndex}-${d.CLASS}`);

    classArcs
      .exit()
      .transition()
      .duration(animationDuration / 2)
      .ease(d3.easeCubicIn)
      .attrTween("d", function (d) {
        const interpolateOuter = d3.interpolate(
          ringConfig.ring2Outer,
          ringConfig.ring2Inner
        );
        return function (t) {
          return createClassArcPath(
            d.startAngle,
            d.endAngle,
            ringConfig.ring2Inner,
            interpolateOuter(t)
          );
        };
      })
      .style("opacity", 0)
      .remove();

    const classArcsEnter = classArcs
      .enter()
      .append("path")
      .attr("class", "class-arc")
      .attr("d", (d) =>
        createClassArcPath(
          d.startAngle,
          d.endAngle,
          ringConfig.ring2Inner,
          ringConfig.ring2Inner + 2
        )
      )
      .style("fill", (d) => baseColors[d.categoryIndex % baseColors.length])
      .style("stroke", "#fff")
      .style("stroke-width", 2)
      .style("cursor", "pointer")
      .style("opacity", 0);

    classArcsEnter
      .transition()
      .delay(isExpanding ? animationDuration * 0.6 : 0)
      .duration(animationDuration * 0.6)
      .ease(d3.easeCubicOut)
      .attrTween("d", function (d) {
        const interpolateOuter = d3.interpolate(
          ringConfig.ring2Inner + 2,
          ringConfig.ring2Outer
        );
        return function (t) {
          return createClassArcPath(
            d.startAngle,
            d.endAngle,
            ringConfig.ring2Inner,
            interpolateOuter(t)
          );
        };
      })
      .style("opacity", 0.85);

    classArcs
      .transition("classExpand")
      .duration(animationDuration)
      .ease(d3.easeCubicInOut)
      .attrTween("d", function (d) {
        const key = `${d.categoryIndex}-${d.CLASS}`;
        const prevClassAngles = capturedClassAngles[key] || {
          startAngle: d.startAngle,
          endAngle: d.endAngle,
        };
        const interpolateStart = d3.interpolate(
          prevClassAngles.startAngle,
          d.startAngle
        );
        const interpolateEnd = d3.interpolate(
          prevClassAngles.endAngle,
          d.endAngle
        );
        return function (t) {
          return createClassArcPath(
            interpolateStart(t),
            interpolateEnd(t),
            ringConfig.ring2Inner,
            ringConfig.ring2Outer
          );
        };
      })
      .style("opacity", (d) =>
        activeClass === null || d.CLASS === activeClass ? 0.85 : 0.5
      );

    // Apply keyboard focus highlighting to classes
    const isClassKeyboardFocused = (d) =>
      keyboardFocusActive && activeClass === d.CLASS && activeMake === null;

    svg
      .selectAll("path.class-arc")
      .style("stroke", (d) => (isClassKeyboardFocused(d) ? "#017dc3" : "#fff"))
      .style("stroke-width", (d) => (isClassKeyboardFocused(d) ? 4 : 2));

    // Class event handlers
    svg
      .selectAll("path.class-arc")
      .style("cursor", "pointer")
      .on("click", function (event, d) {
        setKeyboardFocusActive(true);

        // If there's an active make, clicking any class should zoom to that class level
        // (not deselect the class entirely)
        if (activeMake !== null) {
          // Clicking any class when make is selected: zoom to class level
          setActiveClass(d.CLASS);
          setActiveMake(null);
          setFocusedModelIndex(null);
          // Notify parent of class selection
          if (onClassSelect) {
            onClassSelect({
              categoryIndex: d.categoryIndex,
              categoryName: d.categoryName,
              categoryAbbr: d.categoryAbbr,
              classCode: d.CLASS,
              classDesc: d.CLASS_DESC,
              classSource: d.source,
            });
          }
          // Immediately apply focus highlighting to clicked element
          svg
            .selectAll("path.category-arc")
            .style("stroke", "#fff")
            .style("stroke-width", 2);
          svg
            .selectAll("path.class-arc")
            .style("stroke", "#fff")
            .style("stroke-width", 2);
          svg
            .selectAll("path.make-arc")
            .style("stroke", "#fff")
            .style("stroke-width", 1);
          d3.select(this).style("stroke", "#017dc3").style("stroke-width", 4);
          return;
        }

        const isDeselecting = activeClass === d.CLASS;
        if (isDeselecting) {
          setActiveClass(null);
          setActiveMake(null);
          // Notify parent to zoom out to category level
          if (onCategorySelect) {
            onCategorySelect({
              categoryIndex: d.categoryIndex,
              categoryName: d.categoryName,
              categoryAbbr: d.categoryAbbr,
            });
          }
          // Remove highlighting from class, apply to parent category
          d3.select(this).style("stroke", "#fff").style("stroke-width", 2);
          svg
            .selectAll("path.category-arc")
            .style("stroke", (cat, i) =>
              i === d.categoryIndex ? "#017dc3" : "#fff"
            )
            .style("stroke-width", (cat, i) => (i === d.categoryIndex ? 4 : 2));
        } else {
          setActiveClass(d.CLASS);
          setActiveMake(null);
          // Notify parent of class selection
          if (onClassSelect) {
            onClassSelect({
              categoryIndex: d.categoryIndex,
              categoryName: d.categoryName,
              categoryAbbr: d.categoryAbbr,
              classCode: d.CLASS,
              classDesc: d.CLASS_DESC,
              classSource: d.source,
            });
          }
          // Immediately apply focus highlighting to clicked element
          svg
            .selectAll("path.category-arc")
            .style("stroke", "#fff")
            .style("stroke-width", 2);
          svg
            .selectAll("path.class-arc")
            .style("stroke", "#fff")
            .style("stroke-width", 2);
          d3.select(this).style("stroke", "#017dc3").style("stroke-width", 4);
        }
        setFocusedModelIndex(null);
      })
      .on("dblclick", function (event, d) {
        // Treat double-click same as single click for rings 1-3
        event.preventDefault();
        if (activeClass === d.CLASS) {
          setActiveClass(null);
          setActiveMake(null);
        } else {
          setActiveClass(d.CLASS);
          setActiveMake(null);
        }
      })
      .on("mouseover", function (event, d) {
        d3.select(this).style("opacity", 1).style("stroke-width", 2);
        handleTooltip("show", event, {
          content: d.CLASS_DESC,
          detail: `${d.categoryName} → ${d.CLASS}`,
          source: getSourceLabel(d.source, false),
          photoUrl: getClassPhoto(d.CLASS),
        });
      })
      .on("mousemove", function (event) {
        handleTooltip("move", event);
      })
      .on("mouseout", function (event, d) {
        const isActive = activeClass === null || d.CLASS === activeClass;
        const isKeyboardFocused =
          keyboardFocusActive && activeClass === d.CLASS && activeMake === null;
        d3.select(this)
          .style("opacity", isActive ? 0.85 : 0.5)
          .style("stroke", isKeyboardFocused ? "#017dc3" : "#fff")
          .style("stroke-width", isKeyboardFocused ? 4 : 2);
        handleTooltip("hide");
      });

    // Class labels
    const classLabelRadius =
      (ringConfig.ring2Inner + ringConfig.ring2Outer) / 2;
    const classLabels = svg
      .selectAll("text.class-label")
      .data(classData, (d) => `${d.categoryIndex}-${d.CLASS}`);

    classLabels
      .exit()
      .transition()
      .duration(animationDuration / 2)
      .style("opacity", 0)
      .remove();

    const classLabelsEnter = classLabels
      .enter()
      .append("text")
      .attr("class", "class-label")
      .attr("text-anchor", "middle")
      .attr("alignment-baseline", "middle")
      .attr("font-size", "0.7rem")
      .attr("font-weight", (d) => (getClassPhoto(d.CLASS) ? "bold" : "normal"))
      .attr("fill", (d) =>
        d.source === "misc" ? LABEL_COLOR_MISC : LABEL_COLOR_STANDARD
      )
      .attr("pointer-events", "none")
      .style("opacity", 0)
      .text((d) => d.CLASS);

    classLabels
      .merge(classLabelsEnter)
      .attr("font-weight", (d) => (getClassPhoto(d.CLASS) ? "bold" : "normal"))
      .transition("classLabelMove")
      .duration(animationDuration)
      .ease(d3.easeCubicInOut)
      .attrTween("transform", function (d) {
        const key = `${d.categoryIndex}-${d.CLASS}`;
        const prevClassAngles = capturedClassAngles[key] || {
          startAngle: d.startAngle,
          endAngle: d.endAngle,
        };
        const prevMidAngle =
          (prevClassAngles.startAngle + prevClassAngles.endAngle) / 2;
        const newMidAngle = (d.startAngle + d.endAngle) / 2;
        const interpolateMidAngle = d3.interpolate(prevMidAngle, newMidAngle);
        return function (t) {
          const currentMidAngle = interpolateMidAngle(t);
          const x = classLabelRadius * Math.sin(currentMidAngle);
          const y = -classLabelRadius * Math.cos(currentMidAngle);
          let angle = (currentMidAngle * 180) / Math.PI - 90;
          if (angle > 90 || angle < -90) angle += 180;
          return `translate(${x},${y}) rotate(${angle})`;
        };
      })
      .style("opacity", (d) =>
        activeClass === null || d.CLASS === activeClass ? 0.95 : 0
      );

    // ============ MAKE RING ============
    const makeArcGenerator = d3.arc().cornerRadius(4);
    const createMakeArcPath = (startAngle, endAngle, innerR, outerR) => {
      return makeArcGenerator({
        startAngle,
        endAngle,
        innerRadius: innerR,
        outerRadius: outerR,
      });
    };

    const capturedMakeAngles = {};
    svg.selectAll("path.make-arc").each(function () {
      const el = d3.select(this);
      const currentData = el.datum();
      if (currentData) {
        const key = `${currentData.classCode}-${currentData.MAKE}`;
        capturedMakeAngles[key] = {
          startAngle: currentData.startAngle,
          endAngle: currentData.endAngle,
        };
      }
    });

    const makeArcs = svg
      .selectAll("path.make-arc")
      .data(makeData, (d) => `${d.classCode}-${d.MAKE}`);

    makeArcs
      .exit()
      .transition()
      .duration(animationDuration / 2)
      .ease(d3.easeCubicIn)
      .attrTween("d", function (d) {
        const interpolateOuter = d3.interpolate(
          ringConfig.ring3Outer,
          ringConfig.ring3Inner
        );
        return function (t) {
          return createMakeArcPath(
            d.startAngle,
            d.endAngle,
            ringConfig.ring3Inner,
            interpolateOuter(t)
          );
        };
      })
      .style("opacity", 0)
      .remove();

    const makeArcsEnter = makeArcs
      .enter()
      .append("path")
      .attr("class", "make-arc")
      .attr("d", (d) =>
        createMakeArcPath(
          d.startAngle,
          d.endAngle,
          ringConfig.ring3Inner,
          ringConfig.ring3Inner + 2
        )
      )
      .style("fill", (d) => baseColors[d.categoryIndex % baseColors.length])
      .style("stroke", "#fff")
      .style("stroke-width", 1)
      .style("cursor", "pointer")
      .style("opacity", 0);

    makeArcsEnter
      .transition()
      .delay(isExpanding ? animationDuration * 0.8 : animationDuration * 0.3)
      .duration(animationDuration * 0.6)
      .ease(d3.easeCubicOut)
      .attrTween("d", function (d) {
        const interpolateOuter = d3.interpolate(
          ringConfig.ring3Inner + 2,
          ringConfig.ring3Outer
        );
        return function (t) {
          return createMakeArcPath(
            d.startAngle,
            d.endAngle,
            ringConfig.ring3Inner,
            interpolateOuter(t)
          );
        };
      })
      .style("opacity", 0.85);

    makeArcs
      .transition("makeExpand")
      .duration(animationDuration)
      .ease(d3.easeCubicInOut)
      .attrTween("d", function (d) {
        const key = `${d.classCode}-${d.MAKE}`;
        const prevMakeAngles = capturedMakeAngles[key] || {
          startAngle: d.startAngle,
          endAngle: d.endAngle,
        };
        const interpolateStart = d3.interpolate(
          prevMakeAngles.startAngle,
          d.startAngle
        );
        const interpolateEnd = d3.interpolate(
          prevMakeAngles.endAngle,
          d.endAngle
        );
        return function (t) {
          return createMakeArcPath(
            interpolateStart(t),
            interpolateEnd(t),
            ringConfig.ring3Inner,
            ringConfig.ring3Outer
          );
        };
      })
      .style("opacity", (d) =>
        activeMake === null || d.MAKE === activeMake ? 0.85 : 0.5
      );

    // Apply keyboard focus highlighting to makes
    const isMakeKeyboardFocused = (d) =>
      keyboardFocusActive &&
      activeMake === d.MAKE &&
      focusedModelIndex === null;

    svg
      .selectAll("path.make-arc")
      .style("stroke", (d) => (isMakeKeyboardFocused(d) ? "#017dc3" : "#fff"))
      .style("stroke-width", (d) => (isMakeKeyboardFocused(d) ? 4 : 1));

    svg
      .selectAll("path.make-arc")
      .style("cursor", "pointer")
      .on("click", function (event, d) {
        setKeyboardFocusActive(true);

        // If there's a focused model, clicking any make should zoom to that make level
        // (not deselect the make entirely)
        if (focusedModelIndex !== null) {
          // Clicking any make when model is focused: zoom to make level
          setActiveMake(d.MAKE);
          setFocusedModelIndex(null);
          // Notify parent of make selection
          if (onMakeSelect) {
            onMakeSelect({
              categoryIndex: d.categoryIndex,
              categoryName: d.categoryName,
              categoryAbbr: d.categoryAbbr,
              classCode: d.classCode,
              classDesc: d.classDesc,
              classSource: d.classSource,
              makeCode: d.MAKE,
              makeDesc: d.MAKE_DESC,
              makeSource: d.source,
            });
          }
          // Immediately apply focus highlighting to clicked element
          svg
            .selectAll("path.class-arc")
            .style("stroke", "#fff")
            .style("stroke-width", 2);
          svg
            .selectAll("path.make-arc")
            .style("stroke", "#fff")
            .style("stroke-width", 1);
          svg
            .selectAll("path.model-arc")
            .style("stroke", "#fff")
            .style("stroke-width", 0.5);
          d3.select(this).style("stroke", "#017dc3").style("stroke-width", 4);
          return;
        }

        const isDeselecting = activeMake === d.MAKE;
        if (isDeselecting) {
          setActiveMake(null);
          // Notify parent to zoom out to class level
          if (onClassSelect) {
            onClassSelect({
              categoryIndex: d.categoryIndex,
              categoryName: d.categoryName,
              categoryAbbr: d.categoryAbbr,
              classCode: d.classCode,
              classDesc: d.classDesc,
              classSource: d.classSource,
            });
          }
          // Remove highlighting from make, apply to parent class
          d3.select(this).style("stroke", "#fff").style("stroke-width", 1);
          svg
            .selectAll("path.class-arc")
            .style("stroke", (cls) =>
              cls.CLASS === d.classCode ? "#017dc3" : "#fff"
            )
            .style("stroke-width", (cls) =>
              cls.CLASS === d.classCode ? 4 : 2
            );
        } else {
          setActiveMake(d.MAKE);
          // Notify parent of make selection
          if (onMakeSelect) {
            onMakeSelect({
              categoryIndex: d.categoryIndex,
              categoryName: d.categoryName,
              categoryAbbr: d.categoryAbbr,
              classCode: d.classCode,
              classDesc: d.classDesc,
              classSource: d.classSource,
              makeCode: d.MAKE,
              makeDesc: d.MAKE_DESC,
              makeSource: d.source,
            });
          }
          // Immediately apply focus highlighting to clicked element
          svg
            .selectAll("path.class-arc")
            .style("stroke", "#fff")
            .style("stroke-width", 2);
          svg
            .selectAll("path.make-arc")
            .style("stroke", "#fff")
            .style("stroke-width", 1);
          d3.select(this).style("stroke", "#017dc3").style("stroke-width", 4);
        }
        setFocusedModelIndex(null);
      })
      .on("dblclick", function (event, d) {
        // Treat double-click same as single click for rings 1-3
        event.preventDefault();
        setActiveMake(activeMake === d.MAKE ? null : d.MAKE);
      })
      .on("mouseover", function (event, d) {
        d3.select(this).style("opacity", 1).style("stroke-width", 2);
        handleTooltip("show", event, {
          content: d.MAKE_DESC,
          detail: `${d.classDesc} → ${d.MAKE} (${d.models.length} models)`,
          source: getSourceLabel(d.source, false),
          photoUrl: getMakePhoto(d.classCode, d.MAKE),
        });
      })
      .on("mousemove", function (event) {
        handleTooltip("move", event);
      })
      .on("mouseout", function (event, d) {
        const isActive = activeMake === null || d.MAKE === activeMake;
        const isKeyboardFocused =
          keyboardFocusActive &&
          activeMake === d.MAKE &&
          focusedModelIndex === null;
        d3.select(this)
          .style("opacity", isActive ? 0.85 : 0.5)
          .style("stroke", isKeyboardFocused ? "#017dc3" : "#fff")
          .style("stroke-width", isKeyboardFocused ? 4 : 1);
        handleTooltip("hide");
      });

    // Make labels
    const makeLabelRadius = (ringConfig.ring3Inner + ringConfig.ring3Outer) / 2;
    const makeLabels = svg
      .selectAll("text.make-label")
      .data(makeData, (d) => `${d.classCode}-${d.MAKE}`);

    makeLabels
      .exit()
      .transition()
      .duration(animationDuration / 2)
      .style("opacity", 0)
      .remove();

    const makeLabelsEnter = makeLabels
      .enter()
      .append("text")
      .attr("class", "make-label")
      .attr("text-anchor", "middle")
      .attr("alignment-baseline", "middle")
      .attr("font-size", "0.7rem")
      .attr("font-weight", (d) =>
        getMakePhoto(d.classCode, d.MAKE) ? "bold" : "normal"
      )
      .attr("fill", (d) =>
        d.source === "misc" ? LABEL_COLOR_MISC : LABEL_COLOR_STANDARD
      )
      .attr("pointer-events", "none")
      .style("opacity", 0)
      .text((d) => d.MAKE);

    makeLabels
      .merge(makeLabelsEnter)
      .attr("font-weight", (d) =>
        getMakePhoto(d.classCode, d.MAKE) ? "bold" : "normal"
      )
      .transition("makeLabelMove")
      .duration(animationDuration)
      .ease(d3.easeCubicInOut)
      .attrTween("transform", function (d) {
        const key = `${d.classCode}-${d.MAKE}`;
        const prevMakeAngles = capturedMakeAngles[key] || {
          startAngle: d.startAngle,
          endAngle: d.endAngle,
        };
        const prevMidAngle =
          (prevMakeAngles.startAngle + prevMakeAngles.endAngle) / 2;
        const newMidAngle = (d.startAngle + d.endAngle) / 2;
        const interpolateMidAngle = d3.interpolate(prevMidAngle, newMidAngle);
        return function (t) {
          const currentMidAngle = interpolateMidAngle(t);
          const x = makeLabelRadius * Math.sin(currentMidAngle);
          const y = -makeLabelRadius * Math.cos(currentMidAngle);
          let angle = (currentMidAngle * 180) / Math.PI - 90;
          if (angle > 90 || angle < -90) angle += 180;
          return `translate(${x},${y}) rotate(${angle})`;
        };
      })
      .style("opacity", (d) =>
        activeMake === null || d.MAKE === activeMake ? 0.95 : 0
      );

    // ============ MODEL RING ============
    const modelArcGenerator = d3.arc().cornerRadius(4);
    const createModelArcPath = (startAngle, endAngle, innerR, outerR) => {
      return modelArcGenerator({
        startAngle,
        endAngle,
        innerRadius: innerR,
        outerRadius: outerR,
      });
    };

    const modelArcs = svg
      .selectAll("path.model-arc")
      .data(modelData, (d) => `${d.classCode}-${d.makeCode}-${d.MODEL}`);

    modelArcs
      .exit()
      .transition()
      .duration(animationDuration / 2)
      .ease(d3.easeCubicIn)
      .attrTween("d", function (d) {
        const interpolateOuter = d3.interpolate(
          ringConfig.ring4Outer,
          ringConfig.ring4Inner
        );
        return function (t) {
          return createModelArcPath(
            d.startAngle,
            d.endAngle,
            ringConfig.ring4Inner,
            interpolateOuter(t)
          );
        };
      })
      .style("opacity", 0)
      .remove();

    const modelArcsEnter = modelArcs
      .enter()
      .append("path")
      .attr("class", (d) =>
        d.isPaginationNav ? "model-arc pagination-nav" : "model-arc"
      )
      .attr("d", (d) =>
        createModelArcPath(
          d.startAngle,
          d.endAngle,
          ringConfig.ring4Inner,
          ringConfig.ring4Inner + 2
        )
      )
      .style("fill", (d) => {
        if (d.isPaginationNav) {
          // Use a distinct color for pagination nav segments
          return "#666";
        }
        return baseColors[d.categoryIndex % baseColors.length];
      })
      .style("stroke", "#fff")
      .style("stroke-width", 0.5)
      .style("cursor", "pointer")
      .style("opacity", 0);

    // Helper to get models in active make for focused index lookup
    const modelsInActiveMake = activeMake
      ? modelData.filter((m) => m.makeCode === activeMake)
      : [];

    // Helper to check if a model is focused
    const isModelFocused = (d) => {
      if (focusedModelIndex === null || !activeMake) return false;
      const focusedModel = modelsInActiveMake[focusedModelIndex];
      return (
        focusedModel &&
        focusedModel.MODEL === d.MODEL &&
        focusedModel.makeCode === d.makeCode &&
        focusedModel.classCode === d.classCode
      );
    };

    modelArcsEnter
      .transition()
      .delay(isExpanding ? animationDuration * 1.0 : animationDuration * 0.5)
      .duration(animationDuration * 0.6)
      .ease(d3.easeCubicOut)
      .attrTween("d", function (d) {
        const interpolateOuter = d3.interpolate(
          ringConfig.ring4Inner + 2,
          ringConfig.ring4Outer
        );
        return function (t) {
          return createModelArcPath(
            d.startAngle,
            d.endAngle,
            ringConfig.ring4Inner,
            interpolateOuter(t)
          );
        };
      })
      .style("opacity", (d) => (isModelFocused(d) ? 1 : 0.85));

    modelArcs
      .transition()
      .duration(animationDuration)
      .ease(d3.easeCubicInOut)
      .attrTween("d", function (d) {
        return function () {
          return createModelArcPath(
            d.startAngle,
            d.endAngle,
            ringConfig.ring4Inner,
            ringConfig.ring4Outer
          );
        };
      })
      .style("opacity", (d) => (isModelFocused(d) ? 1 : 0.85));

    // Apply focused model highlighting (stroke)
    svg
      .selectAll("path.model-arc")
      .style("stroke", (d) => (isModelFocused(d) ? "#017dc3" : "#fff"))
      .style("stroke-width", (d) => (isModelFocused(d) ? 3 : 0.5));

    svg
      .selectAll("path.model-arc")
      .style("cursor", "pointer")
      .on("click", function (event, d) {
        setKeyboardFocusActive(true);

        // Handle pagination navigation clicks
        if (d.isPaginationNav) {
          if (d.paginationDirection === "prev") {
            setModelPage((prev) => Math.max(0, prev - 1));
            setFocusedModelIndex(-2); // Focus last model on new page
          } else if (d.paginationDirection === "next") {
            setModelPage((prev) => prev + 1);
            setFocusedModelIndex(-1); // Focus first model on new page
          }
          return;
        }

        // Find the index of the clicked model in modelsInActiveMake
        const clickedModelIndex = modelsInActiveMake.findIndex(
          (m) =>
            m.MODEL === d.MODEL &&
            m.makeCode === d.makeCode &&
            m.classCode === d.classCode
        );
        if (clickedModelIndex !== -1) {
          setFocusedModelIndex(clickedModelIndex);
        }
        // Immediately apply focus highlighting to clicked element
        svg
          .selectAll("path.make-arc")
          .style("stroke", "#fff")
          .style("stroke-width", 1);
        svg
          .selectAll("path.model-arc")
          .style("stroke", "#fff")
          .style("stroke-width", 0.5);
        d3.select(this).style("stroke", "#017dc3").style("stroke-width", 3);
        // Click on model loads it to Equipment Profile
        if (onModelSelect) {
          onModelSelect({
            categoryIndex: d.categoryIndex,
            categoryName: d.categoryName,
            categoryAbbr: d.categoryAbbr,
            classCode: d.classCode,
            classDesc: d.CLASS_DESC,
            classSource: d.classSource,
            makeCode: d.makeCode,
            makeDesc: d.makeDesc,
            makeSource: d.makeSource,
            modelCode: d.MODEL,
            modelDesc: d.MODEL_DESC,
            rentalRate: d.RENTAL_RATE,
            rwDelay: d.RW_DELAY,
            overtime: d.OVERTIME,
            source: d.source,
            photoUrl: d.photoUrl,
            // Misc-specific fields
            beginDate: d.BEGIN_DATE,
            endDate: d.END_DATE,
            lastUpdateDate: d.LAST_UPDATE_DATE,
            remarks: d.REMARKS,
          });
        }
      })
      .on("dblclick", function (event, d) {
        // Handle pagination nav double-click same as single click
        if (d.isPaginationNav) {
          event.preventDefault();
          if (d.paginationDirection === "prev") {
            setModelPage((prev) => Math.max(0, prev - 1));
            setFocusedModelIndex(-2);
          } else if (d.paginationDirection === "next") {
            setModelPage((prev) => prev + 1);
            setFocusedModelIndex(-1);
          }
          return;
        }
        // Double-click on model also loads it to Equipment Profile
        event.preventDefault();
        if (onModelSelect) {
          onModelSelect({
            categoryIndex: d.categoryIndex,
            categoryName: d.categoryName,
            categoryAbbr: d.categoryAbbr,
            classCode: d.classCode,
            classDesc: d.CLASS_DESC,
            classSource: d.classSource,
            makeCode: d.makeCode,
            makeDesc: d.makeDesc,
            makeSource: d.makeSource,
            modelCode: d.MODEL,
            modelDesc: d.MODEL_DESC,
            rentalRate: d.RENTAL_RATE,
            rwDelay: d.RW_DELAY,
            overtime: d.OVERTIME,
            source: d.source,
            photoUrl: d.photoUrl,
            // Misc-specific fields
            beginDate: d.BEGIN_DATE,
            endDate: d.END_DATE,
            lastUpdateDate: d.LAST_UPDATE_DATE,
            remarks: d.REMARKS,
          });
        }
      })
      .on("mouseover", function (event, d) {
        d3.select(this)
          .style("opacity", 1)
          .style("stroke", "#017dc3")
          .style("stroke-width", 3);

        // Handle pagination nav tooltip differently
        if (d.isPaginationNav) {
          handleTooltip("show", event, {
            content:
              d.paginationDirection === "prev"
                ? "◀ Previous Page"
                : "Next Page ▶",
            detail: `Page ${d.currentPage + 1} of ${d.totalPages} (${
              d.totalModelCount
            } total models)`,
            isPaginationNav: true,
          });
        } else {
          handleTooltip("show", event, {
            content: d.MODEL_DESC,
            isModel: true,
            modelCode: d.MODEL,
            classCode: d.classCode,
            classDesc: d.CLASS_DESC,
            makeCode: d.makeCode,
            makeDesc: d.makeDesc,
            rentalRate: d.RENTAL_RATE,
            rwDelay: d.RW_DELAY,
            overtime: d.OVERTIME,
            source: getSourceLabel(d.source, true),
            photoUrl: d.photoUrl,
          });
        }
      })
      .on("mousemove", function (event) {
        handleTooltip("move", event);
      })
      .on("mouseout", function (event, d) {
        const focused = isModelFocused(d);
        d3.select(this)
          .style("opacity", focused ? 1 : 0.85)
          .style("stroke", focused ? "#017dc3" : "#fff")
          .style("stroke-width", focused ? 3 : 0.5);
        handleTooltip("hide");
      });

    // Model labels
    const modelLabelRadius =
      (ringConfig.ring4Inner + ringConfig.ring4Outer) / 2;
    const modelLabels = svg
      .selectAll("text.model-label")
      .data(modelData, (d) => `${d.classCode}-${d.makeCode}-${d.MODEL}`);

    modelLabels
      .exit()
      .transition()
      .duration(animationDuration / 2)
      .style("opacity", 0)
      .remove();

    const modelLabelsEnter = modelLabels
      .enter()
      .append("text")
      .attr("class", "model-label")
      .attr("text-anchor", "middle")
      .attr("alignment-baseline", "middle")
      .attr("font-size", "0.7rem")
      .attr("font-weight", (d) => (d.photoUrl ? "bold" : "normal"))
      .attr("fill", (d) =>
        d.source === "misc" ? LABEL_COLOR_MISC : LABEL_COLOR_STANDARD
      )
      .attr("pointer-events", "none")
      .style("opacity", 0)
      .text((d) => d.MODEL);

    modelLabels
      .merge(modelLabelsEnter)
      .attr("font-weight", (d) => (d.photoUrl ? "bold" : "normal"))
      .transition("modelLabelMove")
      .duration(animationDuration)
      .ease(d3.easeCubicInOut)
      .attrTween("transform", function (d) {
        const midAngle = (d.startAngle + d.endAngle) / 2;
        return function () {
          const x = modelLabelRadius * Math.sin(midAngle);
          const y = -modelLabelRadius * Math.cos(midAngle);
          let angle = (midAngle * 180) / Math.PI - 90;
          if (angle > 90 || angle < -90) angle += 180;
          return `translate(${x},${y}) rotate(${angle})`;
        };
      })
      .style("opacity", (d) => (d.endAngle - d.startAngle < 0.01 ? 0 : 0.95));

    // ============ CENTER ============
    svg.selectAll(".center-circle").remove();
    svg.selectAll(".center-text").remove();

    svg
      .append("circle")
      .attr("class", "center-circle")
      .attr("r", ringConfig.ring1Inner)
      .style("fill", "#f8f9fa")
      .style("stroke", "none")
      .style("cursor", activeCategory !== null ? "pointer" : "default")
      .on("click", function () {
        if (activeCategory !== null) {
          setActiveCategory(null);
          setActiveClass(null);
          setActiveMake(null);
        }
      });

    // Determine what to show in center based on highest active level
    if (activeMake !== null) {
      // Show Make info
      const activeMakeData = makeData.find((m) => m.MAKE === activeMake);
      if (activeMakeData) {
        const totalModels = activeMakeData.models.length;
        const needsPagination = totalModels > MODEL_PAGE_SIZE;
        const totalPages = needsPagination
          ? Math.ceil(totalModels / MODEL_PAGE_SIZE)
          : 1;
        const currentPageNum = Math.min(modelPage, totalPages - 1) + 1;
        // Vertical centering: with pagination -16 to 42 (midpoint 13), without: -16 to 30 (midpoint 7)
        const yOffset = needsPagination ? -13 : -7;

        svg
          .append("text")
          .attr("class", "center-text")
          .attr("text-anchor", "middle")
          .attr("alignment-baseline", "middle")
          .attr("y", -16 + yOffset)
          .attr("font-size", "0.65rem")
          .attr("fill", "#999")
          .text(activeMakeData.classCode);

        svg
          .append("text")
          .attr("class", "center-text")
          .attr("text-anchor", "middle")
          .attr("alignment-baseline", "middle")
          .attr("y", 0 + yOffset)
          .attr("font-size", "0.7rem")
          .attr("font-weight", "bold")
          .attr("fill", "#017dc3")
          .text(activeMakeData.MAKE);

        svg
          .append("text")
          .attr("class", "center-text")
          .attr("text-anchor", "middle")
          .attr("alignment-baseline", "middle")
          .attr("y", 16 + yOffset)
          .attr("font-size", "0.7rem")
          .attr("fill", "#666")
          .text(`${totalModels} Models`);

        if (needsPagination) {
          svg
            .append("text")
            .attr("class", "center-text")
            .attr("text-anchor", "middle")
            .attr("alignment-baseline", "middle")
            .attr("y", 28 + yOffset)
            .attr("font-size", "0.65rem")
            .attr("fill", "#999")
            .text(`(pg ${currentPageNum}/${totalPages})`);
        }

        svg
          .append("text")
          .attr("class", "center-text")
          .attr("text-anchor", "middle")
          .attr("alignment-baseline", "middle")
          .attr("y", (needsPagination ? 42 : 30) + yOffset)
          .attr("font-size", "0.7rem")
          .attr("fill", "#999")
          .style("cursor", "pointer")
          .text("← Back")
          .on("click", function () {
            setActiveMake(null);
          });
      }
    } else if (activeClass !== null) {
      // Show Class info
      const activeClassData = classData.find((c) => c.CLASS === activeClass);
      if (activeClassData) {
        const makesInClass = makeData.filter(
          (m) => m.classCode === activeClass
        );
        // Vertical centering: -16 to 30 (midpoint 7)
        const yOffset = -7;

        svg
          .append("text")
          .attr("class", "center-text")
          .attr("text-anchor", "middle")
          .attr("alignment-baseline", "middle")
          .attr("y", -16 + yOffset)
          .attr("font-size", "0.65rem")
          .attr("fill", "#999")
          .text(equipmentData.categories[activeClassData.categoryIndex].abbr);

        svg
          .append("text")
          .attr("class", "center-text")
          .attr("text-anchor", "middle")
          .attr("alignment-baseline", "middle")
          .attr("y", 0 + yOffset)
          .attr("font-size", "0.7rem")
          .attr("font-weight", "bold")
          .attr("fill", "#017dc3")
          .text(activeClassData.CLASS);

        svg
          .append("text")
          .attr("class", "center-text")
          .attr("text-anchor", "middle")
          .attr("alignment-baseline", "middle")
          .attr("y", 16 + yOffset)
          .attr("font-size", "0.7rem")
          .attr("fill", "#666")
          .text(`${makesInClass.length} Makes`);

        svg
          .append("text")
          .attr("class", "center-text")
          .attr("text-anchor", "middle")
          .attr("alignment-baseline", "middle")
          .attr("y", 30 + yOffset)
          .attr("font-size", "0.7rem")
          .attr("fill", "#999")
          .style("cursor", "pointer")
          .text("← Back")
          .on("click", function () {
            setActiveClass(null);
            setActiveMake(null);
          });
      }
    } else if (activeCategory !== null) {
      // Show Category info
      const activeCat = equipmentData.categories[activeCategory];
      // Vertical centering: -8 to 22 (midpoint 7)
      const yOffset = -7;

      svg
        .append("text")
        .attr("class", "center-text")
        .attr("text-anchor", "middle")
        .attr("alignment-baseline", "middle")
        .attr("y", -8 + yOffset)
        .attr("font-size", "0.7rem")
        .attr("font-weight", "bold")
        .attr("fill", "#017dc3")
        .text(activeCat.abbr);

      svg
        .append("text")
        .attr("class", "center-text")
        .attr("text-anchor", "middle")
        .attr("alignment-baseline", "middle")
        .attr("y", 8 + yOffset)
        .attr("font-size", "0.7rem")
        .attr("fill", "#666")
        .text(`${activeCat.classes.length} Classes`);

      svg
        .append("text")
        .attr("class", "center-text")
        .attr("text-anchor", "middle")
        .attr("alignment-baseline", "middle")
        .attr("y", 22 + yOffset)
        .attr("font-size", "0.7rem")
        .attr("fill", "#999")
        .style("cursor", "pointer")
        .text("← Back")
        .on("click", function () {
          setActiveCategory(null);
          setActiveClass(null);
          setActiveMake(null);
        });
    } else {
      // Default: show overall Equipment info
      // Vertical centering: 0 to 16 (midpoint 8)
      const yOffset = -8;

      svg
        .append("text")
        .attr("class", "center-text")
        .attr("text-anchor", "middle")
        .attr("alignment-baseline", "middle")
        .attr("y", 0 + yOffset)
        .attr("font-size", "0.7rem")
        .attr("font-weight", "bold")
        .attr("fill", "#017dc3")
        .text("Equipment");

      svg
        .append("text")
        .attr("class", "center-text")
        .attr("text-anchor", "middle")
        .attr("alignment-baseline", "middle")
        .attr("y", 16 + yOffset)
        .attr("font-size", "0.7rem")
        .attr("fill", "#666")
        .text(`${totalCategories} Categories`);
    }

    // Store for next render
    prevAnglesRef.current = categoryAngles;
    prevActiveCategoryRef.current = activeCategory;
  }, [
    equipmentData,
    activeCategory,
    activeClass,
    activeMake,
    categoryAngles,
    classData,
    makeData,
    modelData,
    handleTooltip,
    focusedModelIndex,
    keyboardFocusActive,
    modelPage,
  ]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        minHeight: "500px",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        position: "relative",
      }}
    >
      <svg ref={svgRef}></svg>
      <SunburstTooltip ref={tooltipRef} tooltip={tooltip} />
    </div>
  );
};

export default EquipmentSunburst;
