import React from 'react';
import { Calendar, Clock, User, MapPin, CheckCircle2 } from 'lucide-react';
import type { TimetableData } from '@/types';
import { getSubjectHexColor } from '@/services/subjectColors';

interface TimetableTableWidgetProps {
  timetable: TimetableData;
  confidence?: number;
  onViewDetails?: () => void;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export const TimetableTableWidget: React.FC<TimetableTableWidgetProps> = ({
  timetable,
  confidence = 1.0,
  onViewDetails,
}) => {
  const formatTime = (time: string | null | undefined): string => {
    if (!time) return 'N/A';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  // Group timeblocks by day
  const groupedByDay: { [key: string]: typeof timetable.timeblocks } = {};
  timetable.timeblocks.forEach(block => {
    if (!groupedByDay[block.day]) {
      groupedByDay[block.day] = [];
    }
    groupedByDay[block.day].push(block);
  });

  // Sort timeblocks by start time within each day
  Object.keys(groupedByDay).forEach(day => {
    groupedByDay[day].sort((a, b) => (a.startTime || '09:00').localeCompare(b.startTime || '09:00'));
  });

  const getConfidenceColor = () => {
    if (confidence >= 0.98) return 'text-green-600 bg-green-50';
    if (confidence >= 0.80) return 'text-yellow-600 bg-yellow-50';
    return 'text-orange-600 bg-orange-50';
  };

  const confidencePercent = Math.round(confidence * 100);

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Timetable</h3>
          </div>
          <div className={`px-2 py-1 rounded-md text-xs font-medium ${getConfidenceColor()}`}>
            {confidencePercent}% Confidence
          </div>
        </div>
        
        {/* Metadata */}
        <div className="flex items-center gap-4 mt-2">
          {timetable.teacher && (
            <div className="flex items-center gap-1.5 text-sm text-gray-700">
              <User className="w-4 h-4 text-blue-600" />
              <span className="font-medium">{timetable.teacher}</span>
            </div>
          )}
          {timetable.className && (
            <div className="flex items-center gap-1.5 text-sm text-gray-700">
              <MapPin className="w-4 h-4 text-purple-600" />
              <span className="font-medium">{timetable.className}</span>
            </div>
          )}
          {timetable.term && (
            <div className="text-sm text-gray-600">
              {timetable.term} {timetable.year && `• ${timetable.year}`}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto overflow-y-auto max-h-[400px]">
        <table className="w-full border-collapse min-w-[600px]">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                Day
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                Subject
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                Time
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                Duration
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                Notes
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {DAYS.map(day => {
              const dayBlocks = groupedByDay[day] || [];
              
              if (dayBlocks.length === 0) {
                return (
                  <tr key={day} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {day}
                    </td>
                    <td colSpan={4} className="px-4 py-3 text-sm text-gray-400 italic">
                      No classes scheduled
                    </td>
                  </tr>
                );
              }

              return dayBlocks.map((block, index) => {
                const bgColor = getSubjectHexColor(block.name);
                const duration = (() => {
                  if (!block.startTime || !block.endTime) return 'Duration unknown';
                  const [sh, sm] = block.startTime.split(':').map(Number);
                  const [eh, em] = block.endTime.split(':').map(Number);
                  const start = sh * 60 + sm;
                  const end = eh * 60 + em;
                  const minutes = end - start;
                  const hours = Math.floor(minutes / 60);
                  const mins = minutes % 60;
                  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
                })();

                return (
                  <tr key={`${day}-${index}`} className="hover:bg-gray-50 transition-colors">
                    {index === 0 && (
                      <td 
                        className="px-4 py-3 text-sm font-medium text-gray-900 align-top"
                        rowSpan={dayBlocks.length}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-blue-500" />
                          {day}
                        </div>
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: bgColor }}
                        />
                        <span className="text-sm font-medium text-gray-900">
                          {block.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-sm text-gray-700">
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        <span>
                          {block.startTime && block.endTime
                            ? `${formatTime(block.startTime)} - ${formatTime(block.endTime)}`
                            : 'Time not specified'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {duration}
                    </td>
                    <td className="px-4 py-3">
                      {block.notes ? (
                        <span className="text-xs text-gray-500 line-clamp-2" title={block.notes}>
                          {block.notes}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              });
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
        <div className="text-xs text-gray-500">
          {timetable.timeblocks.length} {timetable.timeblocks.length === 1 ? 'class' : 'classes'} scheduled
        </div>
        {onViewDetails && (
          <button
            onClick={onViewDetails}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
          >
            <CheckCircle2 className="w-4 h-4" />
            View Full Details
          </button>
        )}
      </div>
    </div>
  );
};

