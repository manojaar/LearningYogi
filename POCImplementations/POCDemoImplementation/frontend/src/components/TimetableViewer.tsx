import React, { useState } from 'react';
import { Calendar, List, CheckCircle2, AlertTriangle, Clock, User, MapPin, Edit2, Save, X, Loader2, Copy, Plus } from 'lucide-react';
import type { TimetableData, TimeBlock, ViewMode } from '@/types';
import { getSubjectHexColor } from '@/services/subjectColors';
import { updateTimetable, saveTimetableAs } from '@/services/api';
import { formatErrorMessage } from '@/services/errorMessages';

interface TimetableViewerProps {
  timetable: TimetableData;
  confidence?: number;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  documentId?: string;
  onUpdate?: (updatedTimetable: TimetableData) => void;
  isSavedTimetable?: boolean;  // If true, this is a saved immutable timetable
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const TIME_SLOTS = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

export const TimetableViewer: React.FC<TimetableViewerProps> = ({
  timetable: initialTimetable,
  confidence = 1.0,
  viewMode: initialViewMode = 'weekly',
  onViewModeChange,
  documentId,
  onUpdate,
  isSavedTimetable = false,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedTimetable, setEditedTimetable] = useState<TimetableData>(initialTimetable);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showSaveAs, setShowSaveAs] = useState(false);
  const [saveAsName, setSaveAsName] = useState<string>('');
  const [isSavingAs, setIsSavingAs] = useState(false);
  const [newBlockDay, setNewBlockDay] = useState<string>('Monday');

  const timetable = isEditMode ? editedTimetable : initialTimetable;

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    onViewModeChange?.(mode);
  };

  const handleEdit = () => {
    setEditedTimetable({ ...initialTimetable });
    setIsEditMode(true);
    setError(null);
    setSuccess(false);
  };

  const handleCancel = () => {
    setIsEditMode(false);
    setEditedTimetable({ ...initialTimetable });
    setError(null);
    setSuccess(false);
  };

  const handleSave = async () => {
    if (!documentId) {
      setError('Document ID is required to save changes');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const updated = await updateTimetable(documentId, {
        teacher_name: editedTimetable.teacher ?? null,
        class_name: editedTimetable.className ?? null,
        term: editedTimetable.term ?? null,
        year: editedTimetable.year ?? null,
        saved_name: editedTimetable.savedName ?? null,
        timeblocks: editedTimetable.timeblocks,
      });

      // Convert response to TimetableData format
      // Backend returns timeblocks as parsed array, not string
      const timeblocks = Array.isArray(updated.timeblocks) 
        ? updated.timeblocks as TimeBlock[]
        : [];

      const updatedTimetable: TimetableData = {
        teacher: updated.teacher_name,
        className: updated.class_name,
        term: updated.term,
        year: updated.year,
        savedName: updated.saved_name,
        timeblocks,
      };

      setIsEditMode(false);
      setSuccess(true);
      onUpdate?.(updatedTimetable);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(formatErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const updateTimetableField = (field: keyof TimetableData, value: any) => {
    setEditedTimetable({ ...editedTimetable, [field]: value });
  };

  const updateTimeBlock = (index: number, field: keyof TimeBlock, value: any) => {
    const updatedTimeblocks = [...editedTimetable.timeblocks];
    updatedTimeblocks[index] = { ...updatedTimeblocks[index], [field]: value };
    setEditedTimetable({ ...editedTimetable, timeblocks: updatedTimeblocks });
  };

  const addNewTimeBlock = (day?: string) => {
    const newBlock: TimeBlock = {
      day: day || 'Monday',
      name: '',
      startTime: null,
      endTime: null,
      notes: null,
    };
    const updatedTimeblocks = [...editedTimetable.timeblocks, newBlock];
    setEditedTimetable({ ...editedTimetable, timeblocks: updatedTimeblocks });
  };

  const removeTimeBlock = (index: number) => {
    const updatedTimeblocks = editedTimetable.timeblocks.filter((_, i) => i !== index);
    setEditedTimetable({ ...editedTimetable, timeblocks: updatedTimeblocks });
  };

  const handleSaveAs = async () => {
    if (!saveAsName.trim()) {
      setError('Please enter a name for the saved timetable');
      return;
    }

    setIsSavingAs(true);
    setError(null);
    setSuccess(false);

    try {
      await saveTimetableAs({
        document_id: documentId || null,
        teacher_name: editedTimetable.teacher ?? null,
        class_name: editedTimetable.className ?? null,
        term: editedTimetable.term ?? null,
        year: editedTimetable.year ?? null,
        saved_name: saveAsName.trim(),
        timeblocks: editedTimetable.timeblocks,
        confidence: confidence,
      });

      setSuccess(true);
      setShowSaveAs(false);
      setSaveAsName('');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(formatErrorMessage(err));
    } finally {
      setIsSavingAs(false);
    }
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

  const formatTime = (time: string | null | undefined): string => {
    if (!time) return 'N/A';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getTimeBlockPosition = (timeBlock: TimeBlock): { row: number; span: number } => {
    // Handle missing times gracefully - use defaults
    const startTime = timeBlock.startTime || '09:00';
    const endTime = timeBlock.endTime || '10:00';

    const [startHour, _startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);

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
                    const blockIndex = timetable.timeblocks.findIndex(
                      b => b.day === blockAtSlot.day && 
                      b.name === blockAtSlot.name && 
                      b.startTime === blockAtSlot.startTime
                    );
                    
                    return (
                      <td
                        key={day}
                        className="p-0 relative"
                        rowSpan={pos.span}
                      >
                        {isEditMode ? (
                          <div className="m-1 p-3 rounded-lg border-2 border-primary-300 bg-white">
                            <div className="space-y-2">
                              <select
                                key={`block-${blockIndex}-day`}
                                value={blockAtSlot.day}
                                onChange={(e) => updateTimeBlock(blockIndex >= 0 ? blockIndex : 0, 'day', e.target.value)}
                                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                              >
                                {DAYS.map(d => (
                                  <option key={d} value={d}>{d}</option>
                                ))}
                              </select>
                              <input
                                key={`block-${blockIndex}-name`}
                                type="text"
                                value={blockAtSlot.name}
                                onChange={(e) => updateTimeBlock(blockIndex >= 0 ? blockIndex : 0, 'name', e.target.value)}
                                className="w-full px-2 py-1 text-sm font-semibold border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                                placeholder="Subject name"
                              />
                              <div className="flex gap-2">
                                <input
                                  key={`block-${blockIndex}-start`}
                                  type="time"
                                  value={blockAtSlot.startTime || ''}
                                  onChange={(e) => updateTimeBlock(blockIndex >= 0 ? blockIndex : 0, 'startTime', e.target.value)}
                                  className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                                />
                                <input
                                  key={`block-${blockIndex}-end`}
                                  type="time"
                                  value={blockAtSlot.endTime || ''}
                                  onChange={(e) => updateTimeBlock(blockIndex >= 0 ? blockIndex : 0, 'endTime', e.target.value)}
                                  className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                                />
                              </div>
                              <input
                                key={`block-${blockIndex}-notes`}
                                type="text"
                                value={blockAtSlot.notes || ''}
                                onChange={(e) => updateTimeBlock(blockIndex >= 0 ? blockIndex : 0, 'notes', e.target.value)}
                                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                                placeholder="Notes (optional)"
                              />
                              <button
                                onClick={() => removeTimeBlock(blockIndex >= 0 ? blockIndex : 0)}
                                className="w-full mt-2 px-2 py-1 text-xs text-red-600 hover:bg-red-50 border border-red-300 rounded transition-colors"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            className="m-1 p-3 rounded-lg text-white cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02]"
                            style={{
                              background: `linear-gradient(135deg, ${bgColor} 0%, ${bgColor}dd 100%)`,
                            }}
                          >
                            <div className="space-y-1">
                              <h4 className="font-semibold text-sm leading-tight">{blockAtSlot.name}</h4>
                              <p className="text-xs opacity-90">
                                {blockAtSlot.startTime && blockAtSlot.endTime
                                  ? `${formatTime(blockAtSlot.startTime)} - ${formatTime(blockAtSlot.endTime)}`
                                  : 'Time not specified'}
                              </p>
                              {blockAtSlot.notes && (
                                <p className="text-xs opacity-75 mt-2 line-clamp-2">{blockAtSlot.notes}</p>
                              )}
                            </div>
                          </div>
                        )}
                      </td>
                    );
                  }

                  return <td key={day} className="p-3" />;
                })}
              </tr>
            ))}
            {isEditMode && (
              <tr>
                <td colSpan={6} className="p-3">
                  <div className="flex flex-col gap-2">
                    <select
                      value={newBlockDay}
                      onChange={(e) => setNewBlockDay(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      {DAYS.map(day => (
                        <option key={day} value={day}>{day}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => addNewTimeBlock(newBlockDay)}
                      className="w-full py-2 px-4 flex items-center justify-center gap-2 text-sm font-medium text-primary-600 border-2 border-dashed border-primary-300 rounded-lg hover:bg-primary-50 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add New Time Block
                    </button>
                  </div>
                </td>
              </tr>
            )}
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
      return (a.startTime || '09:00').localeCompare(b.startTime || '09:00');
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
              const blockIndex = timetable.timeblocks.findIndex(
                b => b.day === block.day && 
                b.name === block.name && 
                b.startTime === block.startTime
              );
              
              return (
                <div key={index} className="relative flex items-start gap-4">
                  {/* Time Marker */}
                  <div className="flex items-center justify-center w-16 h-12 bg-white border-2 border-primary-200 rounded-lg z-10">
                    {isEditMode ? (
                      <input
                        type="time"
                        value={block.startTime || ''}
                        onChange={(e) => updateTimeBlock(blockIndex >= 0 ? blockIndex : index, 'startTime', e.target.value)}
                        className="w-full h-full text-xs font-semibold text-center border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    ) : (
                      <span className="text-xs font-semibold text-gray-900">
                        {block.startTime ? formatTime(block.startTime) : 'TBD'}
                      </span>
                    )}
                  </div>

                  {/* Block */}
                  {isEditMode ? (
                    <div className="flex-1 p-4 rounded-lg border-2 border-primary-300 bg-white">
                      <div className="space-y-2">
                        <input
                          key={`daily-block-${blockIndex >= 0 ? blockIndex : index}-name`}
                          type="text"
                          value={block.name}
                          onChange={(e) => updateTimeBlock(blockIndex >= 0 ? blockIndex : index, 'name', e.target.value)}
                          className="w-full px-3 py-2 text-base font-semibold border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                          placeholder="Subject name"
                        />
                        <div className="flex items-center gap-2">
                          <select
                            key={`daily-block-${blockIndex >= 0 ? blockIndex : index}-day`}
                            value={block.day}
                            onChange={(e) => updateTimeBlock(blockIndex >= 0 ? blockIndex : index, 'day', e.target.value)}
                            className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                          >
                            {DAYS.map(d => (
                              <option key={d} value={d}>{d}</option>
                            ))}
                          </select>
                          <input
                            key={`daily-block-${blockIndex >= 0 ? blockIndex : index}-start`}
                            type="time"
                            value={block.startTime || ''}
                            onChange={(e) => updateTimeBlock(blockIndex >= 0 ? blockIndex : index, 'startTime', e.target.value)}
                            className="px-3 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                          <span className="text-gray-500">to</span>
                          <input
                            key={`daily-block-${blockIndex >= 0 ? blockIndex : index}-end`}
                            type="time"
                            value={block.endTime || ''}
                            onChange={(e) => updateTimeBlock(blockIndex >= 0 ? blockIndex : index, 'endTime', e.target.value)}
                            className="px-3 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                        </div>
                        <input
                          key={`daily-block-${blockIndex >= 0 ? blockIndex : index}-notes`}
                          type="text"
                          value={block.notes || ''}
                          onChange={(e) => updateTimeBlock(blockIndex >= 0 ? blockIndex : index, 'notes', e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                          placeholder="Notes (optional)"
                        />
                        <button
                          onClick={() => removeTimeBlock(blockIndex >= 0 ? blockIndex : index)}
                          className="w-full mt-2 px-3 py-1 text-sm text-red-600 hover:bg-red-50 border border-red-300 rounded-lg transition-colors"
                        >
                          Remove Time Block
                        </button>
                      </div>
                    </div>
                  ) : (
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
                            {block.startTime && block.endTime
                              ? `${formatTime(block.startTime)} - ${formatTime(block.endTime)}`
                              : 'Time not specified'}
                          </span>
                        </div>
                        {block.notes && (
                          <p className="text-sm opacity-75 mt-2">{block.notes}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {isEditMode && (
              <div className="mt-4">
                <button
                  onClick={() => addNewTimeBlock(selectedDay || undefined)}
                  className="w-full py-3 px-4 flex items-center justify-center gap-2 text-sm font-medium text-primary-600 border-2 border-dashed border-primary-300 rounded-lg hover:bg-primary-50 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add New Time Block {selectedDay ? `for ${selectedDay}` : ''}
                </button>
              </div>
            )}
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
          <div className="flex items-center gap-3 flex-wrap">
            {isEditMode ? (
              <>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-600" />
                  <input
                    type="text"
                    value={editedTimetable.teacher || ''}
                    onChange={(e) => updateTimetableField('teacher', e.target.value || null)}
                    placeholder="Teacher name"
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-purple-600" />
                  <input
                    type="text"
                    value={editedTimetable.className || ''}
                    onChange={(e) => updateTimetableField('className', e.target.value || null)}
                    placeholder="Class name"
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editedTimetable.term || ''}
                    onChange={(e) => updateTimetableField('term', e.target.value || null)}
                    placeholder="Term"
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={editedTimetable.year || ''}
                    onChange={(e) => updateTimetableField('year', e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="Year"
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-500"
                  />
                </div>
              </>
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {!isEditMode && getConfidenceBadge()}
          
          {documentId && (
            <div className="flex items-center gap-2">
              {isEditMode ? (
                <>
                  {showSaveAs ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={saveAsName}
                        onChange={(e) => setSaveAsName(e.target.value)}
                        placeholder="Enter name for saved timetable"
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSaveAs();
                          } else if (e.key === 'Escape') {
                            setShowSaveAs(false);
                            setSaveAsName('');
                          }
                        }}
                        autoFocus
                      />
                      <button
                        onClick={handleSaveAs}
                        disabled={isSavingAs || !saveAsName.trim()}
                        className="btn-primary flex items-center gap-2 px-4 py-2 text-sm"
                      >
                        {isSavingAs ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            Save
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setShowSaveAs(false);
                          setSaveAsName('');
                        }}
                        disabled={isSavingAs}
                        className="btn-secondary flex items-center gap-2 px-4 py-2 text-sm"
                      >
                        <X className="w-4 h-4" />
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      {!isSavedTimetable && (
                        <button
                          onClick={handleSave}
                          disabled={isSaving}
                          className="btn-primary flex items-center gap-2 px-4 py-2 text-sm"
                        >
                          {isSaving ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save className="w-4 h-4" />
                              Save
                            </>
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => setShowSaveAs(true)}
                        disabled={isSaving}
                        className={isSavedTimetable 
                          ? "btn-primary flex items-center gap-2 px-4 py-2 text-sm"
                          : "btn-secondary flex items-center gap-2 px-4 py-2 text-sm"
                        }
                      >
                        <Copy className="w-4 h-4" />
                        {isSavedTimetable ? 'Save as New' : 'Save As'}
                      </button>
                      <button
                        onClick={handleCancel}
                        disabled={isSaving}
                        className="btn-secondary flex items-center gap-2 px-4 py-2 text-sm"
                      >
                        <X className="w-4 h-4" />
                        Cancel
                      </button>
                    </>
                  )}
                </>
              ) : (
                <button
                  onClick={handleEdit}
                  className="btn-secondary flex items-center gap-2 px-4 py-2 text-sm"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </button>
              )}
            </div>
          )}
          
          {!isEditMode && (
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
          )}
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-800">
            <AlertTriangle className="w-5 h-5" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-green-800">
            <CheckCircle2 className="w-5 h-5" />
            <p className="text-sm font-medium">Timetable updated successfully!</p>
          </div>
        </div>
      )}

      {/* Timetable Content */}
      <div className="card">
        {viewMode === 'weekly' ? <WeeklyView /> : <DailyView />}
      </div>
    </div>
  );
};

