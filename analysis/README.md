# Calendar Screenshot Analyzer

This module analyzes calendar screenshots (Google Calendar, Outlook, Apple Calendar, etc.) and extracts event blocks with their positions, colors, and text for the "Smash Your Week" game.

## Overview

The analyzer works in two modes:

1. **Python Mode** (for local processing or server-side)
   - Uses OpenCV for image processing
   - Uses Tesseract OCR for text extraction
   - More accurate, better for batch processing

2. **Browser Mode** (for client-side web app)
   - Uses Canvas API for image processing
   - Optional Tesseract.js for OCR
   - Runs entirely in the browser

## Output Format

Both modes produce the same JSON structure:

```json
{
  "imageWidth": 1920,
  "imageHeight": 1080,
  "calendar": {
    "days": ["Mon", "Tue", "Wed", "Thu", "Fri"],
    "timeRange": {
      "start": "08:00",
      "end": "18:00"
    },
    "columns": 5,
    "rows": 24
  },
  "events": [
    {
      "id": "event-0-1705767600000",
      "x": 0.15,
      "y": 0.25,
      "width": 0.12,
      "height": 0.08,
      "color": "#4285f4",
      "text": "Team Meeting",
      "confidence": 0.85
    }
  ]
}
```

### Field Descriptions

| Field | Description |
|-------|-------------|
| `x`, `y` | Relative position (0-1) from top-left corner |
| `width`, `height` | Relative size (0-1) of the event block |
| `color` | Hex color code of the event |
| `text` | Extracted text from OCR (may be empty) |
| `confidence` | Detection confidence (0-1) |

## Python Usage

### Installation

```bash
cd analysis
pip install -r requirements.txt

# Install Tesseract OCR
# macOS: brew install tesseract
# Ubuntu: sudo apt install tesseract-ocr
# Windows: Download from https://github.com/UB-Mannheim/tesseract/wiki
```

### Command Line

```bash
# Basic analysis
python calendar_analyzer.py screenshot.png

# With debug output
python calendar_analyzer.py screenshot.png --debug --pretty

# Custom output path
python calendar_analyzer.py screenshot.png -o output.json
```

### Python API

```python
from calendar_analyzer import analyze_calendar

# Analyze a screenshot
result = analyze_calendar("screenshot.png", output_path="output.json")

print(f"Found {len(result['events'])} events")
for event in result['events']:
    print(f"  - {event['text']} ({event['color']})")
```

## Browser Usage (TypeScript)

```typescript
import { analyzeCalendar } from './calendar-analyzer';

// From file input
const fileInput = document.querySelector('input[type="file"]');
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  const result = await analyzeCalendar(file);

  console.log(`Found ${result.events.length} events`);
  console.log('Image data URL:', result.imageDataUrl);
});

// From URL
const result = await analyzeCalendar('https://example.com/calendar.png');
```

## Detection Algorithm

1. **Color Segmentation**: Identifies colored regions that differ from white/gray backgrounds
2. **Contour Detection**: Finds boundaries of colored blocks
3. **Size Filtering**: Filters blocks by reasonable size (not too small or too large)
4. **Color Extraction**: Gets dominant color of each block using k-means clustering
5. **OCR** (optional): Extracts text from each detected block
6. **Deduplication**: Removes overlapping detections using IoU

## Supported Calendar Types

- Google Calendar
- Microsoft Outlook
- Apple Calendar
- Any calendar with colored event blocks on light background

## Limitations

- Works best with standard week/day views
- Requires colored event blocks (pure white events may not be detected)
- Text extraction accuracy depends on image quality
- May not detect overlapping events perfectly

## Sample Images

Place sample calendar screenshots in the `samples/` directory for testing.
