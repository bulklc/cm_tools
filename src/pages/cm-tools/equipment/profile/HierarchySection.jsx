import React from "react";

/**
 * HierarchySection - Displays the equipment hierarchy breadcrumb
 * Shows Category > Class > Make > Model with collapse buttons and details buttons
 */
function HierarchySection({
  equipment,
  level,
  showClass,
  showMake,
  showModel,
  classDetails,
  makeDetails,
  modelDetails,
  canEdit,
  onCategoryClick,
  onClassClick,
  onMakeClick,
  onDetailsClick,
  onEditClick,
}) {
  return (
    <div className="equipment-hierarchy horizontal">
      <div className="hierarchy-item">
        <div className="hierarchy-label">Category</div>
        <div className="hierarchy-code">{equipment.categoryAbbr}</div>
        <div className="hierarchy-desc">{equipment.categoryName}</div>
        {showClass && (
          <button
            className="hierarchy-collapse-btn"
            onClick={onCategoryClick}
            title="Collapse to Active Category"
          >
            ↩
          </button>
        )}
      </div>

      {showClass && (
        <>
          <div className="hierarchy-connector horizontal"></div>
          <div
            className={`hierarchy-item ${
              equipment.classSource === "misc" ? "misc" : ""
            }`}
          >
            <div className="hierarchy-label">Class</div>
            <div className="hierarchy-code">{equipment.classCode}</div>
            <div className="hierarchy-desc">{equipment.classDesc}</div>
            {classDetails && (
              <button
                className="hierarchy-details-btn"
                onClick={() => onDetailsClick("class")}
                title="View Class Details"
              >
                ?
              </button>
            )}
            {showMake && (
              <button
                className="hierarchy-collapse-btn"
                onClick={onClassClick}
                title="Collapse to Active Class"
              >
                ↩
              </button>
            )}
          </div>
        </>
      )}

      {showMake && (
        <>
          <div className="hierarchy-connector horizontal"></div>
          <div
            className={`hierarchy-item ${
              equipment.makeSource === "misc" ? "misc" : ""
            }`}
          >
            <div className="hierarchy-label">Make</div>
            <div className="hierarchy-code">{equipment.makeCode}</div>
            <div className="hierarchy-desc">{equipment.makeDesc}</div>
            {makeDetails && (
              <button
                className="hierarchy-details-btn"
                onClick={() => onDetailsClick("make")}
                title="View Make Details"
              >
                ?
              </button>
            )}
            {showModel && (
              <button
                className="hierarchy-collapse-btn"
                onClick={onMakeClick}
                title="Collapse to Active Make"
              >
                ↩
              </button>
            )}
          </div>
        </>
      )}

      {showModel && (
        <>
          <div className="hierarchy-connector horizontal"></div>
          <div
            className={`hierarchy-item highlight ${
              equipment.source === "misc" ? "misc" : ""
            }`}
          >
            <div className="hierarchy-label">Model</div>
            <div className="hierarchy-code">{equipment.modelCode}</div>
            <div className="hierarchy-desc">{equipment.modelDesc}</div>
            {modelDetails && (
              <button
                className="hierarchy-details-btn"
                onClick={() => onDetailsClick("model")}
                title="View Model Details"
              >
                ?
              </button>
            )}
            {canEdit && (
              <button
                className="hierarchy-edit-btn"
                onClick={onEditClick}
                title="Edit Equipment Details"
              >
                ✏️
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default HierarchySection;
