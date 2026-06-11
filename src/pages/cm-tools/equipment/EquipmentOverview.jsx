import { useEffect, useState, useCallback } from "react";
import EquipmentSunburst from "./sunburst/EquipmentSunburst";
import EquipmentProfile from "./profile/EquipmentProfile";
import EquipmentSearch from "./search_bar/EquipmentSearch";
import {
  ANIMATION_DURATION,
  MODEL_PAGE_SIZE,
} from "./sunburst/sunburstConstants";

import "./EquipmentOverview.css";

function EquipmentOverview() {
  const [categories, setCategories] = useState([]);
  const [standard, setStandard] = useState([]);
  const [misc, setMisc] = useState([]);
  const [equipmentPhotos, setEquipmentPhotos] = useState(null);
  const [dateInfo, setDateInfo] = useState([]);
  const [selectedEquipment, setSelectedEquipment] = useState(null);

  // Lifted sunburst state for synchronization
  const [activeCategory, setActiveCategory] = useState(null);
  const [activeClass, setActiveClass] = useState(null);
  const [activeMake, setActiveMake] = useState(null);
  const [focusedModelCode, setFocusedModelCode] = useState(null);
  const [targetModelPage, setTargetModelPage] = useState(null);

  // Handler for clicking on category in profile - collapse to category level
  const handleCategoryClick = () => {
    if (selectedEquipment) {
      setActiveCategory(selectedEquipment.categoryIndex);
      setActiveClass(null);
      setActiveMake(null);
      // Update selected equipment to show only category info
      setSelectedEquipment({
        categoryIndex: selectedEquipment.categoryIndex,
        categoryName: selectedEquipment.categoryName,
        categoryAbbr: selectedEquipment.categoryAbbr,
        level: "category",
      });
    }
  };

  // Handler for clicking on class in profile - collapse to class level
  const handleClassClick = () => {
    if (selectedEquipment) {
      // Find the category index for this class
      const catIndex = categories.findIndex((cat) =>
        cat.classes.some((cls) => cls.CLASS === selectedEquipment.classCode),
      );
      if (catIndex !== -1) {
        setActiveCategory(catIndex);
        setActiveClass(selectedEquipment.classCode);
        setActiveMake(null);
        // Update selected equipment to show category and class info
        setSelectedEquipment({
          categoryIndex: selectedEquipment.categoryIndex,
          categoryName: selectedEquipment.categoryName,
          categoryAbbr: selectedEquipment.categoryAbbr,
          classCode: selectedEquipment.classCode,
          classDesc: selectedEquipment.classDesc,
          classSource: selectedEquipment.classSource,
          level: "class",
        });
      }
    }
  };

  // Handler for clicking on make in profile - collapse to make level
  const handleMakeClick = () => {
    if (selectedEquipment) {
      // Find the category index for this class
      const catIndex = categories.findIndex((cat) =>
        cat.classes.some((cls) => cls.CLASS === selectedEquipment.classCode),
      );
      if (catIndex !== -1) {
        setActiveCategory(catIndex);
        setActiveClass(selectedEquipment.classCode);
        setActiveMake(selectedEquipment.makeCode);
        // Update selected equipment to show category, class, and make info
        setSelectedEquipment({
          categoryIndex: selectedEquipment.categoryIndex,
          categoryName: selectedEquipment.categoryName,
          categoryAbbr: selectedEquipment.categoryAbbr,
          classCode: selectedEquipment.classCode,
          classDesc: selectedEquipment.classDesc,
          classSource: selectedEquipment.classSource,
          makeCode: selectedEquipment.makeCode,
          makeDesc: selectedEquipment.makeDesc,
          makeSource: selectedEquipment.makeSource,
          level: "make",
        });
      }
    }
  };

  // Helper to get photo URL from equipmentPhotos data
  // Uses the url field which contains the full GCS URL in production
  const getPhotoUrl = useCallback(
    (classCode, makeCode, modelCode) => {
      if (!equipmentPhotos?.classes) return null;
      const classEntry = equipmentPhotos.classes.find(
        (c) => c.class === classCode,
      );
      if (!classEntry) return null;
      const makeEntry = classEntry.makes.find((m) => m.make === makeCode);
      if (!makeEntry) return null;
      const matchingModel = makeEntry.models.find((m) => {
        if (typeof m === "object") {
          return m.model === modelCode;
        }
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
      const cleanModel =
        typeof matchingModel === "string" ?
          matchingModel.replace(/\*+$/, "")
        : matchingModel.model;
      return `/equipment_photos/${classCode}_${makeCode}_${cleanModel}.jpg`;
    },
    [equipmentPhotos],
  );

  // Update selectedEquipment.photoUrl when equipmentPhotos changes
  useEffect(() => {
    if (
      selectedEquipment?.level === "model" &&
      selectedEquipment.classCode &&
      selectedEquipment.makeCode &&
      selectedEquipment.modelCode
    ) {
      const newPhotoUrl = getPhotoUrl(
        selectedEquipment.classCode,
        selectedEquipment.makeCode,
        selectedEquipment.modelCode,
      );
      if (newPhotoUrl !== selectedEquipment.photoUrl) {
        setSelectedEquipment((prev) => ({
          ...prev,
          photoUrl: newPhotoUrl,
        }));
      }
    }
  }, [equipmentPhotos, getPhotoUrl]);

  useEffect(() => {
    // Load categories data from static JSON file
    fetch("/equipment_data/equipment_categories.json")
      .then((response) => response.json())
      .then((data) => {
        // Sort categories alphabetically by abbreviation
        const sortedCategories = [...data].sort((a, b) =>
          a.abbr.localeCompare(b.abbr),
        );
        setCategories(sortedCategories);
      })
      .catch((error) => console.error("Error loading categories:", error));

    // Load standard cost data from static JSON file
    fetch("/equipment_data/all_standard.json")
      .then((response) => response.json())
      .then((data) => setStandard(data))
      .catch((error) => console.error("Error loading standard data:", error));

    // Load misc cost data from static JSON file
    fetch("/equipment_data/all_misc.json")
      .then((response) => response.json())
      .then((data) => setMisc(data))
      .catch((error) => console.error("Error loading misc data:", error));

    // Load equipment photos data from static JSON file
    fetch("/equipment_data/all_photos.json")
      .then((response) => response.json())
      .then((data) => setEquipmentPhotos(data))
      .catch((error) =>
        console.error("Error loading equipment photos:", error),
      );

    // Load date info for source document links (static file)
    fetch("/equipment_data/date_info.json")
      .then((response) => response.json())
      .then((data) => setDateInfo(data))
      .catch((error) => console.error("Error loading date info:", error));
  }, []);

  // Handler for search result selection - drill down sunburst and show in profile
  // Staggers the state updates to allow smooth animations at each level
  const handleSearchSelect = useCallback((model) => {
    const staggerDelay = ANIMATION_DURATION * 0.7; // Overlap animations slightly for smoothness

    // Calculate which page this model will be on (for pagination)
    // We need to find the model's index within its make
    const modelPage =
      model.modelIndexInMake !== undefined ?
        Math.floor(model.modelIndexInMake / MODEL_PAGE_SIZE)
      : 0;

    // Set target page before setting make, so sunburst knows which page to show
    setTargetModelPage(modelPage);

    // First: Set category (triggers Ring 1 animation)
    setActiveCategory(model.categoryIndex);

    // Second: Set class after category animation starts
    setTimeout(() => {
      setActiveClass(model.classCode);
    }, staggerDelay);

    // Third: Set make after class animation starts
    setTimeout(() => {
      setActiveMake(model.makeCode);
    }, staggerDelay * 2);

    // Fourth: Set focused model and equipment after make animation starts
    setTimeout(() => {
      setFocusedModelCode(model.modelCode);
      setSelectedEquipment({ ...model, level: "model" });
    }, staggerDelay * 3);
  }, []);

  return (
    <div className="equipment-overview-container">
      <div className="equipment-card equipment-sunburst-wrapper">
        <div className="sunburst-with-search">
          <EquipmentSearch
            standard={standard}
            misc={misc}
            categories={categories}
            equipmentPhotos={equipmentPhotos}
            onSelectModel={handleSearchSelect}
          />
          <EquipmentSunburst
            equipmentData={{ categories: categories }}
            standard={standard}
            misc={misc}
            equipmentPhotos={equipmentPhotos}
            onModelSelect={(model) =>
              setSelectedEquipment({ ...model, level: "model" })
            }
            onCategorySelect={(category) =>
              setSelectedEquipment(
                category ? { ...category, level: "category" } : null,
              )
            }
            onClassSelect={(cls) =>
              setSelectedEquipment({ ...cls, level: "class" })
            }
            onMakeSelect={(make) =>
              setSelectedEquipment({ ...make, level: "make" })
            }
            activeCategory={activeCategory}
            setActiveCategory={setActiveCategory}
            activeClass={activeClass}
            setActiveClass={setActiveClass}
            activeMake={activeMake}
            setActiveMake={setActiveMake}
            focusedModelCode={focusedModelCode}
            targetModelPage={targetModelPage}
            onFocusHandled={() => {
              setFocusedModelCode(null);
              setTargetModelPage(null);
            }}
          />
        </div>
      </div>
      <div className="equipment-card equipment-profile-wrapper">
        <EquipmentProfile
          equipment={selectedEquipment}
          onCategoryClick={handleCategoryClick}
          onClassClick={handleClassClick}
          onMakeClick={handleMakeClick}
          dateInfo={dateInfo}
          equipmentPhotos={equipmentPhotos}
          categories={categories}
          categoryClassCodes={
            (
              selectedEquipment?.categoryIndex !== undefined &&
              categories[selectedEquipment.categoryIndex]?.classes
            ) ?
              categories[selectedEquipment.categoryIndex].classes.map(
                (cls) => cls.CLASS,
              )
            : []
          }
        />
      </div>
    </div>
  );
}

export default EquipmentOverview;
