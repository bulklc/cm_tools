import React, { useMemo, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import "chartjs-adapter-date-fns";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  Filler,
);

// Register custom tooltip positioner to center tooltip above/below line segment
Tooltip.positioners.lineCenter = function (elements, eventPosition) {
  if (!elements.length) {
    return false;
  }

  const element = elements[0];
  const chart = element.element.$context.chart;
  const datasetIndex = element.datasetIndex;
  const meta = chart.getDatasetMeta(datasetIndex);

  if (meta.data.length < 2) {
    return { x: eventPosition.x, y: eventPosition.y };
  }

  // Get the x positions of the first and last points in the dataset
  const firstPoint = meta.data[0];
  const lastPoint = meta.data[meta.data.length - 1];

  // Calculate center x position
  const centerX = (firstPoint.x + lastPoint.x) / 2;
  // Use the y position of the line (both points have same y for horizontal line)
  const y = firstPoint.y;

  // Check if there's enough space above the line (estimate ~60px for tooltip height)
  const chartTop = chart.chartArea.top;
  const spaceAbove = y - chartTop;
  const tooltipHeight = 60;

  // Store yAlign preference on the chart for the tooltip to use
  chart._tooltipYAlign = spaceAbove >= tooltipHeight ? "bottom" : "top";

  return {
    x: centerX,
    y: y,
  };
};

// Plugin to dynamically adjust tooltip yAlign based on available space
const dynamicTooltipPlugin = {
  id: "dynamicTooltipAlign",
  beforeTooltipDraw: (chart, args) => {
    const tooltip = args.tooltip;
    if (tooltip && chart._tooltipYAlign) {
      tooltip.options.yAlign = chart._tooltipYAlign;
    }
  },
};

/**
 * SingleMetricChart - Simple time-series chart for a single metric
 *
 * Props:
 * - data: object with period keys (e.g., "2025_04_01_to_2026_03_31") and values
 * - title: chart title
 * - color: line color
 * - formatValue: function to format the value for display (default: 2 decimal places)
 * - yAxisLabel: label for y-axis
 * - isCurrency: whether to format as currency
 */
function SingleMetricChart({
  data = {},
  title = "",
  color = "#017dc3",
  yAxisLabel = "",
  isCurrency = false,
  unit = "",
  dateInfo = [],
  modelCode = "",
}) {
  const [copyFeedback, setCopyFeedback] = useState("");

  // Parse period keys into date ranges and values
  const parseData = (rawData) => {
    if (!rawData || typeof rawData !== "object") return [];
    return Object.entries(rawData)
      .map(([key, value]) => {
        // Parse "2025_04_01_to_2026_03_31" format - get both start and end dates
        const match = key.match(
          /^(\d{4})_(\d{2})_(\d{2})_to_(\d{4})_(\d{2})_(\d{2})$/,
        );
        if (!match) return null;
        const [, startYear, startMonth, startDay, endYear, endMonth, endDay] =
          match;
        return {
          key, // Store original key for linking to source documents
          startDate: new Date(
            parseInt(startYear),
            parseInt(startMonth) - 1,
            parseInt(startDay),
          ),
          endDate: new Date(
            parseInt(endYear),
            parseInt(endMonth) - 1,
            parseInt(endDay),
          ),
          value: Number(value),
        };
      })
      .filter((d) => d !== null)
      .sort((a, b) => a.startDate - b.startDate);
  };

  // Copy current/latest value to clipboard
  const copyCurrentValue = () => {
    const parsedData = parseData(data);
    if (parsedData.length === 0) return;

    // Get the latest (last) value
    const latestValue = parsedData[parsedData.length - 1].value;
    const text = latestValue.toFixed(2);

    navigator.clipboard.writeText(text).then(
      () => {
        setCopyFeedback("Copied!");
        setTimeout(() => setCopyFeedback(""), 1500);
      },
      () => {
        setCopyFeedback("Failed");
        setTimeout(() => setCopyFeedback(""), 1500);
      },
    );
  };

  const chartData = useMemo(() => {
    const parsedData = parseData(data);

    if (parsedData.length === 0) {
      return { datasets: [] };
    }

    // Create separate datasets for each period (flat horizontal lines)
    const datasets = parsedData.map((period, index) => {
      // Extend the last period's line a bit past its end date so the most
      // recent rate reaches a clean month boundary (instead of stopping at
      // the 03/31 end date). Derived from the data so it works for any year.
      let lineEndDate = period.endDate;
      if (index === parsedData.length - 1) {
        // First day of the month following the period's end date.
        const nextMonthStart = new Date(
          period.endDate.getFullYear(),
          period.endDate.getMonth() + 1,
          1,
        );
        if (lineEndDate < nextMonthStart) {
          lineEndDate = nextMonthStart;
        }
      }

      return {
        label: `${title} ${index + 1}`,
        data: [
          { x: period.startDate, y: period.value },
          { x: lineEndDate, y: period.value },
        ],
        borderColor: color,
        hoverBorderColor: "#ffd700",
        backgroundColor: "transparent",
        borderWidth: 2,
        pointRadius: 5, // Show points at both start and end
        pointHoverRadius: 6,
        pointHitRadius: 0, // Disable point hit detection
        pointBackgroundColor: color,
        pointHoverBackgroundColor: "#ffd700",
        pointBorderColor: "#fff",
        pointHoverBorderColor: "#fff",
        pointBorderWidth: 1,
        tension: 0,
        stepped: true,
        fill: false,
        // Store period info for tooltip (use original end date, not extended)
        periodStart: period.startDate,
        periodEnd: period.endDate,
        periodKey: period.key, // Store key for linking to source documents
        periodValue: period.value,
      };
    });

    return { datasets };
  }, [data, title, color]);

  const options = useMemo(() => {
    const parsedData = parseData(data);
    const values = parsedData.map((d) => d.value);
    const minVal = values.length > 0 ? Math.min(...values) : 0;
    const maxVal = values.length > 0 ? Math.max(...values) : 1;
    const range = maxVal - minVal || 1;

    // Get the latest value for the title
    const latestValue =
      parsedData.length > 0 ? parsedData[parsedData.length - 1].value : null;
    const formattedLatestValue =
      latestValue !== null ?
        isCurrency ? `$${latestValue.toFixed(2)}`
        : latestValue.toFixed(2)
      : "";
    // Include unit in title if provided (e.g., "/hr" or "/day")
    const unitSuffix = unit ? unit.replace("$", "") : "";
    const titleWithValue =
      latestValue !== null ?
        `${title}: ${formattedLatestValue}${unitSuffix}`
      : title;

    // Calculate nice step size for consistent spacing
    const calculateNiceStep = (range, isCurrency) => {
      if (isCurrency) {
        // For currency, use steps appropriate to the range
        // For very small values (cents), use 0.01, 0.02, 0.05, 0.1, 0.25, 0.5, 1, etc.
        const roughStep = range / 3;

        if (roughStep <= 0.01) return 0.01;
        if (roughStep <= 0.02) return 0.02;
        if (roughStep <= 0.05) return 0.05;
        if (roughStep <= 0.1) return 0.1;
        if (roughStep <= 0.25) return 0.25;
        if (roughStep <= 0.5) return 0.5;
        if (roughStep <= 1) return 1;

        // For larger values, use magnitude-based steps
        const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
        const normalized = roughStep / magnitude;
        let niceStep;
        if (normalized <= 1) niceStep = magnitude;
        else if (normalized <= 2) niceStep = 2 * magnitude;
        else if (normalized <= 5) niceStep = 5 * magnitude;
        else niceStep = 10 * magnitude;
        return niceStep;
      } else {
        // For factors, use smaller steps like 0.005, 0.01, 0.02, 0.05, 0.1
        const roughStep = range / 3;
        if (roughStep <= 0.005) return 0.005;
        if (roughStep <= 0.01) return 0.01;
        if (roughStep <= 0.02) return 0.02;
        if (roughStep <= 0.05) return 0.05;
        if (roughStep <= 0.1) return 0.1;
        return 0.2;
      }
    };

    const stepSize = calculateNiceStep(range, isCurrency);
    // Add padding of half a step to prevent clipping at extremes
    const niceMin = Math.floor((minVal - stepSize * 0.5) / stepSize) * stepSize;
    const niceMax = Math.ceil((maxVal + stepSize * 0.5) / stepSize) * stepSize;

    // Calculate x-axis bounds with padding beyond the latest period
    const allStartDates = parsedData.map((d) => d.startDate);
    const earliestDate =
      allStartDates.length > 0 ?
        new Date(Math.min(...allStartDates))
      : new Date();
    // Add 2 months padding before the first date to prevent circles from being cut off
    const minDate = new Date(earliestDate);
    minDate.setMonth(minDate.getMonth() - 2);
    // Extend ~3 months beyond the latest period's end date for padding, so the
    // most recent line is never clipped. Derived from the data (no hardcoded year).
    const allEndDates = parsedData.map((d) => d.endDate);
    const latestEndDate =
      allEndDates.length > 0 ? new Date(Math.max(...allEndDates)) : new Date();
    const maxDate = new Date(latestEndDate);
    maxDate.setMonth(maxDate.getMonth() + 3);

    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "dataset",
        axis: "x",
        intersect: false,
      },
      onHover: (event, elements) => {
        // Change cursor to pointer when hovering over clickable elements
        event.native.target.style.cursor =
          elements.length > 0 ? "pointer" : "default";
      },
      plugins: {
        legend: {
          display: false,
        },
        title: {
          display: true,
          text: titleWithValue,
          font: {
            size: 16,
            weight: "600",
          },
          color: "#495057",
          padding: {
            top: 0,
            bottom: 8,
          },
        },
        tooltip: {
          enabled: true,
          position: "lineCenter",
          yAlign: "bottom",
          backgroundColor: "rgba(255, 255, 255, 0.95)",
          titleColor: "#333",
          bodyColor: "#666",
          borderColor: "#ddd",
          borderWidth: 1,
          cornerRadius: 6,
          padding: 12,
          boxPadding: 6,
          titleFont: {
            size: 15,
            weight: "600",
          },
          bodyFont: {
            size: 14,
          },
          callbacks: {
            title: (context) => {
              if (!context || context.length === 0) return "";
              const dataset = context[0].dataset;
              const startDate = dataset.periodStart;
              const endDate = dataset.periodEnd;
              const formatDate = (date) =>
                date.toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "numeric",
                  day: "numeric",
                });
              return `${formatDate(startDate)} – ${formatDate(endDate)}`;
            },
            label: (context) => {
              const value = context.dataset.periodValue;
              if (isCurrency) {
                return ` $${value.toFixed(2)}`;
              }
              return ` ${value.toFixed(2)}`;
            },
            // Filter to only show first data point to avoid duplicates
            beforeBody: () => [],
          },
          filter: (tooltipItem) => {
            // Only show the first data point (index 0) to avoid duplicate labels
            return tooltipItem.dataIndex === 0;
          },
          // Position tooltip at the center of the line segment
          external: null,
        },
      },
      scales: {
        x: {
          type: "time",
          min: minDate,
          max: maxDate,
          time: {
            unit: "year",
            displayFormats: {
              year: "yyyy",
            },
          },
          grid: {
            display: false,
          },
          ticks: {
            font: {
              size: 14,
            },
            color: "#999",
          },
        },
        y: {
          type: "linear",
          display: true,
          position: "left",
          min: Math.max(0, niceMin),
          max: niceMax,
          title: {
            display: !!yAxisLabel,
            text: yAxisLabel,
            color: color,
            font: {
              size: 15,
              weight: "500",
            },
          },
          grid: {
            color: "rgba(0, 0, 0, 0.05)",
          },
          ticks: {
            stepSize: stepSize,
            callback: (value) =>
              isCurrency ? `$${value.toFixed(2)}` : value.toFixed(2),
            font: {
              size: 14,
            },
            color: "#666",
          },
        },
      },
    };
  }, [data, title, color, yAxisLabel, isCurrency]);

  // Handle click on chart line/point to open source document
  const handleChartClick = (event, elements) => {
    if (
      !elements ||
      elements.length === 0 ||
      !dateInfo ||
      dateInfo.length === 0
    )
      return;

    const element = elements[0];
    const datasetIndex = element.datasetIndex;
    const dataset = chartData.datasets[datasetIndex];

    if (dataset && dataset.periodKey) {
      // Find the matching date info entry
      // The filename in date_info.json is "stnd_2025_04_01_to_2026_03_31" format
      const matchingInfo = dateInfo.find(
        (info) => info.filename === `stnd_${dataset.periodKey}`,
      );

      if (matchingInfo && matchingInfo.caltrans_link) {
        window.location.href = matchingInfo.caltrans_link;
      }
    }
  };

  // Don't render if no data
  if (chartData.datasets.length === 0) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#999",
          fontSize: "0.75rem",
        }}
      >
        No data available
      </div>
    );
  }

  // Get the latest value for the tooltip
  const parsedDataForTooltip = parseData(data);
  const latestValue =
    parsedDataForTooltip.length > 0 ?
      parsedDataForTooltip[parsedDataForTooltip.length - 1].value.toFixed(2)
    : "";

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <button
        onClick={copyCurrentValue}
        title={`Copy latest value of ${latestValue}`}
        style={{
          position: "absolute",
          top: "2px",
          right: "4px",
          padding: "2px 6px",
          fontSize: "11px",
          background: copyFeedback === "Copied!" ? color : "#f0f0f0",
          color: copyFeedback === "Copied!" ? "#fff" : "#888",
          border: "1px solid #ddd",
          borderRadius: "3px",
          cursor: "pointer",
          zIndex: 10,
          transition: "background 0.2s, color 0.2s",
        }}
        onMouseEnter={(e) => {
          if (!copyFeedback) e.target.style.background = "#e0e0e0";
        }}
        onMouseLeave={(e) => {
          if (!copyFeedback) e.target.style.background = "#f0f0f0";
        }}
      >
        {copyFeedback || "📋"}
      </button>
      <Line
        data={chartData}
        options={{
          ...options,
          onClick: handleChartClick,
        }}
        plugins={[dynamicTooltipPlugin]}
      />
    </div>
  );
}

export default SingleMetricChart;
