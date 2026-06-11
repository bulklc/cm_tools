import React from "react";

/**
 * PhotoSection - Displays equipment photos or thumbnails
 * Handles both model-level photos and category/class/make thumbnails
 */
function PhotoSection({ equipment, level, showModel, hasPhoto, thumbnailUrl }) {
  if (showModel) {
    // Model level: show photo if available
    if (hasPhoto) {
      return (
        <div className="photo-container">
          <a
            href={equipment.photoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="photo-link"
          >
            <img src={equipment.photoUrl} alt={equipment.modelDesc} />
          </a>
        </div>
      );
    }
    return null;
  }

  // Non-model levels: show thumbnail if available
  if (thumbnailUrl) {
    return (
      <div className="thumbnail-selection-container">
        <div className="thumbnail-display">
          <a
            href={thumbnailUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="thumbnail-link"
          >
            <img
              src={thumbnailUrl}
              alt={`${level} thumbnail`}
              className="thumbnail-image"
            />
          </a>
        </div>
      </div>
    );
  }

  return null;
}

export default PhotoSection;
