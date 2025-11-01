import { TimetableData, TimeBlock } from '../models/types';

/**
 * Validation service for timetable data
 */
export class ValidationService {
  /**
   * Validate timetable data
   */
  validateTimetable(data: TimetableData): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check timeblocks exist
    if (!data.timeblocks || data.timeblocks.length === 0) {
      errors.push('No timeblocks found in timetable');
      return { valid: false, errors };
    }

    // Validate each timeblock
    data.timeblocks.forEach((block, index) => {
      const blockErrors = this.validateTimeBlock(block, index);
      errors.push(...blockErrors);
    });

    // Check for time conflicts
    const conflictErrors = this.checkTimeConflicts(data.timeblocks);
    errors.push(...conflictErrors);

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate a single timeblock
   */
  private validateTimeBlock(block: TimeBlock, index: number): string[] {
    const errors: string[] = [];

    if (!block.day) {
      errors.push(`Timeblock ${index}: missing day`);
    }

    if (!block.name) {
      errors.push(`Timeblock ${index}: missing name`);
    }

    if (!block.startTime) {
      errors.push(`Timeblock ${index}: missing startTime`);
    }

    if (!block.endTime) {
      errors.push(`Timeblock ${index}: missing endTime`);
    }

    // Validate time format
    if (block.startTime && !/^\d{2}:\d{2}$/.test(block.startTime)) {
      errors.push(`Timeblock ${index}: invalid startTime format (expected HH:MM)`);
    }

    if (block.endTime && !/^\d{2}:\d{2}$/.test(block.endTime)) {
      errors.push(`Timeblock ${index}: invalid endTime format (expected HH:MM)`);
    }

    // Validate time logic
    if (block.startTime && block.endTime) {
      const start = this.parseTime(block.startTime);
      const end = this.parseTime(block.endTime);

      if (start >= end) {
        errors.push(`Timeblock ${index}: endTime must be after startTime`);
      }
    }

    return errors;
  }

  /**
   * Check for time conflicts within timetable
   */
  private checkTimeConflicts(timeblocks: TimeBlock[]): string[] {
    const errors: string[] = [];

    // Group by day
    const byDay: { [day: string]: TimeBlock[] } = {};
    timeblocks.forEach(block => {
      if (!byDay[block.day]) {
        byDay[block.day] = [];
      }
      byDay[block.day].push(block);
    });

    // Check conflicts within each day
    Object.entries(byDay).forEach(([day, blocks]) => {
      for (let i = 0; i < blocks.length; i++) {
        for (let j = i + 1; j < blocks.length; j++) {
          if (this.timesOverlap(blocks[i], blocks[j])) {
            errors.push(
              `Time conflict on ${day}: "${blocks[i].name}" overlaps with "${blocks[j].name}"`
            );
          }
        }
      }
    });

    return errors;
  }

  /**
   * Check if two timeblocks overlap
   */
  private timesOverlap(block1: TimeBlock, block2: TimeBlock): boolean {
    const start1 = this.parseTime(block1.startTime);
    const end1 = this.parseTime(block1.endTime);
    const start2 = this.parseTime(block2.startTime);
    const end2 = this.parseTime(block2.endTime);

    return start1 < end2 && start2 < end1;
  }

  /**
   * Parse time string to minutes since midnight
   */
  private parseTime(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }
}

