# Issue Fixes and Root Cause Analysis

This document tracks all issues encountered during development and their corresponding fixes with root cause analysis.

## Issues Fixed

### Issue #1: Docker Build Failure - Python AI Middleware (Debian Trixie)

**Date**: 2025-11-01  
**Service**: `POCDemoImplementation/backend/python`  
**Status**: ✅ Fixed

#### Problem
Docker build for Python AI Middleware was failing with the following error:
```
E: Package 'libgl1-mesa-glx' has no installation candidate
```

#### Root Cause
The `libgl1-mesa-glx` package is an obsolete package that was deprecated in Debian Bullseye and completely removed in Debian Trixie. The `python:3.11-slim` base image uses Debian Trixie, which no longer includes this package in its repositories.

The package was originally included for OpenCV's Qt backend, but modern versions of OpenCV have moved to GTK-based backends or headless configurations.

#### Solution
Removed `libgl1-mesa-glx` from the `apt-get install` command in the Dockerfile and added `--no-install-recommends` flag for a leaner image.

**Changes Made**:
```dockerfile
# Before
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    libtesseract-dev \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# After
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    libtesseract-dev \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/* && \
    apt-get clean
```

**File**: `POCDemoImplementation/backend/python/Dockerfile`

#### Prevention
- Regularly update Docker base images to latest stable versions
- Test Docker builds across different base image versions
- Use `--no-install-recommends` to avoid pulling unnecessary dependencies
- Consider using multi-stage builds to further optimize image size

---

### Issue #2: TypeScript Build Failure - Node.js API Service

**Date**: 2025-11-01  
**Service**: `POCDemoImplementation/backend/nodejs`  
**Status**: ✅ Fixed

#### Problem
TypeScript build was failing with multiple type errors:
1. Return type mismatch in `src/database/init.ts` - `Database` vs `Database.Database`
2. Type mismatch in `src/services/document.service.ts` - `undefined` vs `string | null`

#### Root Cause
1. **Database namespace issue**: The `better-sqlite3` library exports a namespace, and the correct type is `Database.Database`, not just `Database`.

2. **Optional fields handling**: The `TimetableData` interface has optional fields (e.g., `teacher?: string | null`), which means they can be `undefined`. However, the `TimetableRow` interface expects `string | null`, not `undefined`. This causes a type mismatch when passing optional fields directly to the database model.

#### Solution

**Fix 1**: Updated return type annotations in `src/database/init.ts`
```typescript
// Before
export function initializeDatabase(dbPath: string): Database {

// After
export function initializeDatabase(dbPath: string): Database.Database {
```

**Fix 2**: Used nullish coalescing operator in `src/services/document.service.ts` to convert `undefined` to `null`
```typescript
// Before
await this.timetableModel.create({
  id: timetableId,
  document_id: documentId,
  teacher_name: timetableData.teacher,
  class_name: timetableData.className,
  term: timetableData.term,
  year: timetableData.year,
  timeblocks: JSON.stringify(timetableData.timeblocks),
  confidence: ocrResult.confidence,
  validated: validation.valid,
});

// After
await this.timetableModel.create({
  id: timetableId,
  document_id: documentId,
  teacher_name: timetableData.teacher ?? null,
  class_name: timetableData.className ?? null,
  term: timetableData.term ?? null,
  year: timetableData.year ?? null,
  timeblocks: JSON.stringify(timetableData.timeblocks),
  confidence: ocrResult.confidence,
  validated: validation.valid,
});
```

**Files**: 
- `POCDemoImplementation/backend/nodejs/src/database/init.ts`
- `POCDemoImplementation/backend/nodejs/src/services/document.service.ts`

#### Prevention
- Enable TypeScript strict mode for better type safety
- Use consistent null handling patterns across the codebase
- Add pre-commit hooks to run TypeScript type checking
- Consider using a schema validation library (like Zod) for runtime type safety

---

### Issue #3: TypeScript Build Failure - Frontend

**Date**: 2025-11-01  
**Service**: `POCDemoImplementation/frontend`  
**Status**: ✅ Fixed

#### Problem
TypeScript build was failing with multiple errors:
1. Missing `ImportMeta` type definitions for Vite environment variables
2. Unused imports causing `TS6133` errors
3. Namespace conflict: `document` state variable shadowing global `document` object
4. Incorrect type for `NodeJS.Timeout`
5. Potential null reference errors

#### Root Cause
1. **Missing Vite types**: Vite requires explicit type definitions for `import.meta.env` usage in TypeScript.
2. **Strict linting**: TypeScript strict mode with `noUnusedLocals` and `noUnusedParameters` flags was enabled, causing errors for unused imports.
3. **Variable shadowing**: Using `document` as a state variable name shadows the global `document` object, causing type errors when trying to use DOM APIs.
4. **Incorrect namespace**: `NodeJS.Timeout` is not the correct type in modern Node.js/TypeScript environments.

#### Solution

**Fix 1**: Created `src/vite-env.d.ts` for Vite environment variable types
```typescript
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_CHATBOT_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

**Fix 2**: Removed unused imports from multiple files
- `src/components/TimetableViewer.tsx`: Removed `getSubjectColor` import
- `src/pages/HomePage.tsx`: Removed `getProcessingStatus` and `getDocument` imports

**Fix 3**: Renamed state variable from `document` to `doc` to avoid shadowing
```typescript
// Before
const [document, setDocument] = useState<Document | null>(null);

// After
const [doc, setDoc] = useState<Document | null>(null);
```

Updated all references throughout the file (10 occurrences).

**Fix 4**: Fixed timeout type annotation
```typescript
// Before
const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);

// After
const [pollInterval, setPollInterval] = useState<ReturnType<typeof setInterval> | null>(null);
```

**Fix 5**: Fixed unused variable warning
```typescript
// Before
const [startHour, startMin] = timeBlock.startTime.split(':').map(Number);

// After
const [startHour, _startMin] = timeBlock.startTime.split(':').map(Number);
```

**Files**:
- `POCDemoImplementation/frontend/src/vite-env.d.ts` (new file)
- `POCDemoImplementation/frontend/src/components/TimetableViewer.tsx`
- `POCDemoImplementation/frontend/src/pages/HomePage.tsx`
- `POCDemoImplementation/frontend/src/pages/ResultsPage.tsx`

#### Prevention
- Always use unique variable names that don't shadow global objects
- Configure ESLint to warn about variable shadowing
- Document naming conventions in team coding standards
- Use explicit type annotations for better IDE support
- Add pre-commit hooks to catch type errors early

---

## Lessons Learned

1. **Base Image Compatibility**: Always test Docker builds with the latest base images and be aware of deprecated packages.

2. **Type Safety**: Enable TypeScript strict mode from the beginning of projects to catch type issues early.

3. **Variable Naming**: Avoid shadowing global objects (like `document`, `window`, `console`) with local variables.

4. **Null Handling**: Establish consistent patterns for handling optional/nullable values across the entire codebase.

5. **Unused Code**: Keep code clean by removing unused imports and variables, but consider using a linter to catch these automatically.

## Future Recommendations

1. Add CI/CD pipeline to automatically test Docker builds on each commit
2. Implement pre-commit hooks using Husky to run linting and type checking
3. Add integration tests for Docker Compose services
4. Document naming conventions and coding standards
5. Consider using tools like Docker Scout for security scanning
6. Add health checks to all Docker services for better monitoring

---

**Document Version**: 1.0.0  
**Last Updated**: 2025-11-01

