# Timetable Table Widget
## Real-Time Timetable Display via SSE

## Overview

A beautiful, responsive table widget that displays timetable data directly in the processing notification once data is saved to the database. The widget receives data via Server-Sent Events (SSE) and displays it immediately without requiring navigation.

## Features

### Visual Design
- **Modern Table Layout**: Clean, professional table with proper spacing
- **Color-Coded Subjects**: Each subject has a distinct color indicator
- **Responsive Design**: Adapts to screen size (mobile-friendly)
- **Smooth Animations**: Framer Motion animations for appearance
- **Sticky Header**: Table header remains visible while scrolling

### Functionality
- **Real-Time Display**: Appears automatically when processing completes
- **Complete Data**: Shows all timetable information (teacher, class, term, year)
- **Time Formatting**: Displays times in 12-hour format (e.g., "9:00 AM")
- **Duration Calculation**: Automatically calculates class duration
- **Grouped by Day**: Classes organized by weekday
- **Empty State Handling**: Shows "No classes scheduled" for days without classes

## Implementation

### Component Structure

**File:** `frontend/src/components/TimetableTableWidget.tsx`

**Props:**
```typescript
interface TimetableTableWidgetProps {
  timetable: TimetableData;
  confidence?: number;
  onViewDetails?: () => void;
}
```

### Table Columns

1. **Day** - Weekday (Monday-Friday)
2. **Subject** - Class name with color indicator
3. **Time** - Start and end time (12-hour format)
4. **Duration** - Calculated duration (e.g., "1h 30m")
5. **Notes** - Additional notes if available

### Integration with SSE

**Backend Updates:**
- Modified `documentQueue.ts` to include full timetable data in SSE complete event
- Added `timetableData` field to `ProcessingEvent` interface

**Frontend Updates:**
- Updated `ProcessingNotification` to extract and display timetable data
- Widget automatically appears when `timetableData` is present in SSE event
- Expanded notification width when table is shown

### Data Flow

```
Processing Complete
       ↓
Save to Database (PostgreSQL/SQLite)
       ↓
Emit SSE Event with timetableData
       ↓
Frontend Receives Event
       ↓
Extract timetableData
       ↓
Display TimetableTableWidget
```

## Usage

### Automatic Display

The widget automatically appears in the `ProcessingNotification` component when:
1. Processing completes successfully
2. Timetable data is saved to database
3. SSE event contains `timetableData`

No additional code needed - it's integrated into the notification system.

### Manual Usage

```typescript
import { TimetableTableWidget } from '@/components/TimetableTableWidget';

<TimetableTableWidget
  timetable={timetableData}
  confidence={0.95}
  onViewDetails={() => navigate('/results/123')}
/>
```

## Styling

### Color Scheme
- **Header**: Blue gradient background (`from-blue-50 to-indigo-50`)
- **Table Headers**: Gray background (`bg-gray-50`)
- **Subject Colors**: Based on subject type (Math=Blue, Science=Green, etc.)
- **Confidence Badge**: Color-coded by confidence level
- **Hover Effects**: Subtle row highlighting on hover

### Responsive Behavior
- **Desktop**: Full-width table (max 1200px)
- **Tablet**: Responsive width with horizontal scroll
- **Mobile**: Scrollable table (min-width: 600px) with touch-friendly spacing

## Data Structure

### TimetableData Interface

```typescript
interface TimetableData {
  teacher?: string | null;
  className?: string | null;
  term?: string | null;
  year?: number | null;
  timeblocks: TimeBlock[];
}

interface TimeBlock {
  day: string;
  name: string;
  startTime: string;  // HH:MM format
  endTime: string;    // HH:MM format
  notes?: string | null;
}
```

## Example SSE Event

```json
{
  "type": "complete",
  "step": "Processing complete",
  "percentage": 100,
  "documentId": "abc-123",
  "timetableData": {
    "teacher": "Mr. Smith",
    "className": "Grade 5",
    "term": "Term 1",
    "year": 2024,
    "timeblocks": [
      {
        "day": "Monday",
        "name": "Mathematics",
        "startTime": "09:00",
        "endTime": "10:00",
        "notes": null
      }
    ],
    "confidence": 0.95,
    "validated": true
  }
}
```

## Benefits

1. **Instant Feedback**: Users see timetable data immediately after processing
2. **No Navigation Required**: Data visible in notification widget
3. **Professional Appearance**: Clean, modern table design
4. **Mobile Friendly**: Responsive and touch-optimized
5. **Real-Time Updates**: No polling or manual refresh needed

## Browser Support

- **Modern Browsers**: Full support (Chrome, Firefox, Safari, Edge)
- **Mobile Browsers**: Optimized for iOS Safari and Chrome Mobile
- **SSE Support**: All modern browsers support Server-Sent Events

## Performance

- **Rendering**: Efficient table rendering with React
- **Animations**: Hardware-accelerated Framer Motion animations
- **Scrolling**: Smooth scroll with sticky header
- **Memory**: Efficient component mounting/unmounting

## Future Enhancements

Potential improvements:
- Export to CSV/PDF directly from widget
- Filter by day or subject
- Sort by time or subject
- Print-friendly view
- Dark mode support

---

**Last Updated:** 2025-01-01  
**Version:** 1.0.0  
**Status:** ✅ Implemented and Ready


