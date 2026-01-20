#!/usr/bin/env python3
"""
Calendar Screenshot Analyzer for "Smash Your Week" Game

This module analyzes calendar screenshots (Google Calendar, Outlook, etc.)
and extracts event blocks with their positions, colors, and text.

Output: Structured JSON ready for game generation.
"""

import cv2
import numpy as np
import pytesseract
from PIL import Image
import json
import argparse
from pathlib import Path
from dataclasses import dataclass, asdict
from typing import List, Tuple, Optional
import colorsys


@dataclass
class CalendarEvent:
    """Represents a detected calendar event block."""
    x: float  # Relative X position (0-1)
    y: float  # Relative Y position (0-1)
    width: float  # Relative width (0-1)
    height: float  # Relative height (0-1)
    color: str  # Hex color code
    text: str  # Event text/title
    confidence: float  # Detection confidence (0-1)


@dataclass
class CalendarGrid:
    """Represents the detected calendar grid structure."""
    days: List[str]
    time_range: dict
    columns: int
    rows: int


@dataclass
class AnalysisResult:
    """Complete analysis result."""
    image_width: int
    image_height: int
    calendar: dict
    events: List[dict]


class CalendarAnalyzer:
    """
    Analyzes calendar screenshots to extract event blocks.

    Uses OpenCV for image processing and Tesseract for OCR.
    Designed for Google Calendar, Outlook, and similar calendar layouts.
    """

    # Common calendar background colors (in HSV ranges)
    BACKGROUND_COLORS = [
        # White/light gray backgrounds
        ((0, 0, 200), (180, 30, 255)),
        # Very light colors
        ((0, 0, 240), (180, 20, 255)),
    ]

    # Minimum block size relative to image (filter out noise)
    MIN_BLOCK_WIDTH_RATIO = 0.02
    MIN_BLOCK_HEIGHT_RATIO = 0.01
    MAX_BLOCK_WIDTH_RATIO = 0.5
    MAX_BLOCK_HEIGHT_RATIO = 0.3

    def __init__(self, debug: bool = False):
        self.debug = debug
        self.debug_images = {}

    def analyze(self, image_path: str) -> AnalysisResult:
        """
        Main entry point: analyze a calendar screenshot.

        Args:
            image_path: Path to the calendar screenshot

        Returns:
            AnalysisResult with detected events and grid structure
        """
        # Load image
        image = cv2.imread(image_path)
        if image is None:
            raise ValueError(f"Could not load image: {image_path}")

        height, width = image.shape[:2]

        # Detect calendar grid structure
        grid = self._detect_grid(image)

        # Detect event blocks
        events = self._detect_events(image)

        # Enhance text detection with OCR
        events = self._extract_text(image, events)

        # Convert to relative coordinates
        events = self._normalize_coordinates(events, width, height)

        # Filter and validate events
        events = self._filter_events(events)

        return AnalysisResult(
            image_width=width,
            image_height=height,
            calendar={
                "days": grid.days,
                "timeRange": grid.time_range,
                "columns": grid.columns,
                "rows": grid.rows
            },
            events=[asdict(e) for e in events]
        )

    def _detect_grid(self, image: np.ndarray) -> CalendarGrid:
        """
        Detect the calendar grid structure (days, time slots).

        Uses line detection and header analysis.
        """
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        height, width = image.shape[:2]

        # Detect vertical lines (day separators)
        edges = cv2.Canny(gray, 50, 150, apertureSize=3)
        lines = cv2.HoughLinesP(edges, 1, np.pi/180, threshold=100,
                                minLineLength=height*0.3, maxLineGap=10)

        vertical_lines = []
        if lines is not None:
            for line in lines:
                x1, y1, x2, y2 = line[0]
                # Check if line is mostly vertical
                if abs(x1 - x2) < 10:
                    vertical_lines.append((x1 + x2) // 2)

        # Estimate number of columns (days)
        vertical_lines = sorted(set(vertical_lines))
        columns = max(1, len(vertical_lines) + 1) if vertical_lines else 7

        # Try to detect day names from header
        days = self._detect_day_headers(image)
        if not days:
            days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][:columns]

        # Try to detect time range from left side
        time_range = self._detect_time_range(image)

        # Estimate rows based on typical calendar layout
        rows = 24  # Assume hourly slots

        return CalendarGrid(
            days=days,
            time_range=time_range,
            columns=min(columns, 7),
            rows=rows
        )

    def _detect_day_headers(self, image: np.ndarray) -> List[str]:
        """Try to detect day names from the calendar header."""
        height, width = image.shape[:2]

        # Look at top portion of image for headers
        header_region = image[0:int(height*0.1), :]

        # OCR on header
        try:
            text = pytesseract.image_to_string(header_region)
            # Look for day patterns
            days = []
            day_patterns = [
                "monday", "tuesday", "wednesday", "thursday",
                "friday", "saturday", "sunday",
                "mon", "tue", "wed", "thu", "fri", "sat", "sun",
                "lun", "mar", "mer", "jeu", "ven", "sam", "dim"  # French
            ]
            text_lower = text.lower()
            for pattern in day_patterns:
                if pattern in text_lower:
                    days.append(pattern.capitalize()[:3])
            return days[:7]
        except Exception:
            return []

    def _detect_time_range(self, image: np.ndarray) -> dict:
        """Try to detect time range from left margin."""
        height, width = image.shape[:2]

        # Look at left portion for time labels
        time_region = image[:, 0:int(width*0.1)]

        try:
            text = pytesseract.image_to_string(time_region)
            # Look for time patterns
            import re
            times = re.findall(r'(\d{1,2})[:\.]?(\d{2})?\s*(am|pm)?', text.lower())

            if times:
                hours = [int(t[0]) for t in times]
                if hours:
                    return {
                        "start": f"{min(hours):02d}:00",
                        "end": f"{max(hours):02d}:00"
                    }
        except Exception:
            pass

        # Default time range
        return {"start": "08:00", "end": "18:00"}

    def _detect_events(self, image: np.ndarray) -> List[CalendarEvent]:
        """
        Detect calendar event blocks using color segmentation.

        Strategy:
        1. Convert to HSV for better color separation
        2. Find colored regions (non-white/gray)
        3. Use contour detection to find block boundaries
        4. Extract dominant color for each block
        """
        height, width = image.shape[:2]
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)

        events = []

        # Method 1: Find saturated colored regions (event blocks usually have color)
        saturation = hsv[:, :, 1]
        value = hsv[:, :, 2]

        # Create mask for colored regions (high saturation or specific patterns)
        colored_mask = (saturation > 40) | ((saturation > 20) & (value < 200))
        colored_mask = colored_mask.astype(np.uint8) * 255

        # Also detect regions that differ from white background
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        _, diff_mask = cv2.threshold(gray, 245, 255, cv2.THRESH_BINARY_INV)

        # Combine masks
        combined_mask = cv2.bitwise_or(colored_mask, diff_mask)

        # Clean up mask
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
        combined_mask = cv2.morphologyEx(combined_mask, cv2.MORPH_CLOSE, kernel)
        combined_mask = cv2.morphologyEx(combined_mask, cv2.MORPH_OPEN, kernel)

        if self.debug:
            self.debug_images['mask'] = combined_mask

        # Find contours
        contours, _ = cv2.findContours(combined_mask, cv2.RETR_EXTERNAL,
                                       cv2.CHAIN_APPROX_SIMPLE)

        # Process each contour
        for contour in contours:
            x, y, w, h = cv2.boundingRect(contour)

            # Filter by size (must be reasonable block size)
            if (w < width * self.MIN_BLOCK_WIDTH_RATIO or
                h < height * self.MIN_BLOCK_HEIGHT_RATIO or
                w > width * self.MAX_BLOCK_WIDTH_RATIO or
                h > height * self.MAX_BLOCK_HEIGHT_RATIO):
                continue

            # Filter by aspect ratio (blocks are usually wider than tall or square-ish)
            aspect_ratio = w / h if h > 0 else 0
            if aspect_ratio < 0.3 or aspect_ratio > 20:
                continue

            # Extract dominant color
            block_region = image[y:y+h, x:x+w]
            color = self._get_dominant_color(block_region)

            # Skip if color is too close to white/gray (likely background)
            if self._is_background_color(color):
                continue

            # Calculate confidence based on color saturation and contour area
            area_ratio = cv2.contourArea(contour) / (w * h) if w * h > 0 else 0
            confidence = min(1.0, area_ratio * 1.5)

            events.append(CalendarEvent(
                x=float(x),
                y=float(y),
                width=float(w),
                height=float(h),
                color=self._rgb_to_hex(color),
                text="",
                confidence=confidence
            ))

        return events

    def _get_dominant_color(self, region: np.ndarray) -> Tuple[int, int, int]:
        """
        Get the dominant color of a region.

        Uses k-means clustering to find the most common color,
        excluding very light colors (likely text or background).
        """
        if region.size == 0:
            return (128, 128, 128)

        # Reshape to list of pixels
        pixels = region.reshape(-1, 3).astype(np.float32)

        # Filter out very light pixels (likely background/text)
        hsv_pixels = cv2.cvtColor(region, cv2.COLOR_BGR2HSV).reshape(-1, 3)
        colored_mask = (hsv_pixels[:, 1] > 30) | (hsv_pixels[:, 2] < 200)
        colored_pixels = pixels[colored_mask]

        if len(colored_pixels) < 10:
            # Fallback: use mean of all pixels
            return tuple(map(int, np.mean(pixels, axis=0)))

        # K-means clustering to find dominant color
        criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 10, 1.0)
        k = min(3, len(colored_pixels))
        _, labels, centers = cv2.kmeans(colored_pixels, k, None, criteria,
                                        10, cv2.KMEANS_RANDOM_CENTERS)

        # Find most common cluster
        unique, counts = np.unique(labels, return_counts=True)
        dominant_idx = unique[np.argmax(counts)]
        dominant_color = centers[dominant_idx]

        # Convert BGR to RGB
        return (int(dominant_color[2]), int(dominant_color[1]), int(dominant_color[0]))

    def _is_background_color(self, color: Tuple[int, int, int]) -> bool:
        """Check if a color is likely a background color (white/gray)."""
        r, g, b = color

        # Check if grayscale-ish and light
        max_diff = max(abs(r-g), abs(g-b), abs(r-b))
        brightness = (r + g + b) / 3

        # White or very light gray
        if brightness > 230 and max_diff < 20:
            return True

        # Pure gray
        if max_diff < 10 and brightness > 180:
            return True

        return False

    def _rgb_to_hex(self, color: Tuple[int, int, int]) -> str:
        """Convert RGB tuple to hex string."""
        return "#{:02x}{:02x}{:02x}".format(color[0], color[1], color[2])

    def _extract_text(self, image: np.ndarray, events: List[CalendarEvent]) -> List[CalendarEvent]:
        """
        Extract text from each detected event block using OCR.
        """
        for event in events:
            x, y, w, h = int(event.x), int(event.y), int(event.width), int(event.height)

            # Extract block region with some padding
            pad = 2
            y1 = max(0, y - pad)
            y2 = min(image.shape[0], y + h + pad)
            x1 = max(0, x - pad)
            x2 = min(image.shape[1], x + w + pad)

            block_region = image[y1:y2, x1:x2]

            if block_region.size == 0:
                continue

            # Preprocess for OCR
            # Convert to grayscale
            gray = cv2.cvtColor(block_region, cv2.COLOR_BGR2GRAY)

            # Enhance contrast
            gray = cv2.convertScaleAbs(gray, alpha=1.5, beta=0)

            # Determine if text is light or dark
            mean_val = np.mean(gray)
            if mean_val < 128:
                # Light text on dark background - invert
                gray = cv2.bitwise_not(gray)

            # Resize if too small
            if h < 30:
                scale = 30 / h
                gray = cv2.resize(gray, None, fx=scale, fy=scale,
                                  interpolation=cv2.INTER_CUBIC)

            # OCR
            try:
                # Use PSM 6 for uniform block of text
                custom_config = r'--oem 3 --psm 6'
                text = pytesseract.image_to_string(gray, config=custom_config)
                event.text = text.strip().replace('\n', ' ')
            except Exception as e:
                if self.debug:
                    print(f"OCR failed for block at ({x}, {y}): {e}")

        return events

    def _normalize_coordinates(self, events: List[CalendarEvent],
                               width: int, height: int) -> List[CalendarEvent]:
        """Convert absolute pixel coordinates to relative (0-1) coordinates."""
        for event in events:
            event.x = event.x / width
            event.y = event.y / height
            event.width = event.width / width
            event.height = event.height / height
        return events

    def _filter_events(self, events: List[CalendarEvent]) -> List[CalendarEvent]:
        """
        Filter and validate detected events.

        - Remove duplicates
        - Remove overlapping detections (keep higher confidence)
        - Remove events with very low confidence
        """
        if not events:
            return events

        # Sort by confidence (highest first)
        events = sorted(events, key=lambda e: e.confidence, reverse=True)

        # Remove events with very low confidence
        events = [e for e in events if e.confidence > 0.3]

        # Remove overlapping events
        filtered = []
        for event in events:
            is_duplicate = False
            for existing in filtered:
                # Check IoU (Intersection over Union)
                iou = self._calculate_iou(event, existing)
                if iou > 0.5:
                    is_duplicate = True
                    break
            if not is_duplicate:
                filtered.append(event)

        return filtered

    def _calculate_iou(self, e1: CalendarEvent, e2: CalendarEvent) -> float:
        """Calculate Intersection over Union between two events."""
        x1 = max(e1.x, e2.x)
        y1 = max(e1.y, e2.y)
        x2 = min(e1.x + e1.width, e2.x + e2.width)
        y2 = min(e1.y + e1.height, e2.y + e2.height)

        if x1 >= x2 or y1 >= y2:
            return 0.0

        intersection = (x2 - x1) * (y2 - y1)
        area1 = e1.width * e1.height
        area2 = e2.width * e2.height
        union = area1 + area2 - intersection

        return intersection / union if union > 0 else 0.0

    def save_debug_images(self, output_dir: str):
        """Save debug images for visualization."""
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        for name, img in self.debug_images.items():
            cv2.imwrite(str(output_path / f"debug_{name}.png"), img)


def analyze_calendar(image_path: str, output_path: str = None, debug: bool = False) -> dict:
    """
    Convenience function to analyze a calendar screenshot.

    Args:
        image_path: Path to the calendar screenshot
        output_path: Optional path to save JSON output
        debug: Enable debug mode for visualization

    Returns:
        Dictionary with analysis results
    """
    analyzer = CalendarAnalyzer(debug=debug)
    result = analyzer.analyze(image_path)

    output = {
        "imageWidth": result.image_width,
        "imageHeight": result.image_height,
        "calendar": result.calendar,
        "events": result.events
    }

    if output_path:
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(output, f, indent=2, ensure_ascii=False)
        print(f"Analysis saved to: {output_path}")

    if debug:
        analyzer.save_debug_images(Path(image_path).parent / "debug")

    return output


def main():
    parser = argparse.ArgumentParser(
        description="Analyze calendar screenshot for 'Smash Your Week' game"
    )
    parser.add_argument("image", help="Path to calendar screenshot")
    parser.add_argument("-o", "--output", help="Output JSON file path")
    parser.add_argument("-d", "--debug", action="store_true",
                        help="Enable debug mode")
    parser.add_argument("-p", "--pretty", action="store_true",
                        help="Pretty print JSON to console")

    args = parser.parse_args()

    # Verify image exists
    if not Path(args.image).exists():
        print(f"Error: Image file not found: {args.image}")
        return 1

    # Set default output path
    output_path = args.output
    if not output_path:
        output_path = str(Path(args.image).with_suffix('.json'))

    try:
        result = analyze_calendar(args.image, output_path, debug=args.debug)

        if args.pretty:
            print("\n" + "="*50)
            print("ANALYSIS RESULT")
            print("="*50)
            print(json.dumps(result, indent=2, ensure_ascii=False))

        print(f"\nDetected {len(result['events'])} events")
        for i, event in enumerate(result['events'], 1):
            text_preview = event['text'][:30] + "..." if len(event['text']) > 30 else event['text']
            print(f"  {i}. {event['color']} - {text_preview or '(no text)'}")

        return 0

    except Exception as e:
        print(f"Error analyzing calendar: {e}")
        if args.debug:
            import traceback
            traceback.print_exc()
        return 1


if __name__ == "__main__":
    exit(main())
