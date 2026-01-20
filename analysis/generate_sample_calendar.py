#!/usr/bin/env python3
"""
Generate a sample calendar image for testing the analyzer.
Creates a realistic-looking week view calendar with colored events.
"""

from PIL import Image, ImageDraw, ImageFont
import random
import json
from pathlib import Path


def generate_sample_calendar(
    output_path: str = "samples/sample_calendar.png",
    width: int = 1200,
    height: int = 800,
    seed: int = 42
) -> dict:
    """
    Generate a sample calendar image and return the expected JSON.

    Args:
        output_path: Where to save the image
        width: Image width
        height: Image height
        seed: Random seed for reproducibility

    Returns:
        Expected analysis JSON
    """
    random.seed(seed)

    # Create image
    img = Image.new('RGB', (width, height), 'white')
    draw = ImageDraw.Draw(img)

    # Try to load a font, fall back to default
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 12)
        font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 10)
        font_header = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 14)
    except Exception:
        font = ImageFont.load_default()
        font_small = font
        font_header = font

    # Calendar layout
    header_height = 50
    time_column_width = 60
    grid_top = header_height
    grid_left = time_column_width
    grid_width = width - time_column_width - 20
    grid_height = height - header_height - 20

    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    num_days = 7
    day_width = grid_width // num_days

    # Time range
    start_hour = 8
    end_hour = 20
    num_hours = end_hour - start_hour
    hour_height = grid_height // num_hours

    # Draw header with day names
    draw.rectangle([0, 0, width, header_height], fill='#f8f9fa', outline='#e0e0e0')
    for i, day in enumerate(days):
        x = grid_left + i * day_width + day_width // 2
        draw.text((x, header_height // 2), day[:3], fill='#333333', font=font_header, anchor='mm')

    # Draw time column
    for h in range(num_hours + 1):
        y = grid_top + h * hour_height
        time_str = f"{start_hour + h:02d}:00"
        draw.text((time_column_width - 10, y), time_str, fill='#666666', font=font_small, anchor='rm')

    # Draw grid lines
    for i in range(num_days + 1):
        x = grid_left + i * day_width
        draw.line([(x, grid_top), (x, height - 20)], fill='#e0e0e0', width=1)

    for h in range(num_hours + 1):
        y = grid_top + h * hour_height
        draw.line([(grid_left, y), (width - 20, y)], fill='#e0e0e0', width=1)

    # Event colors (Google Calendar style)
    event_colors = [
        '#4285f4',  # Blue
        '#ea4335',  # Red
        '#34a853',  # Green
        '#fbbc04',  # Yellow
        '#9c27b0',  # Purple
        '#00acc1',  # Cyan
        '#ff7043',  # Orange
        '#7cb342',  # Light green
    ]

    # Sample events
    event_templates = [
        "Team Standup",
        "Project Review",
        "Client Meeting",
        "Lunch Break",
        "Code Review",
        "Design Sprint",
        "1:1 with Manager",
        "Planning Session",
        "Demo Meeting",
        "Training Session",
        "Interview",
        "Workshop",
        "Retrospective",
        "All Hands",
    ]

    # Generate events
    events = []
    events_json = []

    for day_idx in range(num_days):
        # Random number of events per day
        num_events = random.randint(1, 4)
        day_events = []

        for _ in range(num_events):
            # Random start time and duration
            start_time = random.randint(0, num_hours - 2)
            duration = random.randint(1, 3)

            # Check for overlaps
            overlaps = False
            for existing in day_events:
                if not (start_time >= existing[1] or start_time + duration <= existing[0]):
                    overlaps = True
                    break

            if overlaps:
                continue

            day_events.append((start_time, start_time + duration))

            # Calculate position
            x = grid_left + day_idx * day_width + 4
            y = grid_top + start_time * hour_height + 2
            w = day_width - 8
            h = duration * hour_height - 4

            # Choose color and text
            color = random.choice(event_colors)
            text = random.choice(event_templates)

            # Draw event block
            draw.rounded_rectangle([x, y, x + w, y + h], radius=4, fill=color)

            # Draw text (white for visibility)
            text_x = x + 6
            text_y = y + 6

            # Truncate text if too long
            max_chars = (w - 12) // 7
            display_text = text[:max_chars] + "..." if len(text) > max_chars else text
            draw.text((text_x, text_y), display_text, fill='white', font=font_small)

            # Add to JSON
            events_json.append({
                "id": f"event-{len(events_json)}",
                "x": round(x / width, 4),
                "y": round(y / height, 4),
                "width": round(w / width, 4),
                "height": round(h / height, 4),
                "color": color,
                "text": text,
                "confidence": 0.85
            })

    # Save image
    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    img.save(output_path, 'PNG')
    print(f"Generated sample calendar: {output_path}")

    # Build result JSON
    result = {
        "imageWidth": width,
        "imageHeight": height,
        "calendar": {
            "days": [d[:3] for d in days],
            "timeRange": {
                "start": f"{start_hour:02d}:00",
                "end": f"{end_hour:02d}:00"
            },
            "columns": num_days,
            "rows": num_hours
        },
        "events": events_json
    }

    # Save expected JSON
    json_path = output_path.replace('.png', '_expected.json')
    with open(json_path, 'w') as f:
        json.dump(result, f, indent=2)
    print(f"Generated expected JSON: {json_path}")

    return result


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Generate sample calendar for testing")
    parser.add_argument("-o", "--output", default="samples/sample_calendar.png",
                        help="Output image path")
    parser.add_argument("-W", "--width", type=int, default=1200, help="Image width")
    parser.add_argument("-H", "--height", type=int, default=800, help="Image height")
    parser.add_argument("-s", "--seed", type=int, default=42, help="Random seed")

    args = parser.parse_args()

    result = generate_sample_calendar(
        output_path=args.output,
        width=args.width,
        height=args.height,
        seed=args.seed
    )

    print(f"\nGenerated {len(result['events'])} events")
