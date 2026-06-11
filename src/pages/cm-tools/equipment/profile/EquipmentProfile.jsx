import { useState, useEffect } from "react";
import SingleMetricChart from "./SingleMetricChart";
import HierarchySection from "./HierarchySection";
import PhotoSection from "./PhotoSection";
import DetailsModal from "./DetailsModal";
import { MiscRateInfo, MiscDateInfo, MiscRemarks } from "./MiscInfoSection";

import "./EquipmentProfile.css";

function EquipmentProfile({
  equipment,
  onCategoryClick,
  onClassClick,
  onMakeClick,
  dateInfo = [],
  equipmentPhotos = null,
  categories = [],
}) {
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsLevel, setDetailsLevel] = useState(null);
  const [miscDetails, setMiscDetails] = useState(null);

  // Fetch misc_details.json on mount
  useEffect(() => {
    const fetchMiscDetails = async () => {
      try {
        const response = await fetch("/equipment_data/misc_details.json");
        const data = await response.json();
        setMiscDetails(data);
      } catch (error) {
        console.error("Error fetching misc_details.json:", error);
      }
    };
    fetchMiscDetails();
  }, []);

  // Get class details from misc_details.json if available
  // Returns { details, hasHeader } where hasHeader is true if the class key ends with asterisk
  const getClassDetails = () => {
    if (!miscDetails || !equipment?.classCode) return null;

    // Check for class key with or without asterisk
    const classCode = equipment.classCode;
    let classKey = null;
    let hasHeader = false;

    if (miscDetails[classCode + "*"]) {
      classKey = classCode + "*";
      hasHeader = true;
    } else if (miscDetails[classCode]) {
      classKey = classCode;
      hasHeader = false;
    }

    if (!classKey) return null;
    const classData = miscDetails[classKey];
    if (!classData?._class_details) return null;
    return { details: classData._class_details, hasHeader };
  };

  // Get make details from misc_details.json if available
  // Returns { details, hasHeader } where hasHeader is true if the make key ends with asterisk
  const getMakeDetails = () => {
    if (!miscDetails || !equipment?.classCode || !equipment?.makeCode)
      return null;

    // Check for class key with or without asterisk
    const classCode = equipment.classCode;
    const classData = miscDetails[classCode + "*"] || miscDetails[classCode];
    if (!classData) return null;

    // Check for make key with or without asterisk
    const makeCode = equipment.makeCode;
    let makeKey = null;
    let hasHeader = false;

    if (classData[makeCode + "*"]) {
      makeKey = makeCode + "*";
      hasHeader = true;
    } else if (classData[makeCode]) {
      makeKey = makeCode;
      hasHeader = false;
    }

    if (!makeKey) return null;
    const makeData = classData[makeKey];
    if (!makeData?._make_details) return null;
    return { details: makeData._make_details, hasHeader };
  };

  // Get model details from misc_details.json if available
  // Returns { details, hasHeader } where hasHeader is true if the key ends with asterisk
  const getModelDetails = () => {
    if (
      !miscDetails ||
      !equipment?.classCode ||
      !equipment?.makeCode ||
      !equipment?.modelCode
    )
      return null;

    // Check for class key with or without asterisk
    const classCode = equipment.classCode;
    const classData = miscDetails[classCode + "*"] || miscDetails[classCode];
    if (!classData) return null;

    // Check for make key with or without asterisk
    const makeCode = equipment.makeCode;
    const makeData = classData[makeCode + "*"] || classData[makeCode];
    if (!makeData) return null;

    // Check for model key with or without asterisk
    const modelCode = equipment.modelCode;
    let modelKey = null;
    let hasHeader = false;

    if (makeData[modelCode + "*"]) {
      modelKey = modelCode + "*";
      hasHeader = true;
    } else if (makeData[modelCode]) {
      modelKey = modelCode;
      hasHeader = false;
    }

    if (!modelKey || modelCode.startsWith("_")) return null;
    return { details: makeData[modelKey], hasHeader };
  };

  const classDetailsResult = getClassDetails();
  const classDetails = classDetailsResult?.details || null;
  const classHasHeader = classDetailsResult?.hasHeader || false;
  const makeDetailsResult = getMakeDetails();
  const makeDetails = makeDetailsResult?.details || null;
  const makeHasHeader = makeDetailsResult?.hasHeader || false;
  const modelDetailsResult = getModelDetails();
  const modelDetails = modelDetailsResult?.details || null;
  const modelHasHeader = modelDetailsResult?.hasHeader || false;

  // Get the current details to display based on detailsLevel
  // hasHeader: true means first item is header (key has asterisk), false means all items are uniform bullets
  const getCurrentDetails = () => {
    switch (detailsLevel) {
      case "class":
        return {
          details: classDetails,
          title: `${equipment.classCode} Class Details`,
          hasHeader: classHasHeader,
        };
      case "make":
        return {
          details: makeDetails,
          title: `${equipment.classCode}/${equipment.makeCode} Make Details`,
          hasHeader: makeHasHeader,
        };
      case "model":
        return {
          details: modelDetails,
          title: `${equipment.classCode}/${equipment.makeCode}/${equipment.modelCode} Model Details`,
          hasHeader: modelHasHeader,
        };
      default:
        return { details: null, title: "", hasHeader: false };
    }
  };

  const openDetailsModal = (level) => {
    setDetailsLevel(level);
    setShowDetailsModal(true);
  };

  const closeDetailsModal = () => {
    setShowDetailsModal(false);
    setDetailsLevel(null);
  };

  if (!equipment) {
    return (
      <div className="equipment-profile-empty">
        <p>Click on the sunburst chart to explore equipment.</p>
      </div>
    );
  }

  const level = equipment.level || "model";
  const showClass = level === "class" || level === "make" || level === "model";
  const showMake = level === "make" || level === "model";
  const showModel = level === "model";
  const hasPhoto = showModel && equipment.photoUrl;
  const isStandard = showModel && equipment.source !== "misc";
  const hasText = (val) => val !== null && val !== undefined && val !== "";
  const hasHierarchyData =
    hasText(equipment.categoryAbbr) ||
    hasText(equipment.categoryName) ||
    (showClass &&
      (hasText(equipment.classCode) || hasText(equipment.classDesc))) ||
    (showMake &&
      (hasText(equipment.makeCode) || hasText(equipment.makeDesc))) ||
    (showModel &&
      (hasText(equipment.modelCode) || hasText(equipment.modelDesc)));
  const hasRentalData =
    equipment.rentalRate !== null &&
    equipment.rentalRate !== undefined &&
    equipment.rentalRate !== "";
  const hasIdleData =
    equipment.rwDelay !== null &&
    equipment.rwDelay !== undefined &&
    equipment.rwDelay !== "";
  const hasOvertimeData =
    equipment.overtime !== null &&
    equipment.overtime !== undefined &&
    equipment.overtime !== "";

  // Get misc source document link
  const miscLink = dateInfo.find(
    (info) => info.filename === "misc_curr",
  )?.caltrans_link;

  // Determine rate unit based on class (NONOP and TRAFC use days, others use hours)
  const isDailyRate =
    equipment.classCode === "NONOP" || equipment.classCode === "TRAFC";
  const rateUnit = isDailyRate ? "$/day" : "$/hr";

  // Get thumbnail URL for category/class/make levels
  const getThumbnailUrl = () => {
    if (!equipmentPhotos?.classes) return null;

    if (level === "category") {
      const categoryData = categories[equipment.categoryIndex];
      if (!categoryData?.classes) return null;

      for (const cls of categoryData.classes) {
        const classEntry = equipmentPhotos.classes.find(
          (c) => c.class === cls.CLASS,
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
      return null;
    }

    if (level === "class" && equipment.classCode) {
      const classEntry = equipmentPhotos.classes.find(
        (c) => c.class === equipment.classCode,
      );
      if (!classEntry) return null;

      for (const makeEntry of classEntry.makes) {
        const classThumbnailModel = makeEntry.models.find((m) => {
          if (typeof m === "object") {
            return m.isClassThumbnail;
          }
          return m.endsWith("**");
        });
        if (classThumbnailModel) {
          if (typeof classThumbnailModel === "object") {
            if (classThumbnailModel.url) return classThumbnailModel.url;
            if (classThumbnailModel.filename)
              return `/equipment_photos/${classThumbnailModel.filename}`;
          }
          const modelCode = classThumbnailModel.replace(/\*+$/, "");
          return `/equipment_photos/${equipment.classCode}_${makeEntry.make}_${modelCode}.jpg`;
        }
      }
      return null;
    }

    if (level === "make" && equipment.classCode && equipment.makeCode) {
      const classEntry = equipmentPhotos.classes.find(
        (c) => c.class === equipment.classCode,
      );
      if (!classEntry) return null;

      const makeEntry = classEntry.makes.find(
        (m) => m.make === equipment.makeCode,
      );
      if (!makeEntry) return null;

      const makeThumbnailModel =
        makeEntry.models.find((m) => {
          if (typeof m === "object") {
            return m.isMakeThumbnail;
          }
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
        return `/equipment_photos/${equipment.classCode}_${equipment.makeCode}_${modelCode}.jpg`;
      }
      return null;
    }

    return null;
  };

  const thumbnailUrl = level !== "model" ? getThumbnailUrl() : null;

  return (
    <div className="equipment-profile">
      {/* Section 1: Hierarchy (horizontal) */}
      <div className="equipment-profile-section hierarchy-section">
        {hasHierarchyData && (
          <HierarchySection
            equipment={equipment}
            level={level}
            showClass={showClass}
            showMake={showMake}
            showModel={showModel}
            classDetails={classDetails}
            makeDetails={makeDetails}
            modelDetails={modelDetails}
            onCategoryClick={onCategoryClick}
            onClassClick={onClassClick}
            onMakeClick={onMakeClick}
            onDetailsClick={openDetailsModal}
          />
        )}
      </div>

      {/* Section 2: Photo / Thumbnail Selection */}
      <div className="equipment-profile-section photo-section">
        <PhotoSection
          equipment={equipment}
          level={level}
          showModel={showModel}
          hasPhoto={hasPhoto}
          thumbnailUrl={thumbnailUrl}
        />
      </div>

      {/* Section 3: Rental Rate Chart (Standard) or Combined Rate Info (Misc) */}
      <div className="equipment-profile-section chart-section">
        {hasRentalData &&
          (isStandard ?
            <SingleMetricChart
              data={equipment.rentalRate}
              title="Rental Rate"
              color="#017dc3"
              yAxisLabel={rateUnit}
              isCurrency={true}
              unit={rateUnit}
              dateInfo={dateInfo}
              modelCode={equipment.modelCode}
            />
          : <MiscRateInfo
              equipment={equipment}
              miscLink={miscLink}
              isDailyRate={isDailyRate}
              hasIdleData={hasIdleData}
              hasOvertimeData={hasOvertimeData}
            />)}
      </div>

      {/* Section 4: Idle/Delay Rate Chart (Standard) or Date Info (Misc) */}
      <div className="equipment-profile-section chart-section">
        {isStandard ?
          hasIdleData && (
            <SingleMetricChart
              data={equipment.rwDelay}
              title="Idle Factor"
              color="#e07b7b"
              yAxisLabel="Factor"
              isCurrency={false}
              dateInfo={dateInfo}
              modelCode={equipment.modelCode}
            />
          )
        : <MiscDateInfo equipment={equipment} miscLink={miscLink} />}
      </div>

      {/* Section 5: Overtime Rate Chart (Standard) or Remarks (Misc) */}
      <div className="equipment-profile-section chart-section">
        {isStandard ?
          hasOvertimeData && (
            <SingleMetricChart
              data={equipment.overtime}
              title="Overtime Factor"
              color="#6bbf70"
              yAxisLabel="Factor"
              isCurrency={false}
              dateInfo={dateInfo}
              modelCode={equipment.modelCode}
            />
          )
        : <MiscRemarks equipment={equipment} miscLink={miscLink} />}
      </div>

      {/* Details Modal */}
      {showDetailsModal && detailsLevel && getCurrentDetails().details && (
        <DetailsModal
          title={getCurrentDetails().title}
          details={getCurrentDetails().details}
          hasHeader={getCurrentDetails().hasHeader}
          onClose={closeDetailsModal}
        />
      )}
    </div>
  );
}

export default EquipmentProfile;
