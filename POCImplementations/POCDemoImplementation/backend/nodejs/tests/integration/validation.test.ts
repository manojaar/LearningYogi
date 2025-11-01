import { ValidationService } from '../../src/services/validation.service';
import { TimetableData } from '../../src/models/types';

describe('ValidationService Integration Tests', () => {
  let validationService: ValidationService;

  beforeEach(() => {
    validationService = new ValidationService();
  });

  describe('Valid Timetable Data', () => {
    it('should validate correct timetable data', () => {
      const validData: TimetableData = {
        teacher: 'Mr. Smith',
        className: 'Grade 5',
        term: 'Term 1',
        year: 2024,
        timeblocks: [
          {
            day: 'Monday',
            name: 'Mathematics',
            startTime: '09:00',
            endTime: '10:00',
            notes: null
          },
          {
            day: 'Tuesday',
            name: 'English',
            startTime: '10:00',
            endTime: '11:00',
            notes: 'Reading'
          }
        ]
      };

      const result = validationService.validateTimetable(validData);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle timetable with no optional fields', () => {
      const minimalData: TimetableData = {
        timeblocks: [
          {
            day: 'Monday',
            name: 'Math',
            startTime: '09:00',
            endTime: '10:00'
          }
        ]
      };

      const result = validationService.validateTimetable(minimalData);
      expect(result.valid).toBe(true);
    });
  });

  describe('Invalid Timetable Data', () => {
    it('should reject timetable with no timeblocks', () => {
      const invalidData: TimetableData = {
        timeblocks: []
      };

      const result = validationService.validateTimetable(invalidData);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('No timeblocks');
    });

    it('should detect invalid time formats', () => {
      const invalidData: TimetableData = {
        timeblocks: [
          {
            day: 'Monday',
            name: 'Math',
            startTime: 'invalid',
            endTime: '10:00'
          }
        ]
      };

      const result = validationService.validateTimetable(invalidData);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('invalid'))).toBe(true);
    });

    it('should detect end time before start time', () => {
      const invalidData: TimetableData = {
        timeblocks: [
          {
            day: 'Monday',
            name: 'Math',
            startTime: '10:00',
            endTime: '09:00'
          }
        ]
      };

      const result = validationService.validateTimetable(invalidData);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('after startTime'))).toBe(true);
    });

    it('should detect time conflicts on same day', () => {
      const invalidData: TimetableData = {
        timeblocks: [
          {
            day: 'Monday',
            name: 'Mathematics',
            startTime: '09:00',
            endTime: '10:00'
          },
          {
            day: 'Monday',
            name: 'English',
            startTime: '09:30',
            endTime: '10:30'
          }
        ]
      };

      const result = validationService.validateTimetable(invalidData);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('overlap'))).toBe(true);
    });
  });

  describe('Time Conflict Detection', () => {
    it('should allow non-overlapping timeblocks', () => {
      const validData: TimetableData = {
        timeblocks: [
          {
            day: 'Monday',
            name: 'Mathematics',
            startTime: '09:00',
            endTime: '10:00'
          },
          {
            day: 'Monday',
            name: 'English',
            startTime: '10:00',
            endTime: '11:00'
          }
        ]
      };

      const result = validationService.validateTimetable(validData);
      expect(result.valid).toBe(true);
    });

    it('should detect exact overlap', () => {
      const invalidData: TimetableData = {
        timeblocks: [
          {
            day: 'Monday',
            name: 'Mathematics',
            startTime: '09:00',
            endTime: '10:00'
          },
          {
            day: 'Monday',
            name: 'English',
            startTime: '09:00',
            endTime: '10:00'
          }
        ]
      };

      const result = validationService.validateTimetable(invalidData);
      expect(result.valid).toBe(false);
    });
  });
});

