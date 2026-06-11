import React from "react";

/**
 * MiscRateInfo - Displays rate information for misc equipment
 */
export function MiscRateInfo({
  equipment,
  miscLink,
  isDailyRate,
  hasIdleData,
  hasOvertimeData,
}) {
  return (
    <div className="misc-rate-info">
      <a
        href={miscLink}
        className="misc-section-title"
        title="Open misc source (Caltrans)"
      >
        Rate Information
      </a>
      <div className="misc-rate-grid">
        <div className="misc-rate-item">
          <span className="misc-rate-label">Rental Rate</span>
          <span className="misc-rate-value">
            ${parseFloat(equipment.rentalRate).toFixed(2)}
            {isDailyRate ? "/day" : "/hr"}
          </span>
        </div>
        {hasIdleData && (
          <div className="misc-rate-item">
            <span className="misc-rate-label">Idle Factor</span>
            <span className="misc-rate-value">
              {parseFloat(equipment.rwDelay).toFixed(2)}
            </span>
          </div>
        )}
        {hasOvertimeData && (
          <div className="misc-rate-item">
            <span className="misc-rate-label">Overtime Factor</span>
            <span className="misc-rate-value">
              {(1 + parseFloat(equipment.overtime)).toFixed(2)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * MiscDateInfo - Displays date information for misc equipment
 */
export function MiscDateInfo({ equipment, miscLink }) {
  if (!equipment.beginDate && !equipment.endDate && !equipment.lastUpdateDate) {
    return null;
  }

  return (
    <div className="misc-date-info">
      <a
        href={miscLink}
        className="misc-section-title"
        title="Open misc source (Caltrans)"
      >
        Date Information
      </a>
      <div className="misc-date-grid">
        {equipment.beginDate && (
          <div className="misc-date-item">
            <span className="misc-date-label">Begin Date</span>
            <span className="misc-date-value">{equipment.beginDate}</span>
          </div>
        )}
        {equipment.endDate && (
          <div className="misc-date-item">
            <span className="misc-date-label">End Date</span>
            <span className="misc-date-value">{equipment.endDate}</span>
          </div>
        )}
        {equipment.lastUpdateDate && (
          <div className="misc-date-item">
            <span className="misc-date-label">Last Updated</span>
            <span className="misc-date-value">{equipment.lastUpdateDate}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * MiscRemarks - Displays remarks for misc equipment
 */
export function MiscRemarks({ equipment, miscLink }) {
  if (!equipment.remarks || equipment.remarks.trim() === "") {
    return null;
  }

  return (
    <div className="misc-remarks">
      <a
        href={miscLink}
        className="misc-section-title"
        title="Open misc source (Caltrans)"
      >
        Remarks
      </a>
      <div className="misc-remarks-text">{equipment.remarks}</div>
    </div>
  );
}
