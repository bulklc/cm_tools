import * as d3 from "d3";
import { ANIMATION_DURATION, baseColors } from "./sunburstConstants";

/**
 * Render category ring (Ring 1 - innermost)
 */
export const renderCategoryRing = ({
  svg,
  categories,
  categoryAngles,
  prevAngles,
  activeCategory,
  ringConfig,
  onCategoryClick,
  onTooltip,
  animationDuration = ANIMATION_DURATION,
}) => {
  const color = d3.scaleOrdinal(baseColors);

  const arcGenerator = d3
    .arc()
    .innerRadius(ringConfig.ring1Inner)
    .outerRadius(ringConfig.ring1Outer)
    .cornerRadius(4);

  const createArcPath = (startAngle, endAngle) => {
    return arcGenerator({ startAngle, endAngle });
  };

  // Draw category arcs
  const categoryArcs = svg
    .selectAll("path.category-arc")
    .data(categories, (d, i) => i);

  const categoryArcsEnter = categoryArcs
    .enter()
    .append("path")
    .attr("class", "category-arc")
    .attr("d", (d, i) =>
      createArcPath(prevAngles[i].startAngle, prevAngles[i].endAngle)
    )
    .style("fill", (d, i) => color(i))
    .style("stroke", "#fff")
    .style("stroke-width", 2)
    .style("cursor", "pointer")
    .style("opacity", (d, i) =>
      activeCategory === null || i === activeCategory ? 0.85 : 0.5
    );

  // Animate all arcs
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
        return createArcPath(interpolateStart(t), interpolateEnd(t));
      };
    })
    .style("opacity", (d, i) =>
      activeCategory === null || i === activeCategory ? 0.85 : 0.5
    );

  // Event handlers
  svg
    .selectAll("path.category-arc")
    .style("cursor", "pointer")
    .on("click", function (event, d) {
      const index = categories.indexOf(d);
      onCategoryClick(index);
    })
    .on("mouseover", function (event, d) {
      d3.select(this).style("opacity", 1).style("stroke-width", 3);
      onTooltip("show", event, {
        content: d.category,
        classCount: d.classes.length,
      });
    })
    .on("mousemove", function (event) {
      onTooltip("move", event);
    })
    .on("mouseout", function () {
      const index = categories.indexOf(d3.select(this).datum());
      d3.select(this)
        .style(
          "opacity",
          activeCategory === null || index === activeCategory ? 0.85 : 0.5
        )
        .style("stroke-width", 2);
      onTooltip("hide");
    });

  // Category labels
  const labelRadius = (ringConfig.ring1Inner + ringConfig.ring1Outer) / 2;

  const categoryLabels = svg
    .selectAll("text.category-label")
    .data(categories, (d, i) => i);

  const categoryLabelsEnter = categoryLabels
    .enter()
    .append("text")
    .attr("class", "category-label")
    .attr("text-anchor", "middle")
    .attr("alignment-baseline", "middle")
    .attr("font-size", "0.7rem")
    .attr("font-weight", "bold")
    .attr("fill", "#fff")
    .attr("pointer-events", "none")
    .text((d) => d.abbr);

  categoryLabels
    .merge(categoryLabelsEnter)
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
        const x = labelRadius * Math.sin(currentMidAngle);
        const y = -labelRadius * Math.cos(currentMidAngle);
        let textAngle = (currentMidAngle * 180) / Math.PI - 90;
        if (textAngle > 90 || textAngle < -90) {
          textAngle += 180;
        }
        return `translate(${x},${y}) rotate(${textAngle})`;
      };
    })
    .style("opacity", (d, i) =>
      activeCategory === null || i === activeCategory ? 0.95 : 0
    );
};

/**
 * Render center circle and text
 */
export const renderCenter = ({
  svg,
  ringConfig,
  activeCategory,
  categories,
  totalCategories,
  onCenterClick,
}) => {
  svg.selectAll(".center-circle").remove();
  svg.selectAll(".center-text").remove();

  svg
    .append("circle")
    .attr("class", "center-circle")
    .attr("r", ringConfig.ring1Inner)
    .style("fill", "#f8f9fa")
    .style("stroke", "#dee2e6")
    .style("stroke-width", 2)
    .style("cursor", activeCategory !== null ? "pointer" : "default")
    .on("click", function () {
      if (activeCategory !== null) {
        onCenterClick();
      }
    });

  if (activeCategory !== null) {
    const activeCat = categories[activeCategory];
    svg
      .append("text")
      .attr("class", "center-text")
      .attr("text-anchor", "middle")
      .attr("alignment-baseline", "middle")
      .attr("y", -8)
      .attr("font-size", "0.7rem")
      .attr("font-weight", "bold")
      .attr("fill", "#017dc3")
      .text(activeCat.abbr);

    svg
      .append("text")
      .attr("class", "center-text")
      .attr("text-anchor", "middle")
      .attr("alignment-baseline", "middle")
      .attr("y", 8)
      .attr("font-size", "0.7rem")
      .attr("fill", "#666")
      .text(`${activeCat.classes.length} Classes`);

    svg
      .append("text")
      .attr("class", "center-text")
      .attr("text-anchor", "middle")
      .attr("alignment-baseline", "middle")
      .attr("y", 22)
      .attr("font-size", "0.7rem")
      .attr("fill", "#999")
      .style("cursor", "pointer")
      .text("← Back")
      .on("click", onCenterClick);
  } else {
    svg
      .append("text")
      .attr("class", "center-text")
      .attr("text-anchor", "middle")
      .attr("alignment-baseline", "middle")
      .attr("font-size", "0.7rem")
      .attr("font-weight", "bold")
      .attr("fill", "#017dc3")
      .text("Equipment");

    svg
      .append("text")
      .attr("class", "center-text")
      .attr("text-anchor", "middle")
      .attr("alignment-baseline", "middle")
      .attr("y", 16)
      .attr("font-size", "0.7rem")
      .attr("fill", "#666")
      .text(`${totalCategories} Categories`);
  }
};
