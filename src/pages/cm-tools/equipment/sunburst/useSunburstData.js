import { useMemo } from "react";
import {
  SEGMENT_GAP,
  MIN_SEGMENT_ANGLE,
  MIN_COLLAPSED_ANGLE,
  MODEL_PAGE_SIZE,
} from "./sunburstConstants";

/**
 * Build a map of class -> make -> Set of unique models
 */
const buildClassMakeModelMap = (standard, misc) => {
  const allEquipment = [...standard, ...misc];
  const classToMakeToModels = new Map();

  allEquipment.forEach((item) => {
    if (!classToMakeToModels.has(item.CLASS)) {
      classToMakeToModels.set(item.CLASS, new Map());
    }
    const makeMap = classToMakeToModels.get(item.CLASS);
    if (!makeMap.has(item.MAKE)) {
      makeMap.set(item.MAKE, new Set());
    }
    makeMap.get(item.MAKE).add(item.MODEL);
  });

  return classToMakeToModels;
};

/**
 * Count unique models for a category
 */
const getModelCountForCategory = (
  catIndex,
  equipmentData,
  classToMakeToModels
) => {
  if (catIndex === null || !equipmentData?.categories?.[catIndex]) return 0;
  const category = equipmentData.categories[catIndex];
  let count = 0;
  category.classes.forEach((cls) => {
    const makeMap = classToMakeToModels.get(cls.CLASS);
    if (makeMap) {
      makeMap.forEach((models) => {
        count += models.size;
      });
    }
  });
  return count;
};

/**
 * Count unique models for a class
 */
const getModelCountForClass = (className, classToMakeToModels) => {
  if (!className) return 0;
  const makeMap = classToMakeToModels.get(className);
  if (!makeMap) return 0;
  let count = 0;
  makeMap.forEach((models) => {
    count += models.size;
  });
  return count;
};

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

/**
 * Custom hook to prepare sunburst data structures
 */
export const useSunburstData = ({
  equipmentData,
  standard,
  misc,
  activeCategory,
  activeClass,
  activeMake,
  equipmentPhotos = null,
  modelPage = 0, // Pagination: current page for models
}) => {
  // Build the class-make-model map
  const classToMakeToModels = useMemo(
    () => buildClassMakeModelMap(standard, misc),
    [standard, misc]
  );

  // Calculate category angles
  const categoryAngles = useMemo(() => {
    if (!equipmentData?.categories?.length) return [];

    const categories = equipmentData.categories;
    const totalCategories = categories.length;
    const totalAngle = 2 * Math.PI;
    const segmentGap = SEGMENT_GAP;
    const minSegmentAngle = MIN_SEGMENT_ANGLE;
    const targetModelAngle = (10 * Math.PI) / 180;
    const maxExpansionRatio = 0.95;
    const totalGapAngle = totalCategories * segmentGap;
    const availableAngle = totalAngle - totalGapAngle;

    // Calculate expansion ratio
    const calculateExpansionRatio = (modelCount, availAngle, numSiblings) => {
      if (numSiblings <= 1) return 1;
      if (modelCount === 0) return minSegmentAngle / availAngle;
      const neededAngle = modelCount * targetModelAngle;
      const idealRatio = neededAngle / availAngle;
      const minRatio = minSegmentAngle / availAngle;
      return Math.min(maxExpansionRatio, Math.max(idealRatio, minRatio));
    };

    // Calculate how much space is needed for inactive categories at minimum
    const numInactiveCategories =
      activeCategory !== null ? totalCategories - 1 : 0;
    const minInactiveAngle = MIN_COLLAPSED_ANGLE * 3; // Give inactive categories a bit more space than absolute minimum
    const minSpaceForInactive = numInactiveCategories * minInactiveAngle;

    // Limit active expansion to leave room for inactive categories
    const maxActiveExpansion =
      activeCategory !== null
        ? Math.min(
            maxExpansionRatio,
            (availableAngle - minSpaceForInactive) / availableAngle
          )
        : 1 / totalCategories;

    let activeExpansionRatio;
    if (activeCategory !== null) {
      const modelCount = getModelCountForCategory(
        activeCategory,
        equipmentData,
        classToMakeToModels
      );
      activeExpansionRatio = calculateExpansionRatio(
        modelCount,
        totalAngle,
        totalCategories
      );
      // Cap the expansion to leave room for other categories
      activeExpansionRatio = Math.min(activeExpansionRatio, maxActiveExpansion);
    } else {
      activeExpansionRatio = 1 / totalCategories;
    }

    const inactiveRatio =
      activeCategory !== null && totalCategories > 1
        ? (1 - activeExpansionRatio) / (totalCategories - 1)
        : 1 / totalCategories;
    const activeRatio =
      activeCategory !== null ? activeExpansionRatio : 1 / totalCategories;

    const angles = [];
    let currentAngle = 0;

    categories.forEach((cat, i) => {
      const categoryPortion =
        i === activeCategory ? activeRatio : inactiveRatio;
      const angleSpan = categoryPortion * availableAngle;
      const startAngle = currentAngle + segmentGap / 2;
      const endAngle = startAngle + angleSpan;

      angles.push({
        startAngle,
        endAngle,
        fullStartAngle: currentAngle,
        fullEndAngle: currentAngle + angleSpan + segmentGap,
        isActive: i === activeCategory,
      });
      currentAngle += angleSpan + segmentGap;
    });

    return angles;
  }, [equipmentData, activeCategory, classToMakeToModels]);

  // Prepare tagged equipment data (moved before classData to enable source tracking)
  const allEquipment = useMemo(() => {
    const taggedStandard = standard.map((item) => ({
      ...item,
      _source: "standard",
    }));
    const taggedMisc = misc.map((item) => ({ ...item, _source: "misc" }));
    return [...taggedStandard, ...taggedMisc];
  }, [standard, misc]);

  // Helper to get source for a class
  const getClassSource = (classCode) => {
    const classItems = allEquipment.filter((item) => item.CLASS === classCode);
    if (classItems.length === 0) return "standard";
    const hasStandard = classItems.some((item) => item._source === "standard");
    const hasMisc = classItems.some((item) => item._source === "misc");
    if (hasStandard && hasMisc) return "both";
    if (hasStandard) return "standard";
    return "misc";
  };

  // Calculate class data
  const classData = useMemo(() => {
    if (
      activeCategory === null ||
      !equipmentData?.categories?.[activeCategory]
    ) {
      return [];
    }

    const category = equipmentData.categories[activeCategory];
    const categoryStartAngle = categoryAngles[activeCategory]?.startAngle ?? 0;
    const categoryEndAngle = categoryAngles[activeCategory]?.endAngle ?? 0;
    const categoryAngleSpan = categoryEndAngle - categoryStartAngle;
    const numClasses = category.classes.length;
    const segmentGap = SEGMENT_GAP;
    const minSegmentAngle = MIN_SEGMENT_ANGLE;

    const totalGapAngle = (numClasses - 1) * segmentGap;
    const availableClassAngle = categoryAngleSpan - totalGapAngle;

    const activeClassIndex = activeClass
      ? category.classes.findIndex((c) => c.CLASS === activeClass)
      : -1;

    // Calculate ideal angles
    const classModelCounts = category.classes.map((cls) =>
      getModelCountForClass(cls.CLASS, classToMakeToModels)
    );
    const idealClassAngles = classModelCounts.map((count) =>
      Math.max(minSegmentAngle, count * minSegmentAngle)
    );
    const equalClassAngle = availableClassAngle / numClasses;

    // Small vs large classes
    const isSmallClass = idealClassAngles.map(
      (ideal) => ideal < equalClassAngle
    );
    const smallClassTotalAngle = idealClassAngles.reduce(
      (sum, ideal, i) => (isSmallClass[i] ? sum + ideal : sum),
      0
    );
    const numLargeClasses = isSmallClass.filter((s) => !s).length;
    const remainingForLargeClasses = availableClassAngle - smallClassTotalAngle;
    const largeClassAngle =
      numLargeClasses > 0
        ? remainingForLargeClasses / numLargeClasses
        : equalClassAngle;

    const baseClassAngles = idealClassAngles.map((ideal, i) =>
      isSmallClass[i] ? ideal : largeClassAngle
    );

    // Active class expansion
    let classAngles;
    if (activeClassIndex !== -1) {
      const activeIdealAngle = idealClassAngles[activeClassIndex];
      const maxActiveAngle = 0.95 * availableClassAngle;
      const activeAngle = Math.min(
        activeIdealAngle,
        maxActiveAngle,
        availableClassAngle
      );
      const remainingAngle = availableClassAngle - activeAngle;
      const inactiveBaseTotal = baseClassAngles.reduce(
        (sum, angle, i) => (i !== activeClassIndex ? sum + angle : sum),
        0
      );

      classAngles = baseClassAngles.map((baseAngle, i) => {
        if (i === activeClassIndex) return activeAngle;
        // All inactive segments get equal space, but capped at what they'd get if active
        const numInactive = numClasses - 1;
        const equalInactiveAngle =
          numInactive > 0 ? remainingAngle / numInactive : MIN_COLLAPSED_ANGLE;
        // Cap at the segment's ideal angle (what it would get if active)
        const maxForThisSegment = idealClassAngles[i];
        return Math.max(
          MIN_COLLAPSED_ANGLE,
          Math.min(equalInactiveAngle, maxForThisSegment)
        );
      });
    } else {
      classAngles = baseClassAngles;
    }

    // Normalize
    const classAngleSum = classAngles.reduce((a, b) => a + b, 0);
    if (classAngleSum > 0) {
      classAngles = classAngles.map(
        (angle) => (angle / classAngleSum) * availableClassAngle
      );
    }

    const data = [];
    let currentClassAngle = categoryStartAngle;
    category.classes.forEach((cls, classIndex) => {
      const classAngleSpan = classAngles[classIndex];
      const classStartAngle = currentClassAngle;
      const classEndAngle = classStartAngle + classAngleSpan;

      data.push({
        ...cls,
        categoryIndex: activeCategory,
        categoryName: category.category,
        categoryAbbr: category.abbr,
        startAngle: classStartAngle,
        endAngle: classEndAngle,
        isActive: cls.CLASS === activeClass,
        source: getClassSource(cls.CLASS),
      });
      currentClassAngle = classEndAngle + segmentGap;
    });

    return data;
  }, [
    equipmentData,
    activeCategory,
    activeClass,
    categoryAngles,
    classToMakeToModels,
    allEquipment,
  ]);

  // Calculate make data
  const makeData = useMemo(() => {
    if (
      activeCategory === null ||
      activeClass === null ||
      allEquipment.length === 0
    ) {
      return [];
    }

    const activeClassItem = classData.find((c) => c.CLASS === activeClass);
    if (!activeClassItem) return [];

    const segmentGap = SEGMENT_GAP;
    const minSegmentAngle = MIN_SEGMENT_ANGLE;

    // Build makes map
    const makesMap = new Map();
    allEquipment.forEach((item) => {
      if (item.CLASS === activeClass) {
        if (!makesMap.has(item.MAKE)) {
          makesMap.set(item.MAKE, {
            MAKE: item.MAKE,
            MAKE_DESC: item.MAKE_DESC || item.MAKE,
            models: [],
            sources: new Set(),
          });
        }
        const makeEntry = makesMap.get(item.MAKE);
        makeEntry.sources.add(item._source);

        const existingModel = makeEntry.models.find(
          (m) => m.MODEL === item.MODEL
        );
        if (!existingModel) {
          makeEntry.models.push({
            MODEL: item.MODEL,
            MODEL_DESC: item.MODEL_DESC || item.MODEL,
            CLASS_DESC: item.CLASS_DESC,
            RENTAL_RATE: item.RENTAL_RATE,
            RW_DELAY: item.RW_DELAY,
            OVERTIME: item.OVERTIME,
            // Misc-specific fields
            BEGIN_DATE: item.BEGIN_DATE,
            END_DATE: item.END_DATE,
            LAST_UPDATE_DATE: item.LAST_UPDATE_DATE,
            REMARKS: item.REMARKS,
            sources: new Set([item._source]),
          });
        } else {
          existingModel.sources.add(item._source);
        }
      }
    });

    if (makesMap.size === 0) return [];

    const classStartAngle = activeClassItem.startAngle;
    const classEndAngle = activeClassItem.endAngle;
    const classAngleSpan = classEndAngle - classStartAngle;
    const makes = Array.from(makesMap.values());
    const numMakes = makes.length;

    const totalMakeGapAngle = Math.max(0, (numMakes - 1) * segmentGap);
    const availableMakeAngle = classAngleSpan - totalMakeGapAngle;

    const activeMakeIndex = activeMake
      ? makes.findIndex((m) => m.MAKE === activeMake)
      : -1;

    // Calculate ideal angles
    const makeModelCounts = makes.map((make) => make.models.length);
    const idealMakeAngles = makeModelCounts.map((count) =>
      Math.max(minSegmentAngle, count * minSegmentAngle)
    );
    const equalMakeAngle = availableMakeAngle / numMakes;

    const isSmallMake = idealMakeAngles.map((ideal) => ideal < equalMakeAngle);
    const smallMakeTotalAngle = idealMakeAngles.reduce(
      (sum, ideal, i) => (isSmallMake[i] ? sum + ideal : sum),
      0
    );
    const numLargeMakes = isSmallMake.filter((s) => !s).length;
    const remainingForLargeMakes = availableMakeAngle - smallMakeTotalAngle;
    const largeMakeAngle =
      numLargeMakes > 0
        ? remainingForLargeMakes / numLargeMakes
        : equalMakeAngle;

    const baseMakeAngles = idealMakeAngles.map((ideal, i) =>
      isSmallMake[i] ? ideal : largeMakeAngle
    );

    let makeAngles;
    if (activeMakeIndex !== -1) {
      const activeIdealAngle = idealMakeAngles[activeMakeIndex];
      const activeBaseAngle = baseMakeAngles[activeMakeIndex];
      const maxActiveAngle = 0.95 * availableMakeAngle;
      // Active make gets at least its base (inactive) angle, but can expand up to ideal or 95%
      const activeAngle = Math.max(
        activeBaseAngle,
        Math.min(activeIdealAngle, maxActiveAngle, availableMakeAngle)
      );
      const remainingAngle = availableMakeAngle - activeAngle;
      const inactiveBaseTotal = baseMakeAngles.reduce(
        (sum, angle, i) => (i !== activeMakeIndex ? sum + angle : sum),
        0
      );

      makeAngles = baseMakeAngles.map((baseAngle, i) => {
        if (i === activeMakeIndex) return activeAngle;
        // All inactive segments get equal space, but capped at what they'd get if active
        const numInactive = numMakes - 1;
        const equalInactiveAngle =
          numInactive > 0 ? remainingAngle / numInactive : MIN_COLLAPSED_ANGLE;
        // Cap at the segment's ideal angle (what it would get if active)
        const maxForThisSegment = idealMakeAngles[i];
        return Math.max(
          MIN_COLLAPSED_ANGLE,
          Math.min(equalInactiveAngle, maxForThisSegment)
        );
      });
    } else {
      makeAngles = baseMakeAngles;
    }

    // Normalize
    const makeAngleSum = makeAngles.reduce((a, b) => a + b, 0);
    if (makeAngleSum > 0) {
      makeAngles = makeAngles.map(
        (angle) => (angle / makeAngleSum) * availableMakeAngle
      );
    }

    const data = [];
    let currentMakeAngle = classStartAngle;
    makes.forEach((make, makeIndex) => {
      const makeAngleSpan = makeAngles[makeIndex];
      const makeStartAngle = currentMakeAngle;
      const makeEndAngle = makeStartAngle + makeAngleSpan;

      // Determine source
      let source;
      if (make.sources.has("standard") && make.sources.has("misc")) {
        source = "both";
      } else if (make.sources.has("standard")) {
        source = "standard";
      } else {
        source = "misc";
      }

      data.push({
        ...make,
        categoryIndex: activeCategory,
        categoryName: activeClassItem.categoryName,
        categoryAbbr: activeClassItem.categoryAbbr,
        classCode: activeClassItem.CLASS,
        classDesc: activeClassItem.CLASS_DESC,
        classSource: activeClassItem.source,
        startAngle: makeStartAngle,
        endAngle: makeEndAngle,
        isActive: make.MAKE === activeMake,
        source,
      });
      currentMakeAngle = makeEndAngle + segmentGap;
    });

    return data;
  }, [activeCategory, activeClass, activeMake, classData, allEquipment]);

  // Calculate model data with pagination support
  const modelData = useMemo(() => {
    if (activeMake === null) return [];

    const activeMakeItem = makeData.find((m) => m.MAKE === activeMake);
    if (!activeMakeItem) return [];

    // Get the class source from classData
    const activeClassItem = classData.find(
      (c) => c.CLASS === activeMakeItem.classCode
    );
    const classSource = activeClassItem?.source || "standard";
    const makeSource = activeMakeItem.source;

    // Get category info
    const categoryName = activeClassItem?.categoryName || "";
    const categoryAbbr = activeClassItem?.categoryAbbr || "";

    const segmentGap = SEGMENT_GAP;
    const makeStartAngle = activeMakeItem.startAngle;
    const makeEndAngle = activeMakeItem.endAngle;
    const makeAngleSpan = makeEndAngle - makeStartAngle;
    const allModels = activeMakeItem.models;
    const totalModelCount = allModels.length;

    // Determine if pagination is needed
    const needsPagination = totalModelCount > MODEL_PAGE_SIZE;
    const totalPages = needsPagination
      ? Math.ceil(totalModelCount / MODEL_PAGE_SIZE)
      : 1;
    const currentPage = Math.min(modelPage, totalPages - 1);

    // Get the models for the current page
    let models;
    let hasPrevPage = false;
    let hasNextPage = false;

    if (needsPagination) {
      const startIdx = currentPage * MODEL_PAGE_SIZE;
      const endIdx = Math.min(startIdx + MODEL_PAGE_SIZE, totalModelCount);
      models = allModels.slice(startIdx, endIdx);
      hasPrevPage = currentPage > 0;
      hasNextPage = currentPage < totalPages - 1;
    } else {
      models = allModels;
    }

    const numModels = models.length;
    // Account for pagination navigation segments
    const numNavSegments = (hasPrevPage ? 1 : 0) + (hasNextPage ? 1 : 0);
    const totalSegments = numModels + numNavSegments;

    const totalModelGapAngle = Math.max(0, (totalSegments - 1) * segmentGap);
    const availableModelAngle = makeAngleSpan - totalModelGapAngle;
    const modelAngleSpan =
      totalSegments > 0 ? availableModelAngle / totalSegments : 0;

    const data = [];
    let currentModelAngle = makeStartAngle;

    // Add "Prev" navigation segment if needed
    if (hasPrevPage) {
      const navStartAngle = currentModelAngle;
      const navEndAngle = navStartAngle + modelAngleSpan;
      data.push({
        MODEL: "◀ PREV",
        MODEL_DESC: `Previous ${MODEL_PAGE_SIZE} models`,
        isPaginationNav: true,
        paginationDirection: "prev",
        categoryIndex: activeCategory,
        categoryName,
        categoryAbbr,
        classCode: activeMakeItem.classCode,
        makeCode: activeMakeItem.MAKE,
        makeDesc: activeMakeItem.MAKE_DESC,
        startAngle: navStartAngle,
        endAngle: navEndAngle,
        source: "standard",
        classSource,
        makeSource,
        currentPage,
        totalPages,
        totalModelCount,
      });
      currentModelAngle = navEndAngle + segmentGap;
    }

    // Add actual model segments
    models.forEach((model) => {
      const modelStartAngle = currentModelAngle;
      const modelEndAngle = modelStartAngle + modelAngleSpan;

      let source;
      if (model.sources.has("standard") && model.sources.has("misc")) {
        source = "both";
      } else if (model.sources.has("standard")) {
        source = "standard";
      } else {
        source = "misc";
      }

      data.push({
        MODEL: model.MODEL,
        MODEL_DESC: model.MODEL_DESC,
        CLASS_DESC: model.CLASS_DESC,
        RENTAL_RATE: model.RENTAL_RATE,
        RW_DELAY: model.RW_DELAY,
        OVERTIME: model.OVERTIME,
        // Misc-specific fields
        BEGIN_DATE: model.BEGIN_DATE,
        END_DATE: model.END_DATE,
        LAST_UPDATE_DATE: model.LAST_UPDATE_DATE,
        REMARKS: model.REMARKS,
        categoryIndex: activeCategory,
        categoryName,
        categoryAbbr,
        classCode: activeMakeItem.classCode,
        makeCode: activeMakeItem.MAKE,
        makeDesc: activeMakeItem.MAKE_DESC,
        startAngle: modelStartAngle,
        endAngle: modelEndAngle,
        source,
        classSource,
        makeSource,
        photoUrl: getModelPhotoUrl(
          activeMakeItem.classCode,
          activeMakeItem.MAKE,
          model.MODEL,
          equipmentPhotos
        ),
      });
      currentModelAngle = modelEndAngle + segmentGap;
    });

    // Add "Next" navigation segment if needed
    if (hasNextPage) {
      const navStartAngle = currentModelAngle;
      const navEndAngle = navStartAngle + modelAngleSpan;
      data.push({
        MODEL: "NEXT ▶",
        MODEL_DESC: `Next ${MODEL_PAGE_SIZE} models`,
        isPaginationNav: true,
        paginationDirection: "next",
        categoryIndex: activeCategory,
        categoryName,
        categoryAbbr,
        classCode: activeMakeItem.classCode,
        makeCode: activeMakeItem.MAKE,
        makeDesc: activeMakeItem.MAKE_DESC,
        startAngle: navStartAngle,
        endAngle: navEndAngle,
        source: "standard",
        classSource,
        makeSource,
        currentPage,
        totalPages,
        totalModelCount,
      });
    }

    return data;
  }, [activeMake, makeData, activeCategory, equipmentPhotos, modelPage]);

  return {
    categoryAngles,
    classData,
    makeData,
    modelData,
    classToMakeToModels,
  };
};

export default useSunburstData;
