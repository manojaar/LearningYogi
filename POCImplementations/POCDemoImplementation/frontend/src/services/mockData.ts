import type { TimetableData } from '@/types';

/**
 * Mock timetable data for demonstration
 * This can be used for testing when backend is not yet returning timetable data
 */
export const mockTimetableData: TimetableData = {
  teacher: "Mr. Smith",
  className: "Grade 5",
  term: "Term 1",
  year: 2024,
  timeblocks: [
    {
      day: "Monday",
      name: "Mathematics",
      startTime: "09:00",
      endTime: "10:00",
      notes: null
    },
    {
      day: "Monday",
      name: "English",
      startTime: "10:00",
      endTime: "11:00",
      notes: "Reading and Writing"
    },
    {
      day: "Monday",
      name: "Science",
      startTime: "11:30",
      endTime: "12:30",
      notes: "Lab Session"
    },
    {
      day: "Tuesday",
      name: "Mathematics",
      startTime: "09:00",
      endTime: "10:00",
      notes: null
    },
    {
      day: "Tuesday",
      name: "Art",
      startTime: "10:00",
      endTime: "11:00",
      notes: "Drawing"
    },
    {
      day: "Tuesday",
      name: "Physical Education",
      startTime: "14:00",
      endTime: "15:00",
      notes: "Outdoor Sports"
    },
    {
      day: "Wednesday",
      name: "English",
      startTime: "09:00",
      endTime: "10:30",
      notes: "Literature"
    },
    {
      day: "Wednesday",
      name: "History",
      startTime: "11:00",
      endTime: "12:00",
      notes: "World History"
    },
    {
      day: "Thursday",
      name: "Mathematics",
      startTime: "09:00",
      endTime: "10:00",
      notes: "Problem Solving"
    },
    {
      day: "Thursday",
      name: "Music",
      startTime: "10:30",
      endTime: "11:30",
      notes: "Choir Practice"
    },
    {
      day: "Friday",
      name: "Geography",
      startTime: "09:00",
      endTime: "10:00",
      notes: null
    },
    {
      day: "Friday",
      name: "Assembly",
      startTime: "10:30",
      endTime: "11:00",
      notes: "Weekly Assembly"
    }
  ]
};

