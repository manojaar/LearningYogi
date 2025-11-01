import { ValidationService } from '../../src/services/validation.service';
import { TimetableData } from '../../src/models/types';

describe('ValidationService Unit Tests', () => {
  let validation: ValidationService;

  beforeEach(() => {
    validation = new ValidationService();
  });

  describe('validateTimetable', () => {
    it('should validate correct timetable', () => {
      const data: TimetableData = {
        teacher: 'Mr. Smith',
        className: 'Grade 5',
        timeblocks: [
          {
            day: 'Monday',
            name: 'Mathematics',
            startTime: '09:00',
            endTime: '10:00'
          }
        ]
      };

      const result = validation.validateTimetable(data);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty timeblocks', () => {
      const data: TimetableData = {
        timeblocks: []
      };

      const result = validation.validateTimetable(data);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should detect invalid time formats', () => {
      const data: TimetableData = {
        timeblocks: [
          {
            day: 'Monday',
            name: 'Math',
            startTime: 'invalid',
            endTime: '10:00'
          }
        ]
      };

      const result = validation.validateTimetable(data);
      expect(result.valid).toBe(false);
    });

    it('should detect time conflicts', () => {
      const data: TimetableData = {
        timeblocks: [
          {
            day: 'Monday',
            name: 'Math',
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

      const result = validation.validateTimetable(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('overlap'))).toBe(true);
    });
  });
});

