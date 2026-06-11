import React from "react";

// Helper to get the current rental rate period key and display label
const getCurrentRatePeriod = () => {
  return {
    key: "2025_04_01_to_2026_03_31",
    label: "Apr 2025 - Mar 2026",
  };
};

// Format currency
const formatCurrency = (value) => {
  if (value === undefined || value === null) return "N/A";
  return `$${Number(value).toFixed(2)}`;
};

// Format percentage
const formatPercent = (value) => {
  if (value === undefined || value === null) return "N/A";
  return `${(Number(value) * 100).toFixed(0)}%`;
};

const SunburstTooltip = React.forwardRef(({ tooltip }, ref) => {
  if (!tooltip.visible) return null;

  const { key: currentPeriod, label: periodLabel } = getCurrentRatePeriod();

  // Model-specific tooltip
  if (tooltip.isModel) {
    // Handle both standard (object with period keys) and misc (flat values) formats
    const isObjectFormat = typeof tooltip.rentalRate === "object";
    const rentalRate = isObjectFormat
      ? tooltip.rentalRate?.[currentPeriod]
      : tooltip.rentalRate;
    const rwDelay = isObjectFormat
      ? tooltip.rwDelay?.[currentPeriod]
      : tooltip.rwDelay;
    const overtime = isObjectFormat
      ? tooltip.overtime?.[currentPeriod]
      : tooltip.overtime;
    const isMisc = tooltip.source === "Misc";
    const hasRateData =
      rentalRate !== undefined && rentalRate !== null && rentalRate !== 0;

    return (
      <div
        ref={ref}
        style={{
          position: "absolute",
          left: tooltip.x,
          top: tooltip.y,
          backgroundColor: "rgba(255, 255, 255, 0.97)",
          border: "2px solid #017dc3",
          borderRadius: "6px",
          padding: "10px 14px",
          fontSize: "0.85rem",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
          pointerEvents: "none",
          zIndex: 1000,
          maxWidth: "380px",
          minWidth: "220px",
        }}
      >
        {/* Photo thumbnail if available */}
        {tooltip.photoUrl && (
          <div
            style={{
              marginBottom: "8px",
              textAlign: "center",
            }}
          >
            <img
              src={tooltip.photoUrl}
              alt={tooltip.content}
              style={{
                maxWidth: "100%",
                maxHeight: "180px",
                borderRadius: "4px",
                border: "1px solid #ddd",
                objectFit: "contain",
              }}
              onError={(e) => {
                e.target.style.display = "none";
              }}
            />
          </div>
        )}

        {/* Model Code on top */}
        <div
          style={{
            fontWeight: 700,
            color: "#017dc3",
            fontSize: "0.95rem",
            marginBottom: "8px",
            borderBottom: "1px solid #e0e0e0",
            paddingBottom: "6px",
          }}
        >
          {tooltip.modelCode}
        </div>

        {/* Hierarchy info */}
        <div style={{ marginBottom: "8px", fontSize: "0.75rem" }}>
          {/* Class */}
          <div style={{ marginBottom: "6px" }}>
            <div
              style={{ color: "#888", fontWeight: 500, marginBottom: "1px" }}
            >
              Class
            </div>
            <div style={{ color: "#444", fontWeight: 600 }}>
              {tooltip.classCode}
            </div>
            <div style={{ color: "#666" }}>{tooltip.classDesc}</div>
          </div>

          {/* Make */}
          <div style={{ marginBottom: "6px" }}>
            <div
              style={{ color: "#888", fontWeight: 500, marginBottom: "1px" }}
            >
              Make
            </div>
            <div style={{ color: "#444", fontWeight: 600 }}>
              {tooltip.makeCode}
            </div>
            <div style={{ color: "#666" }}>{tooltip.makeDesc}</div>
          </div>

          {/* Model */}
          <div>
            <div
              style={{ color: "#888", fontWeight: 500, marginBottom: "1px" }}
            >
              Model
            </div>
            <div style={{ color: "#444", fontWeight: 600 }}>
              {tooltip.modelCode}
            </div>
            <div style={{ color: "#666", whiteSpace: "pre-wrap" }}>
              {tooltip.content}
            </div>
          </div>
        </div>

        {/* Rate info - show for both standard and misc models with rate data */}
        {hasRateData && (
          <div
            style={{
              backgroundColor: isMisc ? "rgba(139, 0, 0, 0.05)" : "#f5f5f5",
              borderRadius: "4px",
              padding: "6px 8px",
              marginBottom: "6px",
              border: isMisc ? "1px solid rgba(139, 0, 0, 0.2)" : "none",
            }}
          >
            <div
              style={{
                color: isMisc ? "#8B0000" : "#017dc3",
                fontSize: "0.7rem",
                fontWeight: 600,
                marginBottom: "4px",
                borderBottom: isMisc
                  ? "1px solid rgba(139, 0, 0, 0.2)"
                  : "1px solid #ddd",
                paddingBottom: "3px",
              }}
            >
              {isMisc ? "Misc Rate" : `Rates: ${periodLabel}`}
            </div>
            <div
              style={{
                color: "#333",
                fontSize: "0.75rem",
                marginBottom: "2px",
              }}
            >
              <span style={{ fontWeight: 600 }}>Rental Rate:</span>{" "}
              {formatCurrency(rentalRate)}/hr
            </div>
            {rwDelay !== undefined && rwDelay !== null && (
              <div
                style={{
                  color: "#333",
                  fontSize: "0.75rem",
                  marginBottom: "2px",
                }}
              >
                <span style={{ fontWeight: 600 }}>Idle Factor:</span>{" "}
                {Number(rwDelay).toFixed(2)}
              </div>
            )}
            {overtime !== undefined && overtime !== null && (
              <div style={{ color: "#333", fontSize: "0.75rem" }}>
                <span style={{ fontWeight: 600 }}>Overtime Factor:</span>{" "}
                {(1 + Number(overtime)).toFixed(2)}
              </div>
            )}
          </div>
        )}

        {/* Source badge - hide for Misc models */}
        {tooltip.source && tooltip.source !== "Misc" && (
          <div
            style={{
              color: "#8B0000",
              fontSize: "0.7rem",
              fontWeight: 600,
              padding: "2px 6px",
              backgroundColor: "rgba(139, 0, 0, 0.1)",
              borderRadius: "3px",
              display: "inline-block",
            }}
          >
            {tooltip.source}
          </div>
        )}
      </div>
    );
  }

  // "Other" segment tooltip - for hidden models
  if (tooltip.isOtherSegment) {
    return (
      <div
        ref={ref}
        style={{
          position: "absolute",
          left: tooltip.x,
          top: tooltip.y,
          backgroundColor: "rgba(255, 255, 255, 0.97)",
          border: "2px solid #9CA3AF",
          borderRadius: "6px",
          padding: "10px 14px",
          fontSize: "0.85rem",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
          pointerEvents: "none",
          zIndex: 1000,
          maxWidth: "280px",
          minWidth: "180px",
        }}
      >
        <div
          style={{
            fontWeight: 600,
            color: "#6B7280",
            fontSize: "0.9rem",
            marginBottom: "4px",
          }}
        >
          {tooltip.content}
        </div>
        <div
          style={{
            color: "#9CA3AF",
            fontSize: "0.75rem",
          }}
        >
          Use the Tabulator view to see all models
        </div>
      </div>
    );
  }

  // Standard tooltip for categories, classes, makes
  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        left: tooltip.x,
        top: tooltip.y,
        backgroundColor: "rgba(255, 255, 255, 0.95)",
        border: "2px solid #017dc3",
        borderRadius: "6px",
        padding: "8px 12px",
        fontSize: "0.85rem",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
        pointerEvents: "none",
        zIndex: 1000,
        maxWidth: "280px",
      }}
    >
      {/* Photo thumbnail if available */}
      {tooltip.photoUrl && (
        <div
          style={{
            marginBottom: "8px",
            textAlign: "center",
          }}
        >
          <img
            src={tooltip.photoUrl}
            alt={tooltip.content}
            style={{
              maxWidth: "100%",
              maxHeight: "150px",
              borderRadius: "4px",
              border: "1px solid #ddd",
              objectFit: "contain",
            }}
            onError={(e) => {
              e.target.style.display = "none";
            }}
          />
        </div>
      )}
      <div
        style={{
          fontWeight: 700,
          color: "#017dc3",
          marginBottom: "4px",
        }}
      >
        {tooltip.content}
      </div>
      {tooltip.classCount !== null && tooltip.classCount !== undefined && (
        <div style={{ color: "#666", fontSize: "0.75rem" }}>
          Classes: {tooltip.classCount}
        </div>
      )}
      {tooltip.detail && (
        <div style={{ color: "#666", fontSize: "0.75rem" }}>
          {tooltip.detail}
        </div>
      )}
      {tooltip.source && tooltip.source !== "Misc" && (
        <div
          style={{
            color: "#8B0000",
            fontSize: "0.7rem",
            fontWeight: 600,
            marginTop: "4px",
            padding: "2px 6px",
            backgroundColor: "rgba(139, 0, 0, 0.1)",
            borderRadius: "3px",
            display: "inline-block",
          }}
        >
          {tooltip.source}
        </div>
      )}
    </div>
  );
});

SunburstTooltip.displayName = "SunburstTooltip";

export default SunburstTooltip;
