# Learning Yogi Frontend - POC Demo

Modern, responsive React frontend for the Learning Yogi Timetable Extraction Platform.

## Quick Start

### Development

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev

# Open in browser
open http://localhost:3000
```

### Production

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

## Tech Stack

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool
- **TailwindCSS** - Styling
- **React Router** - Navigation
- **Axios** - HTTP client
- **Lucide React** - Icons

## Project Structure

```
frontend/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── UploadZone.tsx   # File upload with drag-drop
│   │   ├── ProcessingStatus.tsx  # Progress visualization
│   │   ├── TimetableViewer.tsx   # Timetable display
│   │   └── ErrorBoundary.tsx     # Error handling
│   ├── pages/               # Page components
│   │   ├── HomePage.tsx     # Upload page
│   │   └── ResultsPage.tsx  # Results page
│   ├── services/            # API & business logic
│   │   ├── api.ts           # HTTP client
│   │   ├── subjectColors.ts # Color mapping
│   │   └── mockData.ts      # Mock data (dev)
│   ├── types/               # TypeScript types
│   ├── styles/              # Global styles
│   └── main.tsx             # Entry point
├── public/                  # Static assets
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

## Components

### UploadZone

Drag-and-drop file upload component with validation and visual feedback.

**Props**:
- `onFileSelect(file: File)` - Callback when file selected
- `isUploading?: boolean` - Upload status

**Features**:
- Drag and drop support
- File type validation (PNG, JPG, PDF)
- Size limit (50MB)
- Visual feedback
- Error messages

### ProcessingStatus

Real-time processing progress visualization.

**Props**:
- `status: ProcessingStatus` - Processing status object

**Features**:
- Progress bar
- Step indicators
- Animated transitions
- Status icons

### TimetableViewer

Displays extracted timetable in weekly or daily view.

**Props**:
- `timetable: TimetableData` - Timetable data
- `confidence?: number` - Extraction confidence
- `viewMode?: ViewMode` - 'weekly' or 'daily'
- `onViewModeChange?: (mode: ViewMode) => void`

**Features**:
- Weekly grid view
- Daily timeline view
- Color-coded subjects
- Confidence badge
- Responsive layout

### ErrorBoundary

Catches and displays errors gracefully.

**Features**:
- Error messages
- Recovery options
- Debug information
- Navigation fallback

## Pages

### HomePage

Main upload page with hero section and upload zone.

**Features**:
- Value proposition
- Upload interface
- Feature highlights
- Modern design

### ResultsPage

Displays processing results and timetable.

**Features**:
- Progress tracking
- Result display
- Export options (CSV, JSON)
- Navigation
- Error handling

## Services

### API Service

HTTP client for backend communication.

**Functions**:
- `uploadDocument(file)` - Upload file
- `getDocument(id)` - Get document
- `getProcessingStatus(id)` - Get status
- `getTimetable(id)` - Get timetable
- `deleteDocument(id)` - Delete document

### Subject Colors

Maps subject names to color classes.

**Functions**:
- `getSubjectColor(name)` - Get color class
- `getSubjectHexColor(name)` - Get hex color

## Styling

### Tailwind Configuration

- Custom color palette
- Subject-specific colors
- Custom fonts (Inter, Poppins)
- Animations and transitions
- Responsive breakpoints

### CSS Classes

**Utility Classes**:
- `.card` - Card component
- `.btn-primary` - Primary button
- `.btn-secondary` - Secondary button
- `.input` - Form input

**Animations**:
- `.animate-fade-in` - Fade in
- `.animate-slide-up` - Slide up
- `.animate-pulse-slow` - Slow pulse

## Development

### Run Tests

```bash
npm test
npm run test:coverage
```

### Lint Code

```bash
npm run lint
```

### Build

```bash
npm run build
```

## Environment Variables

```bash
VITE_API_URL=http://localhost:4000
```

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Performance

- **Bundle size**: <200KB (gzipped)
- **First load**: <2s
- **Interaction**: <100ms
- **Animations**: 60fps

## Accessibility

- WCAG 2.1 AA compliant
- Keyboard navigation
- Screen reader support
- High contrast
- Focus indicators

## Design Inspiration

Based on best practices from:
- Behance UI/UX Gallery
- Learning Yogi brand
- Modern EdTech patterns

See [FEATURES.md](../docs/FEATURES.md) for detailed design documentation.

---

**Version**: 1.0.0  
**Last Updated**: 2025-01-01

