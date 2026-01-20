/**
 * Calendar Screenshot Analyzer for "Smash Your Week" Game
 *
 * Browser-based version using Canvas API and Tesseract.js
 * Analyzes calendar screenshots and extracts event blocks.
 */

export interface CalendarEvent {
  x: number; // Relative X position (0-1)
  y: number; // Relative Y position (0-1)
  width: number; // Relative width (0-1)
  height: number; // Relative height (0-1)
  color: string; // Hex color code
  text: string; // Event text/title
  confidence: number; // Detection confidence (0-1)
  id: string; // Unique identifier
}

export interface CalendarGrid {
  days: string[];
  timeRange: {
    start: string;
    end: string;
  };
  columns: number;
  rows: number;
}

export interface AnalysisResult {
  imageWidth: number;
  imageHeight: number;
  imageDataUrl: string;
  calendar: CalendarGrid;
  events: CalendarEvent[];
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ColorRGB {
  r: number;
  g: number;
  b: number;
}

/**
 * Main analyzer class for calendar screenshots
 */
export class CalendarAnalyzer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private imageData: ImageData | null = null;
  private width: number = 0;
  private height: number = 0;
  private enableOCR: boolean;

  // Configuration
  private readonly MIN_BLOCK_WIDTH_RATIO = 0.01; // Min width (1% of image)
  private readonly MIN_BLOCK_HEIGHT_RATIO = 0.005; // Min height (0.5% of image)
  private readonly MAX_BLOCK_WIDTH_RATIO = 0.5; // Max width (50% of image)
  private readonly MAX_BLOCK_HEIGHT_RATIO = 0.4; // Max height (40% of image)
  private readonly HEADER_RATIO = 0.05; // Top 5% is header/dates area - skip it
  private readonly MIN_ASPECT_RATIO = 0.2; // Min width/height ratio
  private readonly MAX_ASPECT_RATIO = 50; // Max width/height ratio

  constructor(enableOCR: boolean = false) {
    this.canvas = document.createElement("canvas");
    const ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      throw new Error("Could not get canvas context");
    }
    this.ctx = ctx;
    this.enableOCR = enableOCR;
  }

  /**
   * Analyze a calendar screenshot
   */
  async analyze(imageSource: string | File | Blob): Promise<AnalysisResult> {
    // Load image
    const image = await this.loadImage(imageSource);
    this.width = image.width;
    this.height = image.height;

    // Set canvas size
    this.canvas.width = this.width;
    this.canvas.height = this.height;

    // Draw image to canvas
    this.ctx.drawImage(image, 0, 0);
    this.imageData = this.ctx.getImageData(0, 0, this.width, this.height);

    // Get image as data URL for game background
    const imageDataUrl = this.canvas.toDataURL("image/png");

    // Detect calendar structure
    const calendar = this.detectGrid();

    // Detect event blocks
    let events = this.detectEvents();

    // Extract text if OCR is enabled
    if (this.enableOCR) {
      events = await this.extractTextOCR(events);
    }

    // Normalize coordinates to relative values
    events = this.normalizeCoordinates(events);

    // Filter overlapping/duplicate events
    events = this.filterEvents(events);

    // Add unique IDs
    events = events.map((event, index) => ({
      ...event,
      id: `event-${index}-${Date.now()}`,
    }));

    return {
      imageWidth: this.width,
      imageHeight: this.height,
      imageDataUrl,
      calendar,
      events,
    };
  }

  /**
   * Load image from various sources
   */
  private loadImage(source: string | File | Blob): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";

      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to load image"));

      if (typeof source === "string") {
        img.src = source;
      } else {
        img.src = URL.createObjectURL(source);
      }
    });
  }

  /**
   * Detect calendar grid structure
   */
  private detectGrid(): CalendarGrid {
    // Default structure - can be enhanced with more sophisticated detection
    return {
      days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      timeRange: {
        start: "08:00",
        end: "18:00",
      },
      columns: 7,
      rows: 24,
    };
  }

  /**
   * Detect colored event blocks in the calendar
   */
  private detectEvents(): CalendarEvent[] {
    if (!this.imageData) return [];

    const events: CalendarEvent[] = [];
    const visited = new Set<string>();
    const data = this.imageData.data;

    // Skip the header area (dates at the top)
    const startY = Math.floor(this.height * this.HEADER_RATIO);

    // Scan the image for colored regions (skip header)
    for (let y = startY; y < this.height; y += 2) {
      for (let x = 0; x < this.width; x += 2) {
        const key = `${x},${y}`;
        if (visited.has(key)) continue;

        const idx = (y * this.width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        // Check if this pixel is a colored block (not background)
        if (this.isColoredPixel(r, g, b)) {
          // Flood fill to find block boundaries
          const rect = this.floodFillBounds(x, y, visited);

          if (rect && this.isValidBlockSize(rect)) {
            const color = this.getDominantColor(rect);
            events.push({
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
              color: this.rgbToHex(color),
              text: "",
              confidence: this.calculateConfidence(rect),
              id: "",
            });
          }
        }
      }
    }

    return events;
  }

  /**
   * Check if a pixel is part of a colored block (not background)
   * A colored block is: any rectangle with color that is NOT:
   * - A grey calendar grid line (R ≈ G ≈ B)
   * - A white/near-white area
   */
  private isColoredPixel(r: number, g: number, b: number): boolean {
    // Check brightness
    const brightness = (r + g + b) / 3;

    // Filter out white/near-white pixels (background)
    if (brightness > 250) return false;

    // Check if pixel is grey (calendar grid lines have R ≈ G ≈ B)
    const maxDiff = Math.max(
      Math.abs(r - g),
      Math.abs(g - b),
      Math.abs(r - b)
    );

    // Only filter truly grey pixels (very similar R, G, B values)
    // Colored blocks have at least some difference between channels
    const isGrey = maxDiff < 10;

    // Filter out grey pixels (grid lines, borders)
    if (isGrey) return false;

    // Accept any pixel that has color (not grey, not white)
    return true;
  }

  /**
   * Flood fill to find block boundaries
   */
  private floodFillBounds(
    startX: number,
    startY: number,
    visited: Set<string>
  ): Rect | null {
    if (!this.imageData) return null;

    const data = this.imageData.data;
    const startIdx = (startY * this.width + startX) * 4;
    const startColor = {
      r: data[startIdx],
      g: data[startIdx + 1],
      b: data[startIdx + 2],
    };

    // BFS to find connected colored region
    const queue: [number, number][] = [[startX, startY]];
    let minX = startX,
      maxX = startX;
    let minY = startY,
      maxY = startY;
    let pixelCount = 0;
    const maxPixels = 50000; // Limit to prevent infinite loops

    while (queue.length > 0 && pixelCount < maxPixels) {
      const [x, y] = queue.shift()!;
      const key = `${x},${y}`;

      if (
        visited.has(key) ||
        x < 0 ||
        x >= this.width ||
        y < 0 ||
        y >= this.height
      ) {
        continue;
      }

      const idx = (y * this.width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      // Check if pixel is similar to start color
      if (!this.isColorSimilar(startColor, { r, g, b }, 50)) {
        continue;
      }

      visited.add(key);
      pixelCount++;

      // Update bounds
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);

      // Add neighbors (4-connectivity with step)
      const step = 2;
      queue.push([x + step, y], [x - step, y], [x, y + step], [x, y - step]);
    }

    if (pixelCount < 15) return null; // Too small - filter noise

    return {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    };
  }

  /**
   * Check if two colors are similar
   */
  private isColorSimilar(
    c1: ColorRGB,
    c2: ColorRGB,
    threshold: number
  ): boolean {
    const dr = Math.abs(c1.r - c2.r);
    const dg = Math.abs(c1.g - c2.g);
    const db = Math.abs(c1.b - c2.b);
    return dr + dg + db < threshold;
  }

  /**
   * Check if block size is valid
   */
  private isValidBlockSize(rect: Rect): boolean {
    const widthRatio = rect.width / this.width;
    const heightRatio = rect.height / this.height;
    const aspectRatio = rect.width / rect.height;

    // Check size constraints
    const validWidth = widthRatio >= this.MIN_BLOCK_WIDTH_RATIO &&
                       widthRatio <= this.MAX_BLOCK_WIDTH_RATIO;
    const validHeight = heightRatio >= this.MIN_BLOCK_HEIGHT_RATIO &&
                        heightRatio <= this.MAX_BLOCK_HEIGHT_RATIO;

    // Check aspect ratio to filter out lines (grid lines, dividers)
    const validAspect = aspectRatio >= this.MIN_ASPECT_RATIO &&
                        aspectRatio <= this.MAX_ASPECT_RATIO;

    return validWidth && validHeight && validAspect;
  }

  /**
   * Get dominant color of a region
   */
  private getDominantColor(rect: Rect): ColorRGB {
    if (!this.imageData) return { r: 128, g: 128, b: 128 };

    const data = this.imageData.data;
    const colorCounts = new Map<string, { color: ColorRGB; count: number }>();

    // Sample pixels in the region
    const sampleStep = Math.max(1, Math.floor(rect.width / 20));

    for (let y = rect.y; y < rect.y + rect.height; y += sampleStep) {
      for (let x = rect.x; x < rect.x + rect.width; x += sampleStep) {
        if (x >= this.width || y >= this.height) continue;

        const idx = (y * this.width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        // Quantize color for grouping
        const qr = Math.round(r / 20) * 20;
        const qg = Math.round(g / 20) * 20;
        const qb = Math.round(b / 20) * 20;
        const key = `${qr},${qg},${qb}`;

        const existing = colorCounts.get(key);
        if (existing) {
          existing.count++;
        } else {
          colorCounts.set(key, { color: { r: qr, g: qg, b: qb }, count: 1 });
        }
      }
    }

    // Find most common non-white color
    let maxCount = 0;
    let dominantColor: ColorRGB = { r: 128, g: 128, b: 128 };

    for (const { color, count } of colorCounts.values()) {
      // Skip near-white colors
      if (color.r > 230 && color.g > 230 && color.b > 230) continue;

      if (count > maxCount) {
        maxCount = count;
        dominantColor = color;
      }
    }

    return dominantColor;
  }

  /**
   * Calculate detection confidence
   */
  private calculateConfidence(rect: Rect): number {
    const area = rect.width * rect.height;
    const imageArea = this.width * this.height;
    const areaRatio = area / imageArea;

    // Confidence based on size (reasonable event blocks)
    if (areaRatio > 0.001 && areaRatio < 0.1) {
      return 0.8;
    } else if (areaRatio > 0.0005 && areaRatio < 0.15) {
      return 0.6;
    }
    return 0.4;
  }

  /**
   * Extract text using OCR (Tesseract.js)
   * Note: OCR is disabled by default for performance. Enable if needed.
   */
  private async extractTextOCR(
    events: CalendarEvent[]
  ): Promise<CalendarEvent[]> {
    // OCR disabled - would require tesseract.js dependency
    // To enable: npm install tesseract.js and uncomment below
    console.log("OCR disabled - blocks will not have text labels");
    return events;
  }

  /**
   * Normalize coordinates to relative values (0-1)
   */
  private normalizeCoordinates(events: CalendarEvent[]): CalendarEvent[] {
    return events.map((event) => ({
      ...event,
      x: event.x / this.width,
      y: event.y / this.height,
      width: event.width / this.width,
      height: event.height / this.height,
    }));
  }

  /**
   * Filter overlapping and duplicate events
   */
  private filterEvents(events: CalendarEvent[]): CalendarEvent[] {
    // Sort by confidence
    events.sort((a, b) => b.confidence - a.confidence);

    // Filter low confidence
    events = events.filter((e) => e.confidence > 0.3);

    // Remove overlapping
    const filtered: CalendarEvent[] = [];
    for (const event of events) {
      let isOverlapping = false;
      for (const existing of filtered) {
        const iou = this.calculateIoU(event, existing);
        if (iou > 0.3) {
          isOverlapping = true;
          break;
        }
      }
      if (!isOverlapping) {
        filtered.push(event);
      }
    }

    return filtered;
  }

  /**
   * Calculate Intersection over Union
   */
  private calculateIoU(e1: CalendarEvent, e2: CalendarEvent): number {
    const x1 = Math.max(e1.x, e2.x);
    const y1 = Math.max(e1.y, e2.y);
    const x2 = Math.min(e1.x + e1.width, e2.x + e2.width);
    const y2 = Math.min(e1.y + e1.height, e2.y + e2.height);

    if (x1 >= x2 || y1 >= y2) return 0;

    const intersection = (x2 - x1) * (y2 - y1);
    const area1 = e1.width * e1.height;
    const area2 = e2.width * e2.height;
    const union = area1 + area2 - intersection;

    return union > 0 ? intersection / union : 0;
  }

  /**
   * Convert RGB to hex
   */
  private rgbToHex(color: ColorRGB): string {
    return (
      "#" +
      [color.r, color.g, color.b]
        .map((c) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, "0"))
        .join("")
    );
  }

  /**
   * Convert RGB to HSL
   */
  private rgbToHsl(
    r: number,
    g: number,
    b: number
  ): { h: number; s: number; l: number } {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = ((max + min) / 2) * 100;

    if (max !== min) {
      const d = max - min;
      s = (l > 50 ? d / (2 - max - min) : d / (max + min)) * 100;

      switch (max) {
        case r:
          h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
          break;
        case g:
          h = ((b - r) / d + 2) / 6;
          break;
        case b:
          h = ((r - g) / d + 4) / 6;
          break;
      }
      h *= 360;
    }

    return { h, s, l };
  }
}

/**
 * Convenience function to analyze a calendar image
 */
export async function analyzeCalendar(
  imageSource: string | File | Blob,
  enableOCR: boolean = false
): Promise<AnalysisResult> {
  const analyzer = new CalendarAnalyzer(enableOCR);
  return analyzer.analyze(imageSource);
}

export default CalendarAnalyzer;
