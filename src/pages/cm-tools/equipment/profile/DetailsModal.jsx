import React, { useRef, useEffect } from "react";

/**
 * Check if a string contains HTML tags
 */
const containsHTML = (str) => /<[^>]+>/.test(str);

/**
 * DetailsModal - Displays class/make/model details from misc_details.json
 * hasHeader: if true, first item is displayed as header; if false, all items are uniform bullets
 */
function DetailsModal({ title, details, hasHeader = false, onClose }) {
  const mouseDownTarget = useRef(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleMouseDown = (e) => {
    mouseDownTarget.current = e.target;
  };

  const handleClick = (e) => {
    if (
      e.target === e.currentTarget &&
      mouseDownTarget.current === e.currentTarget
    ) {
      onClose();
    }
    mouseDownTarget.current = null;
  };

  if (!details || details.length === 0) {
    return null;
  }

  return (
    <div
      className="model-details-modal-overlay"
      onMouseDown={handleMouseDown}
      onClick={handleClick}
    >
      <div className="model-details-modal">
        <div className="model-details-header">
          <h3>{title}</h3>
          <button
            className="model-details-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            &times;
          </button>
        </div>
        <div className="model-details-content">
          <ul className={`model-details-list ${!hasHeader ? "uniform" : ""}`}>
            {details.map((item, index) =>
              containsHTML(item) ? (
                <li key={index} dangerouslySetInnerHTML={{ __html: item }} />
              ) : (
                <li key={index}>{item}</li>
              )
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default DetailsModal;
