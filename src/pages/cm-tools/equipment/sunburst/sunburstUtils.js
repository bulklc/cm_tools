import {
  TARGET_MODEL_ANGLE,
  MIN_SEGMENT_ANGLE,
  MAX_EXPANSION_RATIO,
  SEGMENT_GAP,
} from "./sunburstConstants";

/**
 * Build a map of class -> make -> Set of unique models
 */
export const buildClassMakeModelMap = (standard, misc) => {
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
export const getModelCountForCategory = (
  catIndex,
  equipmentData,
  classToMakeToModels
) => {
  if (catIndex === null) return 0;
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
export const getModelCountForClass = (className, classToMakeToModels) => {
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
 * Count unique models for a make within a class
 */
export const getModelCountForMake = (
  className,
  makeName,
  classToMakeToModels
) => {
  if (!className || !makeName) return 0;
  const makeMap = classToMakeToModels.get(className);
  if (!makeMap) return 0;
  const models = makeMap.get(makeName);
  return models ? models.size : 0;
};

/**
 * Calculate expansion ratio based on model count and available angle
 */
export const calculateExpansionRatio = (
  modelCount,
  availableAngle,
  numSiblings
) => {
  if (numSiblings <= 1) {
    return 1;
  }
  if (modelCount === 0) {
    return MIN_SEGMENT_ANGLE / availableAngle;
  }
  const neededAngle = modelCount * TARGET_MODEL_ANGLE;
  const idealRatio = neededAngle / availableAngle;
  const minRatio = MIN_SEGMENT_ANGLE / availableAngle;
  return Math.min(MAX_EXPANSION_RATIO, Math.max(idealRatio, minRatio));
};

/**
 * Calculate category angles with expansion for active category
 */
export const calculateCategoryAngles = (
  categories,
  activeCategory,
  equipmentData,
  classToMakeToModels
) => {
  const totalCategories = categories.length;
  const totalAngle = 2 * Math.PI;

  // Calculate active category expansion ratio
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
  } else {
    activeExpansionRatio = 1 / totalCategories;
  }

  const inactiveRatio =
    activeCategory !== null && totalCategories > 1
      ? (1 - activeExpansionRatio) / (totalCategories - 1)
      : 1 / totalCategories;
  const activeRatio =
    activeCategory !== null ? activeExpansionRatio : 1 / totalCategories;

  // Calculate angles with gaps
  const categoryAngles = [];
  let currentAngle = 0;
  const totalGapAngle = totalCategories * SEGMENT_GAP;
  const availableAngle = totalAngle - totalGapAngle;

  categories.forEach((cat, i) => {
    const categoryPortion = i === activeCategory ? activeRatio : inactiveRatio;
    const angleSpan = categoryPortion * availableAngle;
    const startAngle = currentAngle + SEGMENT_GAP / 2;
    const endAngle = startAngle + angleSpan;

    categoryAngles.push({
      startAngle,
      endAngle,
      data: cat,
    });

    currentAngle = endAngle + SEGMENT_GAP / 2;
  });

  return categoryAngles;
};

/**
 * Calculate class angles within a category using smart sizing
 */
export const calculateClassAngles = (
  classes,
  activeClass,
  categoryStartAngle,
  categoryEndAngle,
  classToMakeToModels
) => {
  const categoryAngleSpan = categoryEndAngle - categoryStartAngle;
  const numClasses = classes.length;
  const totalGapAngle = (numClasses - 1) * SEGMENT_GAP;
  const availableClassAngle = categoryAngleSpan - totalGapAngle;

  const activeClassIndex = activeClass
    ? classes.findIndex((c) => c.CLASS === activeClass)
    : -1;

  // Calculate ideal angle for each class based on model count
  const classModelCounts = classes.map((cls) =>
    getModelCountForClass(cls.CLASS, classToMakeToModels)
  );
  const idealClassAngles = classModelCounts.map((count) =>
    Math.max(MIN_SEGMENT_ANGLE, count * MIN_SEGMENT_ANGLE)
  );
  const equalClassAngle = availableClassAngle / numClasses;

  // Determine which classes are "small" vs "large"
  const isSmallClass = idealClassAngles.map((ideal) => ideal < equalClassAngle);
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

  // Calculate base angles for each class
  const baseClassAngles = idealClassAngles.map((ideal, i) =>
    isSmallClass[i] ? ideal : largeClassAngle
  );

  // If there's an active class, it expands, others shrink
  let classAngles;
  if (activeClassIndex !== -1) {
    const activeIdealAngle = idealClassAngles[activeClassIndex];
    const maxActiveAngle = 0.9 * availableClassAngle;
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
      if (inactiveBaseTotal > 0) {
        return (baseAngle / inactiveBaseTotal) * remainingAngle;
      }
      return remainingAngle / (numClasses - 1);
    });
  } else {
    classAngles = baseClassAngles;
  }

  // Normalize to ensure sum equals available angle
  const classAngleSum = classAngles.reduce((a, b) => a + b, 0);
  if (classAngleSum > 0) {
    classAngles = classAngles.map(
      (angle) => (angle / classAngleSum) * availableClassAngle
    );
  }

  // Build class data with angles
  const classData = [];
  let currentClassAngle = categoryStartAngle;
  classes.forEach((cls, classIndex) => {
    const classAngleSpan = classAngles[classIndex];
    const classStartAngle = currentClassAngle;
    const classEndAngle = classStartAngle + classAngleSpan;

    classData.push({
      ...cls,
      startAngle: classStartAngle,
      endAngle: classEndAngle,
      isActive: cls.CLASS === activeClass,
    });
    currentClassAngle = classEndAngle + SEGMENT_GAP;
  });

  return classData;
};

/**
 * Calculate make angles within a class using smart sizing
 */
export const calculateMakeAngles = (
  makes,
  activeMake,
  classStartAngle,
  classEndAngle
) => {
  const classAngleSpan = classEndAngle - classStartAngle;
  const numMakes = makes.length;
  const totalMakeGapAngle = Math.max(0, (numMakes - 1) * SEGMENT_GAP);
  const availableMakeAngle = classAngleSpan - totalMakeGapAngle;

  const activeMakeIndex = activeMake
    ? makes.findIndex((m) => m.MAKE === activeMake)
    : -1;

  // Calculate ideal angle for each make based on model count
  const makeModelCounts = makes.map((make) => make.models.length);
  const idealMakeAngles = makeModelCounts.map((count) =>
    Math.max(MIN_SEGMENT_ANGLE, count * MIN_SEGMENT_ANGLE)
  );
  const equalMakeAngle = availableMakeAngle / numMakes;

  // Determine which makes are "small" vs "large"
  const isSmallMake = idealMakeAngles.map((ideal) => ideal < equalMakeAngle);
  const smallMakeTotalAngle = idealMakeAngles.reduce(
    (sum, ideal, i) => (isSmallMake[i] ? sum + ideal : sum),
    0
  );
  const numLargeMakes = isSmallMake.filter((s) => !s).length;
  const remainingForLargeMakes = availableMakeAngle - smallMakeTotalAngle;
  const largeMakeAngle =
    numLargeMakes > 0 ? remainingForLargeMakes / numLargeMakes : equalMakeAngle;

  // Calculate base angles for each make
  const baseMakeAngles = idealMakeAngles.map((ideal, i) =>
    isSmallMake[i] ? ideal : largeMakeAngle
  );

  // If there's an active make, it expands, others shrink
  let makeAngles;
  if (activeMakeIndex !== -1) {
    const activeIdealAngle = idealMakeAngles[activeMakeIndex];
    const maxActiveAngle = 0.9 * availableMakeAngle;
    const activeAngle = Math.min(
      activeIdealAngle,
      maxActiveAngle,
      availableMakeAngle
    );

    const remainingAngle = availableMakeAngle - activeAngle;
    const inactiveBaseTotal = baseMakeAngles.reduce(
      (sum, angle, i) => (i !== activeMakeIndex ? sum + angle : sum),
      0
    );

    makeAngles = baseMakeAngles.map((baseAngle, i) => {
      if (i === activeMakeIndex) return activeAngle;
      if (inactiveBaseTotal > 0) {
        return (baseAngle / inactiveBaseTotal) * remainingAngle;
      }
      return remainingAngle / (numMakes - 1);
    });
  } else {
    makeAngles = baseMakeAngles;
  }

  // Normalize to ensure sum equals available angle
  const makeAngleSum = makeAngles.reduce((a, b) => a + b, 0);
  if (makeAngleSum > 0) {
    makeAngles = makeAngles.map(
      (angle) => (angle / makeAngleSum) * availableMakeAngle
    );
  }

  return makeAngles;
};

/**
 * Calculate model angles within a make
 */
export const calculateModelAngles = (models, makeStartAngle, makeEndAngle) => {
  const makeAngleSpan = makeEndAngle - makeStartAngle;
  const numModels = models.length;
  const totalModelGapAngle = Math.max(0, (numModels - 1) * SEGMENT_GAP);
  const availableModelAngle = makeAngleSpan - totalModelGapAngle;
  const modelAngleSpan = numModels > 0 ? availableModelAngle / numModels : 0;

  const modelData = [];
  let currentModelAngle = makeStartAngle;

  models.forEach((model) => {
    const modelStartAngle = currentModelAngle;
    const modelEndAngle = modelStartAngle + modelAngleSpan;

    modelData.push({
      ...model,
      startAngle: modelStartAngle,
      endAngle: modelEndAngle,
    });

    currentModelAngle = modelEndAngle + SEGMENT_GAP;
  });

  return modelData;
};

/**
 * Get source label for tooltip
 */
export const getSourceLabel = (source) => {
  if (source === "both") return "Standard & Misc";
  if (source === "standard") return "Standard";
  return "Misc Only";
};

/**
 * Clamp tooltip position to stay within container and avoid cursor
 */
export const clampTooltipPosition = (x, y, container, tooltipEl) => {
  if (!container) return { x, y };

  const tooltipWidth = tooltipEl?.offsetWidth || 250;
  const tooltipHeight = tooltipEl?.offsetHeight || 120;
  const offset = 5; // Distance from cursor
  const padding = 5; // Distance from container edge

  const containerWidth = container.clientWidth;
  const containerHeight = container.clientHeight;

  // Check if tooltip would go off the right edge
  let finalX;
  if (x + tooltipWidth + padding > containerWidth) {
    // Position to the left of the cursor
    finalX = x - tooltipWidth - offset * 2;
  } else {
    finalX = x;
  }

  // Check if tooltip would go off the bottom edge
  let finalY;
  if (y + tooltipHeight + padding > containerHeight) {
    // Position above the cursor
    finalY = y - tooltipHeight - offset * 2;
  } else {
    finalY = y;
  }

  // Ensure we don't go off the left or top edges
  finalX = Math.max(finalX, padding);
  finalY = Math.max(finalY, padding);

  return { x: finalX, y: finalY };
};
