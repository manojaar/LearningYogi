import React, { useState } from 'react';
import { Calendar, List, CheckCircle2, AlertTriangle, Clock, User, MapPin } from 'lucide-react';
import type { TimetableData, TimeBlock, ViewMode } from '@/types';
import { getSubjectHexColor } from '@/services/subjectColors';

interface TimetableViewerProps {
  timetable: TimetableData;
  confidence?: number;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const TIME_SLOTS = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

export const TimetableViewer: React.FC<TimetableViewerProps> = ({
  timetable,
  confidence = 1.0,
  viewMode: initialViewMode = 'weekly',
  onViewModeChange,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    onViewModeChange?.(mode);
  };

  const getConfidenceBadge = () => {
    const confidencePercent = Math.round(confidence * 100);
    
    if (confidence >= 0.98) {
      return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-lg">
          <CheckCircle2 className="w-4 h-4 text-green-600" />
          <span className="text-sm font-medium text-green-700">{confidencePercent}%</span>
        </div>
      );
    } else if (confidence >= 0.80) {
      return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-50 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-yellow-600" />
          <span className="text-sm font-medium text-yellow-700">{confidencePercent}%</span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-orange-600" />
          <span className="text-sm font-medium text-orange-700">{confidencePercent}%</span>
        </div>
      );
    }
  };

  const formatTime = (time: string): string => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getTimeBlockPosition = (timeBlock: TimeBlock): { row: number; span: number } => {
    const [startHour, _startMin] = timeBlock.startTime.split(':').map(Number);
    const [endHour, endMin] = timeBlock.endTime.split(':').map(Number);
    
    const startSlot = startHour - 8;
    const endSlot = endHour - 8 + (endMin > 0 ? 1 : 0);
    const span = endSlot - startSlot;
    
    return { row: startSlot, span };
  };

  const WeeklyView = () => {
    const gridData: { [key: string]: TimeBlock[] } = {};
    
    // Group timeblocks by day
    timetable.timeblocks.forEach(block => {
      if (!gridData[block.day]) {
        gridData[block.day] = [];
      }
      gridData[block.day].push(block);
    });

    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="w-24 p-3 text-left text-xs font-semibold text-gray-600 uppercase bg-gray-50 border-b border-gray-200 sticky left-0 z-10">
                Time
              </th>
              {DAYS.map(day => (
                <th key={day} className="p-3 text-center text-sm font-semibold text-gray-900 bg-gray-50 border-b border-gray-200">
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TIME_SLOTS.map((slot, slotIndex) => (
              <tr key={slot} className="border-b border-gray-100">
                <td className="p-3 text-xs font-medium text-gray-500 bg-gray-50 sticky left-0 z-10">
                  {formatTime(slot)}
                </td>
                {DAYS.map(day => {
                  const dayBlocks = gridData[day] || [];
                  const blockAtSlot = dayBlocks.find(block => {
                    const pos = getTimeBlockPosition(block);
                    return pos.row === slotIndex;
                  });

                  if (blockAtSlot) {
                    const pos = getTimeBlockPosition(blockAtSlot);
                    const bgColor = getSubjectHexColor(blockAtSlot.name);
                    
                    return (
                      <td
                        key={day}
                        className="p-0 relative"
                        rowSpan={pos.span}
                      >
                        <div
                          className="m-1 p-3 rounded-lg text-white cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02]"
                          style={{
                            background: `linear-gradient(135deg, ${bgColor} 0%, ${bgColor}dd 100%)`,
                          }}
                        >
                          <div className="space-y-1">
                            <h4 className="font-semibold text-sm leading-tight">{blockAtSlot.name}</h4>
                            <p className="text-xs opacity-90">
                              {formatTime(blockAtSlot.startTime)} - {formatTime(blockAtSlot.endTime)}
                            </p>
                            {blockAtSlot.notes && (
                              <p className="text-xs opacity-75 mt-2 line-clamp-2">{blockAtSlot.notes}</p>
                            )}
                          </div>
                        </div>
                      </td>
                    );
                  }

                  return <td key={day} className="p-3" />;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const DailyView = () => {
    const dayBlocks = selectedDay
      ? timetable.timeblocks.filter(block => block.day === selectedDay)
      : timetable.timeblocks;

    const sortedBlocks = [...dayBlocks].sort((a, b) => {
      return a.startTime.localeCompare(b.startTime);
    });

    return (
      <div className="space-y-4">
        {/* Day Selector */}
        <div className="flex flex-wrap gap-2">
          {DAYS.map(day => (
            <button
              key={day}
              onClick={() => setSelectedDay(selectedDay === day ? null : day)}
              className={`
                px-4 py-2 rounded-lg text-sm font-medium transition-colors
                ${selectedDay === day
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }
              `}
            >
              {day}
            </button>
          ))}
        </div>

        {/* Timeline */}
        <div className="relative">
          {/* Timeline Line */}
          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-primary-200" />

          {/* Blocks */}
          <div className="space-y-4">
            {sortedBlocks.map((block, index) => {
              const bgColor = getSubjectHexColor(block.name);
              
              return (
                <div key={index} className="relative flex items-start gap-4">
                  {/* Time Marker */}
                  <div className="flex items-center justify-center w-16 h-12 bg-white border-2 border-primary-200 rounded-lg z-10">
                    <span className="text-xs font-semibold text-gray-900">
                      {formatTime(block.startTime)}
                    </span>
                  </div>

                  {/* Block */}
                  <div
                    className="flex-1 p-4 rounded-lg text-white transition-all hover:shadow-lg cursor-pointer"
                    style={{
                      background: `linear-gradient(135deg, ${bgColor} 0%, ${bgColor}dd 100%)`,
                    }}
                  >
                    <div className="space-y-2">
                      <h4 className="font-semibold text-base">{block.name}</h4>
                      <div className="flex items-center gap-4 text-xs opacity-90">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTime(block.startTime)} - {formatTime(block.endTime)}
                        </span>
                      </div>
                      {block.notes && (
                        <p className="text-sm opacity-75 mt-2">{block.notes}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            {timetable.teacher && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-lg">
                <User className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-700">{timetable.teacher}</span>
              </div>
            )}
            {timetable.className && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 rounded-lg">
                <MapPin className="w-4 h-4 text-purple-600" />
                <span className="text-sm font-medium text-purple-700">{timetable.className}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {getConfidenceBadge()}
          
          {/* View Toggle */}
          <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
            <button
              onClick={() => handleViewModeChange('weekly')}
              className={`
                p-2 rounded-md transition-colors
                ${viewMode === 'weekly'
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
                }
              `}
            >
              <Calendar className="w-5 h-5" />
            </button>
            <button
              onClick={() => handleViewModeChange('daily')}
              className={`
                p-2 rounded-md transition-colors
                ${viewMode === 'daily'
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
                }
              `}
            >
              <List className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Timetable Content */}
      <div className="card">
        {viewMode === 'weekly' ? <WeeklyView /> : <DailyView />}
      </div>
    </div>
  );
};

