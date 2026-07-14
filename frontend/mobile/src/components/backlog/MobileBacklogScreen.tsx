import React, { useMemo, useState, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  PanResponder,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Swipeable } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { T, STATUS_MAP, StatusKey } from '../../constants/tokens';
import {
  MobileSprint,
  MobileTask,
  useMobileBacklog,
} from '../../hooks/useMobileBacklog';
import MobileTaskDetailSheet from '../task-detail/MobileTaskDetailSheet';
import { GitHubTaskBadges } from '../github/GitHubTaskBadges';

const hapticLight = () => {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};
const hapticSuccess = () => {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
};
const hapticWarning = () => {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
};

const STATUSES = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
function Icon({ name, color = T.primary, size = 18 }: { name: 'plus' | 'search' | 'filter' | 'trash' | 'check' | 'rocket' | 'box' | 'move' | 'chart' | 'user' | 'tag' | 'flag'; color?: string; size?: number }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 2.25, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (name === 'search') return <Svg {...p}><Circle cx={11} cy={11} r={8} /><Path d="m21 21-4.3-4.3" /></Svg>;
  if (name === 'filter') return <Svg {...p}><Path d="M3 5h18" /><Path d="M7 12h10" /><Path d="M10 19h4" /></Svg>;
  if (name === 'trash') return <Svg {...p}><Path d="M3 6h18" /><Path d="M8 6V4h8v2" /><Path d="M19 6l-1 14H6L5 6" /></Svg>;
  if (name === 'check') return <Svg {...p}><Path d="M20 6 9 17l-5-5" /></Svg>;
  if (name === 'rocket') return <Svg {...p}><Path d="M4.5 16.5c-1 1-1.5 2.5-1.5 4.5 2 0 3.5-.5 4.5-1.5" /><Path d="M9 15 5 11l4-4c3.5-3.5 7-4.5 11-4-0.5 4-1.5 7.5-5 11l-4 4-4-4" /><Circle cx={15} cy={9} r={1.5} /></Svg>;
  if (name === 'box') return <Svg {...p}><Rect x={4} y={4} width={16} height={16} rx={3} /><Path d="M8 9h8" /><Path d="M8 14h5" /></Svg>;
  if (name === 'move') return <Svg {...p}><Path d="M5 12h14" /><Path d="m13 6 6 6-6 6" /></Svg>;
  if (name === 'chart') return <Svg {...p}><Rect x={4} y={12} width={3} height={7} rx={1} /><Rect x={10.5} y={5} width={3} height={14} rx={1} /><Rect x={17} y={9} width={3} height={10} rx={1} /></Svg>;
  if (name === 'user') return <Svg {...p}><Circle cx={12} cy={7} r={4} /><Path d="M5 21v-2a7 7 0 0 1 14 0v2" /></Svg>;
  if (name === 'tag') return <Svg {...p}><Path d="M20 13 11 22l-9-9V4h9l9 9z" /><Circle cx={7.5} cy={8.5} r={1.5} /></Svg>;
  if (name === 'flag') return <Svg {...p}><Path d="M4 22V4" /><Path d="M4 5h12l-1 5 1 5H4" /></Svg>;
  return <Svg {...p}><Path d="M12 5v14" /><Path d="M5 12h14" /></Svg>;
}

function BacklogBackdrop() {
  return (
    <View pointerEvents="none" style={styles.backdrop}>
      <LinearGradient
        colors={['rgba(21, 93, 252, 0.15)', 'rgba(34, 197, 94, 0.09)', 'rgba(247, 248, 250, 0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.backdropTop}
      />
      <LinearGradient
        colors={['rgba(245, 158, 11, 0.08)', 'rgba(139, 92, 246, 0.07)', 'rgba(247, 248, 250, 0)']}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.backdropBottom}
      />
    </View>
  );
}

function statusStyle(status?: string | null) {
  return STATUS_MAP[(status || 'TODO') as StatusKey] ?? T.statusTodo;
}

function priorityColor(priority?: string | null) {
  if (priority === 'URGENT' || priority === 'HIGH') return '#EF4444';
  if (priority === 'MEDIUM') return '#F59E0B';
  return '#22C55E';
}

function formatDate(value?: string | null) {
  if (!value) return 'No date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function initials(name?: string | null) {
  if (!name || name === 'Unassigned') return '--';
  return name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');
}

function DeleteConfirmModal({
  visible,
  title,
  message,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <TouchableOpacity activeOpacity={1} onPress={onCancel} style={styles.centerOverlay}>
        <View style={[styles.popover, { borderColor: '#FECACA', borderWidth: 1 }]}>
          <View style={styles.deleteHeader}>
            <View style={styles.deleteIconBg}>
              <Icon name="trash" color="#DC2626" size={20} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.deleteTitle}>{title}</Text>
              <Text style={styles.deleteSub}>{message}</Text>
            </View>
          </View>
          <View style={styles.deleteActions}>
            <TouchableOpacity activeOpacity={0.75} onPress={onCancel} style={styles.deleteCancelBtn}>
              <Text style={styles.deleteCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.75} onPress={onConfirm} style={styles.deleteConfirmBtn}>
              <Text style={styles.deleteConfirmText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

function MemberSelectorSheet({
  visible,
  members,
  onClose,
  onSelect,
}: {
  visible: boolean;
  members: any[];
  onClose: () => void;
  onSelect: (userId: number | null) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity activeOpacity={1} onPress={onClose} style={styles.sheetSafe}>
        <SafeAreaView style={{ width: '100%' }}>
          <TouchableOpacity activeOpacity={1} style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Assign Task</Text>
            <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => { onSelect(null); onClose(); }}
                style={styles.sheetOption}
              >
                <View style={[styles.avatar, { backgroundColor: '#E2E8F0' }]}>
                  <Text style={[styles.avatarText, { color: '#64748B' }]}>--</Text>
                </View>
                <Text style={styles.sheetOptionText}>Unassigned</Text>
              </TouchableOpacity>
              {members.map((member) => (
                <TouchableOpacity
                  key={member.userId || member.id}
                  activeOpacity={0.75}
                  onPress={() => { onSelect(member.userId || member.id); onClose(); }}
                  style={[styles.sheetOption, { marginTop: 6 }]}
                >
                  <View style={styles.avatar}>
                    {member.profilePicUrl ? (
                      <Image source={{ uri: member.profilePicUrl }} style={styles.avatarImg} />
                    ) : (
                      <Text style={styles.avatarText}>{initials(member.name)}</Text>
                    )}
                  </View>
                  <Text style={styles.sheetOptionText}>{member.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity activeOpacity={0.75} onPress={onClose} style={styles.secondaryBtn}>
              <Text style={styles.secondaryText}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </SafeAreaView>
      </TouchableOpacity>
    </Modal>
  );
}

const getDaysInMonth = (year: number, month: number) => {
  const date = new Date(year, month, 1);
  const days = [];
  const startDayOfWeek = date.getDay();
  for (let i = 0; i < startDayOfWeek; i++) {
    days.push(null);
  }
  const lastDay = new Date(year, month + 1, 0).getDate();
  for (let i = 1; i <= lastDay; i++) {
    days.push(i);
  }
  return days;
};

function CalendarPicker({
  selectedDate,
  onSelectDate,
}: {
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
}) {
  const [currentYear, setCurrentYear] = useState(() => {
    const d = selectedDate ? new Date(selectedDate) : new Date();
    return Number.isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear();
  });
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = selectedDate ? new Date(selectedDate) : new Date();
    return Number.isNaN(d.getTime()) ? new Date().getMonth() : d.getMonth();
  });

  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const WEEK_DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const days = useMemo(() => getDaysInMonth(currentYear, currentMonth), [currentYear, currentMonth]);

  const handlePrevMonth = () => {
    hapticLight();
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    hapticLight();
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleDaySelect = (day: number) => {
    hapticSuccess();
    const mStr = String(currentMonth + 1).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    onSelectDate(`${currentYear}-${mStr}-${dStr}`);
  };

  const isSelected = (day: number) => {
    if (!selectedDate) return false;
    const [y, m, d] = selectedDate.split('-').map(Number);
    return y === currentYear && m === currentMonth + 1 && d === day;
  };

  const isToday = (day: number) => {
    const today = new Date();
    return today.getFullYear() === currentYear && today.getMonth() === currentMonth && today.getDate() === day;
  };

  return (
    <View style={styles.calendarContainer}>
      <View style={styles.calendarHeader}>
        <TouchableOpacity activeOpacity={0.7} onPress={handlePrevMonth} style={styles.calendarNavBtn}>
          <Ionicons name="chevron-back" size={16} color="#475569" />
        </TouchableOpacity>
        <Text style={styles.calendarMonthText}>
          {MONTH_NAMES[currentMonth]} {currentYear}
        </Text>
        <TouchableOpacity activeOpacity={0.7} onPress={handleNextMonth} style={styles.calendarNavBtn}>
          <Ionicons name="chevron-forward" size={16} color="#475569" />
        </TouchableOpacity>
      </View>

      <View style={styles.calendarWeekRow}>
        {WEEK_DAYS.map((day) => (
          <Text key={day} style={styles.calendarWeekDay}>{day}</Text>
        ))}
      </View>

      <View style={styles.calendarGrid}>
        {days.map((day, idx) => {
          if (day === null) {
            return <View key={`empty-${idx}`} style={styles.calendarDayCellEmpty} />;
          }
          const active = isSelected(day);
          const today = isToday(day);
          return (
            <TouchableOpacity
              key={`day-${day}`}
              activeOpacity={0.7}
              onPress={() => handleDaySelect(day)}
              style={styles.calendarDayCell}
            >
              <View
                style={[
                  styles.calendarDayInner,
                  active && styles.calendarDayCellActive,
                  !active && today && styles.calendarDayCellToday
                ]}
              >
                <Text
                  style={[
                    styles.calendarDayText,
                    active && styles.calendarDayTextActive,
                    !active && today && styles.calendarDayTextToday
                  ]}
                >
                  {day}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function DueDateSheet({
  visible,
  currentDate,
  onClose,
  onSelect,
}: {
  visible: boolean;
  currentDate: string | null;
  onClose: () => void;
  onSelect: (date: string | null) => void;
}) {
  const handleQuickSelect = (days: number | null) => {
    if (days === null) {
      onSelect(null);
    } else {
      const d = new Date();
      d.setDate(d.getDate() + days);
      const dateString = d.toISOString().split('T')[0];
      onSelect(dateString);
    }
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity activeOpacity={1} onPress={onClose} style={styles.sheetSafe}>
        <SafeAreaView style={{ width: '100%' }}>
          <TouchableOpacity activeOpacity={1} style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Set Due Date</Text>
            
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'space-between' }}>
              <TouchableOpacity activeOpacity={0.75} onPress={() => handleQuickSelect(0)} style={[styles.sheetOptionQuick, { flex: 1 }]}>
                <Text style={styles.sheetOptionQuickText}>Today</Text>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.75} onPress={() => handleQuickSelect(1)} style={[styles.sheetOptionQuick, { flex: 1 }]}>
                <Text style={styles.sheetOptionQuickText}>Tomorrow</Text>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.75} onPress={() => handleQuickSelect(7)} style={[styles.sheetOptionQuick, { flex: 1 }]}>
                <Text style={styles.sheetOptionQuickText}>Next Week</Text>
              </TouchableOpacity>
            </View>

            <CalendarPicker
              selectedDate={currentDate}
              onSelectDate={(date) => {
                onSelect(date);
                onClose();
              }}
            />

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
              <TouchableOpacity activeOpacity={0.75} onPress={() => handleQuickSelect(null)} style={[styles.secondaryBtn, { flex: 1, borderColor: '#FECACA', backgroundColor: '#FEF2F2' }]}>
                <Text style={[styles.secondaryText, { color: '#DC2626' }]}>Clear Date</Text>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.75} onPress={onClose} style={[styles.secondaryBtn, { flex: 1 }]}>
                <Text style={styles.secondaryText}>Close</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </SafeAreaView>
      </TouchableOpacity>
    </Modal>
  );
}

function DropPlaceholder({ height }: { height: number }) {
  return (
    <View
      style={{
        height: Math.max(40, height - 8),
        backgroundColor: '#EFF6FF',
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: '#3B82F6',
        borderStyle: 'dashed',
        marginVertical: 4,
        width: '100%',
      }}
    />
  );
}

function TaskCard({
  task,
  selected,
  agile,
  sprints,
  onToggle,
  onStatus,
  onDelete,
  onPoints,
  onMove,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDragDrop,
  isDraggingGlobal,
  onAssign,
  onDateChange,
  onOpen,
  projectMembers = [],
}: {
  task: MobileTask;
  selected: boolean;
  agile?: boolean;
  sprints: MobileSprint[];
  onToggle: () => void;
  onStatus: (status: string) => void;
  onDelete: () => void;
  onPoints?: (points: number) => void;
  onMove?: (sprintId: number | null) => void;
  onDragStart?: (taskId: number) => void;
  onDragMove?: (dy: number) => void;
  onDragEnd?: () => void;
  onDragDrop?: (taskId: number) => void;
  isDraggingGlobal?: boolean;
  onAssign?: (userId: number | null) => void;
  onDateChange?: (date: string | null) => void;
  onOpen?: () => void;
  projectMembers?: any[];
}) {
  const status = statusStyle(task.status);
  const [menuOpen, setMenuOpen] = useState(false);
  const [assignSheetOpen, setAssignSheetOpen] = useState(false);
  const [dateSheetOpen, setDateSheetOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);



  const renderLeftActions = () => {
    const isDone = task.status === 'DONE';
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => {
          hapticSuccess();
          onStatus(isDone ? 'TODO' : 'DONE');
        }}
        style={[
          styles.swipeAction,
          isDone ? styles.restoreSwipeAction : styles.completeSwipeAction,
        ]}
      >
        <Ionicons
          name={isDone ? 'arrow-undo-outline' : 'checkmark-circle-outline'}
          size={24}
          color="#FFFFFF"
        />
        <Text style={styles.swipeActionText}>{isDone ? 'Undo' : 'Done'}</Text>
      </TouchableOpacity>
    );
  };

  const renderRightActions = () => {
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => {
          hapticWarning();
          setDeleteConfirmOpen(true);
        }}
        style={[styles.swipeAction, styles.deleteSwipeAction]}
      >
        <Ionicons name="trash-outline" size={24} color="#FFFFFF" />
        <Text style={styles.swipeActionText}>Delete</Text>
      </TouchableOpacity>
    );
  };

  const dragEnabled = !!onDragStart && !!onDragMove && !!onDragEnd && !!onDragDrop;
  const pan = useRef(new Animated.ValueXY()).current;
  const [isDraggingLocal, setIsDraggingLocal] = useState(false);
  const dragTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDraggingRef = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => isDraggingRef.current,
      onPanResponderTerminationRequest: () => !isDraggingRef.current,
      onPanResponderGrant: (evt, gestureState) => {
        isDraggingRef.current = false;
        if (dragTimeoutRef.current) {
          clearTimeout(dragTimeoutRef.current);
        }
        dragTimeoutRef.current = setTimeout(() => {
          isDraggingRef.current = true;
          setIsDraggingLocal(true);
          onDragStart?.(task.id);
          hapticLight();
        }, 220);
      },
      onPanResponderMove: (evt, gestureState) => {
        if (isDraggingRef.current) {
          Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false })(evt, gestureState);
          onDragMove?.(gestureState.dy);
        } else {
          if (Math.abs(gestureState.dx) > 8 || Math.abs(gestureState.dy) > 8) {
            if (dragTimeoutRef.current) {
              clearTimeout(dragTimeoutRef.current);
              dragTimeoutRef.current = null;
            }
          }
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (dragTimeoutRef.current) {
          clearTimeout(dragTimeoutRef.current);
          dragTimeoutRef.current = null;
        }

        if (isDraggingRef.current) {
          setIsDraggingLocal(false);
          isDraggingRef.current = false;
          const distance = Math.sqrt(gestureState.dx * gestureState.dx + gestureState.dy * gestureState.dy);
          if (distance > 15) {
            onDragDrop?.(task.id);
            // Reset pan instantly on successful drop so there is no visual jitter when list updates state/re-renders
            pan.setValue({ x: 0, y: 0 });
            onDragEnd?.();
          } else {
            Animated.spring(pan, {
              toValue: { x: 0, y: 0 },
              useNativeDriver: false,
            }).start(() => {
              onDragEnd?.();
            });
          }
        } else {
          const distance = Math.sqrt(gestureState.dx * gestureState.dx + gestureState.dy * gestureState.dy);
          if (distance <= 15) {
            hapticLight();
            setMenuOpen(true);
          }
        }
      },
      onPanResponderTerminate: () => {
        if (dragTimeoutRef.current) {
          clearTimeout(dragTimeoutRef.current);
          dragTimeoutRef.current = null;
        }
        setIsDraggingLocal(false);
        isDraggingRef.current = false;
        Animated.spring(pan, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: false,
        }).start(() => {
          onDragEnd?.();
        });
      },
    })
  ).current;

  const dragStyle = dragEnabled
    ? {
        transform: [
          ...pan.getTranslateTransform(),
          { scale: isDraggingLocal ? 1.05 : 1 },
          { rotate: isDraggingLocal ? '1.5deg' : '0deg' },
        ],
        zIndex: isDraggingLocal ? 9999 : 1,
        elevation: isDraggingLocal ? 14 : 0,
        shadowOpacity: isDraggingLocal ? 0.32 : 0.08,
        shadowRadius: isDraggingLocal ? 14 : 3,
        shadowColor: '#0F172A',
        shadowOffset: isDraggingLocal ? { width: 0, height: 8 } : { width: 0, height: 1 },
      }
    : {};

  const modalOverlays = (
    <>
      <MemberSelectorSheet
        visible={assignSheetOpen}
        members={projectMembers}
        onClose={() => setAssignSheetOpen(false)}
        onSelect={(userId) => onAssign?.(userId)}
      />
      <DueDateSheet
        visible={dateSheetOpen}
        currentDate={task.dueDate ?? null}
        onClose={() => setDateSheetOpen(false)}
        onSelect={(date) => onDateChange?.(date)}
      />
      <DeleteConfirmModal
        visible={deleteConfirmOpen}
        title="Delete Task"
        message="Are you sure you want to delete this task?"
        onCancel={() => setDeleteConfirmOpen(false)}
        onConfirm={() => {
          setDeleteConfirmOpen(false);
          onDelete();
        }}
      />
    </>
  );

  const cardContent = (
    <>
      <View style={[styles.priorityStrip, { backgroundColor: priorityColor(task.priority) }]} />
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => {
          hapticLight();
          onToggle();
        }}
        style={[styles.checkBox, selected && styles.checkBoxActive]}
      >
        {selected && <Icon name="check" color="#FFFFFF" size={11} />}
      </TouchableOpacity>

      <TouchableOpacity activeOpacity={0.82} onPress={onOpen} style={styles.taskMain}>
        <View style={styles.taskTop}>
          <Text style={styles.taskCode}>TSK-{task.projectTaskNumber ?? task.id}</Text>
          <View style={[styles.priorityPill, { backgroundColor: `${priorityColor(task.priority)}12`, borderColor: `${priorityColor(task.priority)}30` }]}>
            <View style={[styles.priorityDot, { backgroundColor: priorityColor(task.priority) }]} />
            <Text style={[styles.priorityText, { color: priorityColor(task.priority) }]}>{task.priority || 'MEDIUM'}</Text>
          </View>
        </View>
        <Text style={[styles.taskTitle, task.status === 'DONE' && styles.doneTitle]} numberOfLines={2}>{task.title}</Text>
        <GitHubTaskBadges task={task} />

        <View style={styles.metaRow}>
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => { hapticLight(); setMenuOpen(true); }}
            style={[styles.metaBadge, { backgroundColor: status.bg, borderColor: status.border, borderWidth: 0.5 }]}
          >
            <Text style={[styles.statusText, { color: status.text }]}>{(task.status || 'TODO').replace(/_/g, ' ')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              hapticLight();
              if (onDateChange) setDateSheetOpen(true);
            }}
            disabled={!onDateChange}
            style={[styles.metaBadge, task.dueDate ? styles.dateBadgeActive : null]}
          >
            <Ionicons name="calendar-outline" size={10} color={task.dueDate ? '#475569' : '#94A3B8'} style={{ marginRight: 2 }} />
            <Text style={[styles.dateText, task.dueDate ? { color: '#475569' } : null]}>{formatDate(task.dueDate)}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              hapticLight();
              if (onAssign) setAssignSheetOpen(true);
            }}
            disabled={!onAssign}
            style={styles.assigneeBadge}
          >
            <View style={styles.avatar}>
              {task.assigneePhotoUrl ? (
                <Image source={{ uri: task.assigneePhotoUrl }} style={styles.avatarImg} />
              ) : (
                <Text style={styles.avatarText}>{initials(task.assigneeName)}</Text>
              )}
            </View>
            <Text style={styles.assigneeText} numberOfLines={1}>{task.assigneeName || 'Unassigned'}</Text>
          </TouchableOpacity>
        </View>

        {!!task.labels?.length && (
          <View style={styles.labelRow}>
            {task.labels.slice(0, 2).map((label) => {
              const color = label.color?.startsWith('#') ? label.color : T.primary;
              return (
                <View key={label.id} style={[styles.labelPill, { backgroundColor: `${color}10`, borderColor: `${color}20` }]}>
                  <Text style={[styles.labelText, { color }]}>{label.name}</Text>
                </View>
              );
            })}
          </View>
        )}
      </TouchableOpacity>

      {agile && (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
            hapticLight();
            onPoints?.((task.storyPoint ?? 0) + 1);
          }}
          style={styles.pointsTextContainer}
        >
          <Text style={styles.pointsValueText}>{task.storyPoint ?? 0} pts</Text>
        </TouchableOpacity>
      )}

      <Modal visible={menuOpen} transparent animationType="fade">
        <TouchableOpacity activeOpacity={1} onPress={() => setMenuOpen(false)} style={styles.centerOverlay}>
          <View style={styles.popover}>
            <Text style={styles.popoverTitle}>Task actions</Text>
            <Text style={styles.popoverSub}>{task.title}</Text>
            <View style={styles.optionGrid}>
              {STATUSES.map((statusOption) => (
                <TouchableOpacity key={statusOption} activeOpacity={0.75} onPress={() => { hapticSuccess(); onStatus(statusOption); setMenuOpen(false); }} style={styles.optionBtn}>
                  <Text style={styles.optionBtnText}>{statusOption.replace(/_/g, ' ')}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {agile && onMove && (
              <View style={styles.moveList}>
                <TouchableOpacity activeOpacity={0.75} onPress={() => { hapticSuccess(); onMove(null); setMenuOpen(false); }} style={styles.moveRow}>
                  <Icon name="box" color={T.primary} size={16} />
                  <Text style={styles.moveText}>Move to backlog</Text>
                </TouchableOpacity>
                {sprints.map((sprint) => (
                  <TouchableOpacity key={sprint.id} activeOpacity={0.75} onPress={() => { hapticSuccess(); onMove(sprint.id); setMenuOpen(false); }} style={styles.moveRow}>
                    <Icon name="move" color={T.primary} size={16} />
                    <Text style={styles.moveText}>Move to {sprint.sprintName || sprint.name || `Sprint #${sprint.id}`}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
      {modalOverlays}
    </>
  );

  if (dragEnabled) {
    return (
      <Swipeable
        enabled={!isDraggingGlobal}
        renderLeftActions={renderLeftActions}
        renderRightActions={renderRightActions}
      >
        <Animated.View
          style={[
            styles.taskCard,
            selected && styles.taskCardSelected,
            dragStyle,
          ]}
          {...panResponder.panHandlers}
        >
          {cardContent}
        </Animated.View>
      </Swipeable>
    );
  }

  return (
    <Swipeable
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => {
          hapticLight();
          setMenuOpen(true);
        }}
        style={[styles.taskCard, selected && styles.taskCardSelected]}
      >
        {cardContent}
      </TouchableOpacity>
    </Swipeable>
  );
}

function FAB({ onPress, colors }: { onPress: () => void; colors: [string, string] }) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={styles.fabContainer}
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.fabGradient}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </LinearGradient>
    </TouchableOpacity>
  );
}

function FilterSheet({
  visible,
  value,
  options,
  title,
  getLabel,
  onClose,
  onSelect,
}: {
  visible: boolean;
  value: string;
  options: string[];
  title: string;
  getLabel?: (option: string) => string;
  onClose: () => void;
  onSelect: (value: string) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity activeOpacity={1} onPress={onClose} style={styles.sheetSafe}>
        <SafeAreaView style={{ width: '100%' }}>
          <TouchableOpacity activeOpacity={1} style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>{title}</Text>
            {options.map((option) => {
              const active = value === option;
              const label = getLabel ? getLabel(option) : option === 'ALL' ? 'All' : option.replace(/_/g, ' ');
              return (
                <TouchableOpacity key={option} activeOpacity={0.75} onPress={() => { onSelect(option); onClose(); }} style={[styles.sheetOption, active && styles.sheetOptionActive]}>
                  <View style={[styles.optionDot, active && styles.optionDotActive]} />
                  <Text style={styles.sheetOptionText}>{label}</Text>
                  {active && <Text style={styles.selectedText}>Selected</Text>}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity activeOpacity={0.75} onPress={onClose} style={styles.secondaryBtn}>
              <Text style={styles.secondaryText}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </SafeAreaView>
      </TouchableOpacity>
    </Modal>
  );
}

function CreateSheet({
  visible,
  title,
  placeholder,
  sprints,
  initialSprintId = null,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  title: string;
  placeholder: string;
  sprints?: MobileSprint[];
  initialSprintId?: number | null;
  onClose: () => void;
  onSubmit: (value: string, sprintId: number | null) => void;
}) {
  const [value, setValue] = useState('');
  const [selectedSprintId, setSelectedSprintId] = useState<number | null>(initialSprintId);

  React.useEffect(() => {
    if (visible) {
      setSelectedSprintId(initialSprintId);
    }
  }, [visible, initialSprintId]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity activeOpacity={1} onPress={onClose} style={styles.sheetSafe}>
        <SafeAreaView style={{ width: '100%' }}>
          <TouchableOpacity activeOpacity={1} style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>{title}</Text>
            <TextInput
              value={value}
              onChangeText={setValue}
              placeholder={placeholder}
              placeholderTextColor="#94A3B8"
              style={styles.input}
              autoFocus
            />

            {sprints && sprints.length > 0 && (
              <View style={styles.sheetSelectorRow}>
                <Text style={styles.selectorLabel}>Add to:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectorScrollContent}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => { hapticLight(); setSelectedSprintId(null); }}
                    style={[styles.selectorPill, selectedSprintId === null && styles.selectorPillActive]}
                  >
                    <Text style={[styles.selectorPillText, selectedSprintId === null && styles.selectorPillTextActive]}>Product Backlog</Text>
                  </TouchableOpacity>
                  {sprints.map((sprint) => (
                    <TouchableOpacity
                      key={sprint.id}
                      activeOpacity={0.8}
                      onPress={() => { hapticLight(); setSelectedSprintId(sprint.id); }}
                      style={[styles.selectorPill, selectedSprintId === sprint.id && styles.selectorPillActive]}
                    >
                      <Text style={[styles.selectorPillText, selectedSprintId === sprint.id && styles.selectorPillTextActive]}>
                        {sprint.sprintName || sprint.name || `Sprint #${sprint.id}`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => {
                if (!value.trim()) return;
                hapticSuccess();
                onSubmit(value, selectedSprintId);
                setValue('');
                onClose();
              }}
              style={[styles.primaryBtn, !value.trim() && styles.disabledBtn]}
              disabled={!value.trim()}
            >
              <Text style={styles.primaryText}>Create</Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.75} onPress={onClose} style={styles.secondaryBtn}>
              <Text style={styles.secondaryText}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </SafeAreaView>
      </TouchableOpacity>
    </Modal>
  );
}

function Header({
  agile,
  stats,
  onCreateTask,
  onCreateSprint,
}: {
  agile: boolean;
  stats: { total: number; done: number; points: number; sprints: number };
  onCreateTask: () => void;
  onCreateSprint?: () => void;
}) {
  const completion = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;
  return (
    <View style={styles.hero}>
      <View pointerEvents="none" style={styles.glassLayer}>
        <BlurView intensity={28} tint="light" style={StyleSheet.absoluteFill} />
        <View style={styles.glassWash} />
      </View>
      <View style={styles.heroTop}>
        <LinearGradient
          colors={agile ? ['#7C3AED', '#A855F7'] : [T.primary, '#4D8BFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroIcon}
        >
          <Icon name={agile ? 'rocket' : 'box'} color="#FFFFFF" size={19} />
        </LinearGradient>
        <View style={styles.heroTitleWrap}>
          <Text style={styles.eyebrow}>{agile ? 'AGILE BACKLOG' : 'KANBAN BACKLOG'}</Text>
          <Text style={styles.title}>{agile ? 'Sprint planning' : 'Product backlog'}</Text>
        </View>
        <TouchableOpacity activeOpacity={0.8} onPress={onCreateTask} style={styles.headerIconBtn}>
          <Icon name="plus" color={T.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.progressWrap}>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${completion}%` }]} /></View>
        <Text style={styles.progressText}>{completion}% done</Text>
      </View>

      <View style={styles.statRow}>
        <Stat label="Tasks" value={stats.total} color={T.primary} />
        <Stat label="Done" value={stats.done} color="#22C55E" />
        <Stat label={agile ? 'Points' : 'Sprints'} value={agile ? stats.points : stats.sprints} color={agile ? '#8B5CF6' : '#F59E0B'} />
      </View>

      {agile && onCreateSprint && (
        <TouchableOpacity activeOpacity={0.8} onPress={onCreateSprint} style={styles.createSprintBtn}>
          <Icon name="rocket" color="#FFFFFF" size={16} />
          <Text style={styles.createSprintText}>Create sprint</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[styles.stat, { backgroundColor: `${color}10`, borderColor: `${color}24` }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function BulkBar({
  selectedCount,
  agile,
  sprints,
  onClear,
  onDone,
  onDelete,
  onMove,
}: {
  selectedCount: number;
  agile: boolean;
  sprints: MobileSprint[];
  onClear: () => void;
  onDone: () => void;
  onDelete: () => void;
  onMove: (sprintId: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  if (!selectedCount) return null;

  return (
    <View style={styles.bulkBar}>
      <Text style={styles.bulkText}>{selectedCount} selected</Text>
      {agile && (
        <TouchableOpacity activeOpacity={0.8} onPress={() => setOpen(true)} style={styles.bulkBtn}>
          <Icon name="move" color={T.primary} size={15} />
          <Text style={styles.bulkBtnText}>Move</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity activeOpacity={0.8} onPress={onDone} style={styles.bulkBtn}>
        <Icon name="check" color={T.primary} size={15} />
        <Text style={styles.bulkBtnText}>Done</Text>
      </TouchableOpacity>
      <TouchableOpacity activeOpacity={0.8} onPress={() => Alert.alert('Delete tasks', 'Only Owners and Admins can delete tasks.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: onDelete },
      ])} style={styles.bulkDangerBtn}>
        <Icon name="trash" color="#DC2626" size={15} />
      </TouchableOpacity>
      <TouchableOpacity activeOpacity={0.8} onPress={onClear} style={styles.bulkClearBtn}><Text style={styles.bulkClearText}>Clear</Text></TouchableOpacity>

      <Modal visible={open} transparent animationType="fade">
        <TouchableOpacity activeOpacity={1} onPress={() => setOpen(false)} style={styles.centerOverlay}>
          <View style={styles.popover}>
            <Text style={styles.popoverTitle}>Move selected tasks</Text>
            <TouchableOpacity activeOpacity={0.75} onPress={() => { onMove(null); setOpen(false); }} style={styles.moveRow}>
              <Icon name="box" color={T.primary} size={16} />
              <Text style={styles.moveText}>Move to backlog</Text>
            </TouchableOpacity>
            {sprints.map((sprint) => (
              <TouchableOpacity key={sprint.id} activeOpacity={0.75} onPress={() => { onMove(sprint.id); setOpen(false); }} style={styles.moveRow}>
                <Icon name="move" color={T.primary} size={16} />
                <Text style={styles.moveText}>Move to {sprint.sprintName || sprint.name || `Sprint #${sprint.id}`}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function FilterBar({
  filters,
  assignees,
  labels,
  setFilters,
}: {
  filters: ReturnType<typeof useMobileBacklog>['filters'];
  assignees: string[];
  labels: ReturnType<typeof useMobileBacklog>['allLabels'];
  setFilters: ReturnType<typeof useMobileBacklog>['setFilters'];
}) {
  const [sheet, setSheet] = useState<'status' | 'priority' | 'assignee' | 'label' | null>(null);
  return (
    <View style={styles.filters}>
      <View style={styles.searchWrap}>
        <Icon name="search" color="#94A3B8" size={15} />
        <TextInput
          value={filters.search}
          onChangeText={(search) => setFilters((current) => ({ ...current, search }))}
          placeholder="Search tasks..."
          placeholderTextColor="#94A3B8"
          style={styles.searchInput}
        />
      </View>
      <TouchableOpacity activeOpacity={0.8} onPress={() => setSheet('status')} style={[styles.filterBtn, filters.status !== 'ALL' && styles.filterBtnActive]}>
        <Icon name="filter" color={filters.status !== 'ALL' ? T.primary : '#64748B'} />
      </TouchableOpacity>
      <TouchableOpacity activeOpacity={0.8} onPress={() => setSheet('priority')} style={[styles.filterBtn, filters.priority !== 'ALL' && styles.filterBtnActive]}>
        <Icon name="flag" color={filters.priority !== 'ALL' ? T.primary : '#64748B'} />
      </TouchableOpacity>
      <TouchableOpacity activeOpacity={0.8} onPress={() => setSheet('assignee')} style={[styles.filterBtn, filters.assignee !== 'ALL' && styles.filterBtnActive]}>
        <Icon name="user" color={filters.assignee !== 'ALL' ? T.primary : '#64748B'} />
      </TouchableOpacity>
      <TouchableOpacity activeOpacity={0.8} onPress={() => setSheet('label')} style={[styles.filterBtn, filters.label !== 'ALL' && styles.filterBtnActive]}>
        <Icon name="tag" color={filters.label !== 'ALL' ? T.primary : '#64748B'} />
      </TouchableOpacity>

      <FilterSheet
        visible={sheet === 'status'}
        value={filters.status}
        options={['ALL', ...STATUSES]}
        title="Status"
        onClose={() => setSheet(null)}
        onSelect={(status) => setFilters((current) => ({ ...current, status }))}
      />
      <FilterSheet
        visible={sheet === 'priority'}
        value={filters.priority}
        options={['ALL', ...PRIORITIES]}
        title="Priority"
        onClose={() => setSheet(null)}
        onSelect={(priority) => setFilters((current) => ({ ...current, priority }))}
      />
      <FilterSheet
        visible={sheet === 'assignee'}
        value={filters.assignee}
        options={['ALL', ...assignees, 'Unassigned']}
        title="Assignee"
        onClose={() => setSheet(null)}
        onSelect={(assignee) => setFilters((current) => ({ ...current, assignee }))}
      />
      <FilterSheet
        visible={sheet === 'label'}
        value={filters.label}
        options={['ALL', ...labels.map((label) => String(label.id))]}
        title="Label"
        getLabel={(option) => option === 'ALL' ? 'All' : labels.find((label) => String(label.id) === option)?.name ?? option}
        onClose={() => setSheet(null)}
        onSelect={(label) => setFilters((current) => ({ ...current, label }))}
      />
    </View>
  );
}

export default function MobileBacklogScreen({
  projectId,
  isAgile,
  topOffset = 0,
}: {
  projectId: number;
  projectName?: string;
  isAgile: boolean;
  topOffset?: number;
}) {
  const backlog = useMobileBacklog(projectId);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [createSprintOpen, setCreateSprintOpen] = useState(false);
  const [targetSprintId, setTargetSprintId] = useState<number | null>(null);

  const [draggingTaskId, setDraggingTaskId] = useState<number | null>(null);
  const draggingTaskIdRef = useRef<number | null>(null);
  const [hoveredSectionKey, setHoveredSectionKey] = useState<string | null>(null);
  const hoveredSectionKeyRef = useRef<string | null>(null);
  const [hoveredInsertIndex, setHoveredInsertIndex] = useState<number | null>(null);
  const hoveredInsertIndexRef = useRef<number | null>(null);

  // Store layout info per task and section, keyed so we can compute drop targets
  const layoutsRef = useRef<{
    sections: Record<string, { y: number; height: number; sprintId: number | null }>;
    tasks: Record<number, { relativeY: number; height: number; sprintId: number | null; sectionKey: string }>;
  }>({
    sections: {},
    tasks: {},
  });

  const handleSectionLayout = (key: string, sprintId: number | null, y: number, height: number) => {
    layoutsRef.current.sections[key] = { y, height, sprintId };
  };

  const handleTaskLayout = (taskId: number, sprintId: number | null, relativeY: number, height: number, sectionKey: string) => {
    layoutsRef.current.tasks[taskId] = { relativeY, height, sprintId, sectionKey };
  };

  const sprintOptions = useMemo(
    () => backlog.sprints.filter((sprint) => sprint.status !== 'COMPLETED'),
    [backlog.sprints]
  );

  const openCreateTask = (sprintId: number | null = null) => {
    setTargetSprintId(sprintId);
    setCreateTaskOpen(true);
  };

  const draggingCardHeightRef = useRef(80);
  const [draggingCardHeight, setDraggingCardHeight] = useState(80);

  const handleDragStart = (taskId: number) => {
    draggingTaskIdRef.current = taskId;
    const h = layoutsRef.current.tasks[taskId]?.height ?? 80;
    draggingCardHeightRef.current = h;
    setDraggingCardHeight(h);
    setDraggingTaskId(taskId);
  };

  const handleDragMove = (dy: number) => {
    const activeTaskId = draggingTaskIdRef.current;
    if (activeTaskId === null) return;

    const taskLayout = layoutsRef.current.tasks[activeTaskId];
    if (!taskLayout) return;

    const sectionLayout = layoutsRef.current.sections[taskLayout.sectionKey];
    if (!sectionLayout) return;

    const startY = sectionLayout.y + taskLayout.relativeY;
    const currentCenterY = startY + dy + taskLayout.height / 2;

    let hoveredKey: string | null = null;
    let targetSpId: number | null = null;

    for (const [key, section] of Object.entries(layoutsRef.current.sections)) {
      if (currentCenterY >= section.y && currentCenterY <= section.y + section.height) {
        hoveredKey = key;
        targetSpId = section.sprintId;
        break;
      }
    }

    if (hoveredKey !== hoveredSectionKeyRef.current) {
      hoveredSectionKeyRef.current = hoveredKey;
      setHoveredSectionKey(hoveredKey);
    }

    if (!hoveredKey) {
      if (hoveredInsertIndexRef.current !== null) {
        hoveredInsertIndexRef.current = null;
        setHoveredInsertIndex(null);
      }
      return;
    }

    const sectionTasks = (targetSpId === null)
      ? backlog.filteredProductTasks.filter((t) => t.id !== activeTaskId)
      : (backlog.filteredSprints.find((s) => s.id === targetSpId)?.tasks ?? []).filter((t) => t.id !== activeTaskId);

    if (sectionTasks.length === 0) {
      if (hoveredInsertIndexRef.current !== 0) {
        hoveredInsertIndexRef.current = 0;
        setHoveredInsertIndex(0);
      }
      return;
    }

    const taskLayouts = sectionTasks
      .map((task, idx) => {
        const layout = layoutsRef.current.tasks[task.id];
        if (!layout) return null;
        const section = layoutsRef.current.sections[layout.sectionKey];
        if (!section) return null;
        return {
          task,
          index: idx,
          y: section.y + layout.relativeY,
          height: layout.height,
        };
      })
      .filter(Boolean) as { task: any; index: number; y: number; height: number }[];

    taskLayouts.sort((a, b) => a.y - b.y);

    let insertIndex = 0;
    let found = false;

    for (let i = 0; i < taskLayouts.length; i++) {
      const midpoint = taskLayouts[i].y + taskLayouts[i].height / 2;
      if (currentCenterY < midpoint) {
        insertIndex = i;
        found = true;
        break;
      }
    }

    if (!found) {
      insertIndex = taskLayouts.length;
    }

    if (insertIndex !== hoveredInsertIndexRef.current) {
      hoveredInsertIndexRef.current = insertIndex;
      setHoveredInsertIndex(insertIndex);
    }
  };

  const handleDragEnd = () => {
    draggingTaskIdRef.current = null;
    hoveredSectionKeyRef.current = null;
    hoveredInsertIndexRef.current = null;
    setDraggingTaskId(null);
    setHoveredSectionKey(null);
    setHoveredInsertIndex(null);
  };

  const handleDragDrop = (taskId: number) => {
    const currentSection = hoveredSectionKeyRef.current;
    const currentInsert = hoveredInsertIndexRef.current;

    if (currentSection && currentInsert !== null) {
      const section = layoutsRef.current.sections[currentSection];
      const targetSpId = section ? section.sprintId : null;

      const sectionTasks = (targetSpId === null)
        ? backlog.filteredProductTasks
        : (backlog.filteredSprints.find((s) => s.id === targetSpId)?.tasks ?? []);

      const otherTasks = sectionTasks.filter((t) => t.id !== taskId);

      const newTasksList = [...otherTasks];
      const insertIdx = Math.max(0, Math.min(currentInsert, newTasksList.length));

      const taskObj = backlog.tasks.find((t) => t.id === taskId);
      if (taskObj) {
        const updatedTask = { ...taskObj, sprintId: targetSpId };
        newTasksList.splice(insertIdx, 0, updatedTask);
      }

      const newOrderedTaskIds = newTasksList.map((t) => t.id);

      void backlog.reorderTasks(targetSpId, newOrderedTaskIds);
      hapticSuccess();
    }

    draggingTaskIdRef.current = null;
    hoveredSectionKeyRef.current = null;
    hoveredInsertIndexRef.current = null;
    setDraggingTaskId(null);
    setHoveredSectionKey(null);
    setHoveredInsertIndex(null);
  };

  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);

  const stats = useMemo(() => {
    const visibleTasks = isAgile
      ? [
          ...backlog.filteredSprints.flatMap((sprint) => sprint.tasks),
          ...backlog.filteredProductTasks,
        ]
      : backlog.groupedProductTasks.flatMap((group) => group.tasks);
    const total = visibleTasks.length;
    const done = visibleTasks.filter((task) => task.status === 'DONE').length;
    const points = visibleTasks.reduce((sum, task) => sum + (task.storyPoint ?? 0), 0);
    return { total, done, points, sprints: backlog.filteredSprints.length };
  }, [backlog.filteredProductTasks, backlog.filteredSprints, backlog.groupedProductTasks, isAgile]);

  if (backlog.loading) {
    return (
      <View style={[styles.loading, { paddingTop: topOffset }]}>
        <ActivityIndicator color={T.primary} />
        <Text style={styles.loadingText}>Loading backlog...</Text>
      </View>
    );
  }

  return (
    <View style={styles.safe}>
      <BacklogBackdrop />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: topOffset }]}
        refreshControl={<RefreshControl refreshing={backlog.refreshing} onRefresh={backlog.refresh} tintColor={T.primary} colors={[T.primary]} />}
        showsVerticalScrollIndicator={false}
        scrollEnabled={true}
      >
        <Header
          agile={isAgile}
          stats={stats}
          onCreateTask={() => openCreateTask(null)}
          onCreateSprint={isAgile ? () => setCreateSprintOpen(true) : undefined}
        />

        <FilterBar
          filters={backlog.filters}
          assignees={backlog.allAssigneeNames}
          labels={backlog.allLabels}
          setFilters={backlog.setFilters}
        />

        {!!backlog.error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Backlog error</Text>
            <Text style={styles.errorText}>{backlog.error}</Text>
          </View>
        )}

        {isAgile ? (
          <View style={styles.sections}>
            {backlog.filteredSprints.length === 0 ? (
              <View style={styles.emptyPanel}>
                <Icon name="rocket" color="#94A3B8" size={28} />
                <Text style={styles.emptyTitle}>No active sprints</Text>
                <Text style={styles.emptyText}>Create a sprint to start planning development work.</Text>
              </View>
            ) : (
              backlog.filteredSprints.map((sprint) => {
                const isHoveredSection = hoveredSectionKey === `sprint-${sprint.id}`;
                return (
                  <View
                    key={sprint.id}
                    collapsable={false}
                    onLayout={(e) => {
                      const { y, height } = e.nativeEvent.layout;
                      handleSectionLayout(`sprint-${sprint.id}`, sprint.id, y, height);
                    }}
                    style={[
                      styles.section,
                      isHoveredSection && styles.sectionHovered,
                    ]}
                  >
                    <View style={styles.sectionHeader}>
                      <View>
                        <Text style={styles.sectionTitle}>{sprint.sprintName || sprint.name || `Sprint #${sprint.id}`}</Text>
                        <Text style={styles.sectionSub}>{sprint.tasks.length} tasks</Text>
                      </View>
                      <TouchableOpacity activeOpacity={0.8} onPress={() => openCreateTask(sprint.id)} style={styles.smallPrimary}>
                        <Icon name="plus" color="#FFFFFF" size={14} />
                      </TouchableOpacity>
                    </View>
                    {sprint.tasks.length === 0 ? (
                      <View style={{ minHeight: 40, justifyContent: 'center' }}>
                        {isHoveredSection && <DropPlaceholder height={draggingCardHeight} />}
                        <Text style={styles.mutedLine}>No matching tasks in this sprint.</Text>
                      </View>
                    ) : (
                      <>
                        {sprint.tasks.map((task, index) => {
                          const showPlaceholderBefore = isHoveredSection && hoveredInsertIndex === index;
                          const isDragging = draggingTaskId === task.id;
                          return (
                            <React.Fragment key={task.id}>
                              {showPlaceholderBefore && <DropPlaceholder height={draggingCardHeight} />}
                              <View
                                collapsable={false}
                                style={{ width: '100%', opacity: isDragging ? 0 : 1 }}
                                onLayout={(e) => {
                                  const { y, height } = e.nativeEvent.layout;
                                  handleTaskLayout(task.id, sprint.id, y, height, `sprint-${sprint.id}`);
                                }}
                              >
                                <TaskCard
                                  task={task}
                                  selected={!!task.selected}
                                  agile
                                  sprints={sprintOptions}
                                  onToggle={() => backlog.toggleTaskSelection(task.id)}
                                  onStatus={(status) => backlog.updateStatus(task.id, status)}
                                  onDelete={() => backlog.deleteTask(task.id)}
                                  onPoints={(points) => backlog.updateStoryPoints(task.id, points)}
                                  onMove={(sprintId) => backlog.moveTaskToSprint(task.id, sprintId)}
                                  onDragStart={handleDragStart}
                                  onDragMove={handleDragMove}
                                  onDragEnd={handleDragEnd}
                                  onDragDrop={handleDragDrop}
                                  isDraggingGlobal={draggingTaskId !== null}
                                  onAssign={(userId) => backlog.assignTask(task.id, userId)}
                                  onDateChange={(date) => backlog.updateTaskDueDate(task.id, date)}
                                  onOpen={() => setSelectedTaskId(task.id)}
                                  projectMembers={backlog.members}
                                />
                              </View>
                            </React.Fragment>
                          );
                        })}
                        {isHoveredSection && hoveredInsertIndex === sprint.tasks.length && (
                          <DropPlaceholder height={draggingCardHeight} />
                        )}
                      </>
                    )}
                  </View>
                );
              })
            )}

            <View
              collapsable={false}
              onLayout={(e) => {
                const { y, height } = e.nativeEvent.layout;
                handleSectionLayout('backlog', null, y, height);
              }}
              style={[
                styles.section,
                hoveredSectionKey === 'backlog' && styles.sectionHovered,
              ]}
            >
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Product backlog</Text>
                  <Text style={styles.sectionSub}>{backlog.filteredProductTasks.length} unscheduled tasks</Text>
                </View>
                <TouchableOpacity activeOpacity={0.8} onPress={() => openCreateTask(null)} style={styles.smallPrimary}>
                  <Icon name="plus" color="#FFFFFF" size={14} />
                </TouchableOpacity>
              </View>
              {backlog.filteredProductTasks.length === 0 ? (
                <View style={{ minHeight: 40, justifyContent: 'center' }}>
                  {hoveredSectionKey === 'backlog' && <DropPlaceholder height={draggingCardHeight} />}
                  <Text style={styles.mutedLine}>No matching backlog tasks.</Text>
                </View>
              ) : (
                <>
                  {backlog.filteredProductTasks.map((task, index) => {
                    const showPlaceholderBefore = hoveredSectionKey === 'backlog' && hoveredInsertIndex === index;
                    const isDragging = draggingTaskId === task.id;
                    return (
                      <React.Fragment key={task.id}>
                        {showPlaceholderBefore && <DropPlaceholder height={draggingCardHeight} />}
                        <View
                          collapsable={false}
                          style={{ width: '100%', opacity: isDragging ? 0 : 1 }}
                          onLayout={(e) => {
                            const { y, height } = e.nativeEvent.layout;
                            handleTaskLayout(task.id, null, y, height, 'backlog');
                          }}
                        >
                          <TaskCard
                            task={task}
                            selected={!!task.selected}
                            agile
                            sprints={sprintOptions}
                            onToggle={() => backlog.toggleTaskSelection(task.id)}
                            onStatus={(status) => backlog.updateStatus(task.id, status)}
                            onDelete={() => backlog.deleteTask(task.id)}
                            onPoints={(points) => backlog.updateStoryPoints(task.id, points)}
                            onMove={(sprintId) => backlog.moveTaskToSprint(task.id, sprintId)}
                            onDragStart={handleDragStart}
                            onDragMove={handleDragMove}
                            onDragEnd={handleDragEnd}
                            onDragDrop={handleDragDrop}
                            isDraggingGlobal={draggingTaskId !== null}
                            onAssign={(userId) => backlog.assignTask(task.id, userId)}
                            onDateChange={(date) => backlog.updateTaskDueDate(task.id, date)}
                            onOpen={() => setSelectedTaskId(task.id)}
                            projectMembers={backlog.members}
                          />
                        </View>
                      </React.Fragment>
                    );
                  })}
                  {hoveredSectionKey === 'backlog' && hoveredInsertIndex === backlog.filteredProductTasks.length && (
                    <DropPlaceholder height={draggingCardHeight} />
                  )}
                </>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.sections}>
            {backlog.groupedProductTasks.map((group) => (
              <View key={group.label} style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View>
                    <Text style={styles.sectionTitle}>{group.label}</Text>
                    <Text style={styles.sectionSub}>{group.tasks.length} tasks</Text>
                  </View>
                  <TouchableOpacity activeOpacity={0.8} onPress={() => openCreateTask(null)} style={styles.smallPrimary}>
                    <Icon name="plus" color="#FFFFFF" size={14} />
                  </TouchableOpacity>
                </View>
                {group.tasks.length === 0 ? (
                  <Text style={styles.mutedLine}>No matching backlog tasks.</Text>
                ) : group.tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    selected={!!task.selected}
                    sprints={[]}
                    onToggle={() => backlog.toggleTaskSelection(task.id)}
                    onStatus={(status) => backlog.updateStatus(task.id, status)}
                    onDelete={() => backlog.deleteTask(task.id)}
                    onAssign={(userId) => backlog.assignTask(task.id, userId)}
                    onDateChange={(date) => backlog.updateTaskDueDate(task.id, date)}
                    onOpen={() => setSelectedTaskId(task.id)}
                    projectMembers={backlog.members}
                  />
                ))}
              </View>
            ))}
          </View>
        )}

        <View style={styles.bottomPad} />


      </ScrollView>

      <CreateSheet
        visible={createTaskOpen}
        title={targetSprintId ? 'New sprint task' : 'New backlog task'}
        placeholder="Task title"
        sprints={isAgile ? sprintOptions : undefined}
        initialSprintId={targetSprintId}
        onClose={() => setCreateTaskOpen(false)}
        onSubmit={(title, sprintId) => backlog.createTask(title, sprintId)}
      />

      <FAB
        onPress={() => {
          hapticLight();
          openCreateTask(null);
        }}
        colors={isAgile ? ['#7C3AED', '#A855F7'] : [T.primary, '#4D8BFF']}
      />

      <CreateSheet
        visible={createSprintOpen}
        title="New sprint"
        placeholder="Sprint name"
        onClose={() => setCreateSprintOpen(false)}
        onSubmit={backlog.createSprint}
      />

      <BulkBar
        selectedCount={backlog.selectedCount}
        agile={isAgile}
        sprints={sprintOptions}
        onClear={backlog.clearSelection}
        onDone={() => backlog.bulkStatus('DONE')}
        onDelete={() => setBulkDeleteConfirmOpen(true)}
        onMove={backlog.bulkMoveToSprint}
      />

      <DeleteConfirmModal
        visible={bulkDeleteConfirmOpen}
        title="Delete Tasks"
        message={`Are you sure you want to delete the ${backlog.selectedCount} selected tasks?`}
        onCancel={() => setBulkDeleteConfirmOpen(false)}
        onConfirm={() => {
          setBulkDeleteConfirmOpen(false);
          backlog.bulkDelete();
        }}
      />

      <MobileTaskDetailSheet
        visible={selectedTaskId !== null}
        taskId={selectedTaskId}
        projectId={projectId}
        onClose={() => setSelectedTaskId(null)}
        onChanged={backlog.refresh}
      />
    </View>
  );
}

const shadow = Platform.select({
  ios: { shadowColor: '#0F172A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 18 },
  android: { elevation: 3 },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bgSecondary },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F7F8FA',
  },
  backdropTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 340,
  },
  backdropBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 280,
  },
  scroll: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 16, gap: 10 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: T.bgSecondary },
  loadingText: { fontSize: 13, fontWeight: '700', color: T.textSecondary },
  hero: {
    backgroundColor: 'rgba(255, 255, 255, 0.78)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    overflow: 'hidden',
    ...shadow,
  },
  glassLayer: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    overflow: 'hidden',
  },
  glassWash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.48)',
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  heroIconAgile: {},
  heroTitleWrap: { flex: 1, minWidth: 0 },
  eyebrow: { fontSize: 9, fontWeight: '900', color: '#94A3B8', letterSpacing: 0.7 },
  title: { fontSize: 18, fontWeight: '900', color: '#0F172A', marginTop: 1, letterSpacing: -0.2 },
  headerIconBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(239, 246, 255, 0.92)', borderWidth: 1, borderColor: 'rgba(191, 219, 254, 0.95)', alignItems: 'center', justifyContent: 'center' },
  progressWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressTrack: { flex: 1, height: 6, borderRadius: 999, backgroundColor: '#E2E8F0', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: '#22C55E' },
  progressText: { fontSize: 11, fontWeight: '800', color: T.textSecondary },
  statRow: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, borderRadius: 12, borderWidth: 1, paddingVertical: 8, alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.44)' },
  statValue: { fontSize: 16, fontWeight: '900' },
  statLabel: { fontSize: 10, fontWeight: '800', color: T.textSecondary, letterSpacing: 0.2, textTransform: 'uppercase' },
  createSprintBtn: { height: 32, borderRadius: 10, backgroundColor: T.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  createSprintText: { fontSize: 12, fontWeight: '900', color: '#FFFFFF' },
  filters: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.82)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.9)',
    padding: 4,
    ...shadow,
  },
  searchWrap: { flex: 1, minHeight: 36, borderRadius: 11, borderWidth: 1, borderColor: 'rgba(226, 232, 240, 0.78)', backgroundColor: 'rgba(248, 250, 252, 0.82)', paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  searchInput: { flex: 1, fontSize: 13, color: '#0F172A', paddingVertical: 0 },
  filterBtn: { width: 36, height: 36, borderRadius: 11, borderWidth: 1, borderColor: 'rgba(226, 232, 240, 0.78)', backgroundColor: 'rgba(248, 250, 252, 0.82)', alignItems: 'center', justifyContent: 'center' },
  filterBtnActive: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  filterLetter: { fontSize: 13, fontWeight: '900', color: '#64748B' },
  filterLetterActive: { color: T.primary },
  errorBox: { borderRadius: 14, borderWidth: 1, borderColor: '#FECACA', backgroundColor: '#FEF2F2', padding: 12 },
  errorTitle: { fontSize: 13, fontWeight: '900', color: '#991B1B' },
  errorText: { fontSize: 12, fontWeight: '700', color: '#B91C1C', marginTop: 2 },
  sections: { gap: 12 },
  section: { backgroundColor: 'rgba(255, 255, 255, 0.88)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.9)', padding: 12, gap: 8, ...shadow },
  sectionHovered: {
    borderColor: '#3B82F6',
    borderWidth: 1.5,
    backgroundColor: 'rgba(239, 246, 255, 0.95)',
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingBottom: 4 },
  sectionTitle: { fontSize: 14, fontWeight: '900', color: '#0F172A' },
  sectionSub: { fontSize: 11, fontWeight: '700', color: '#94A3B8', marginTop: 1 },
  smallPrimary: { width: 32, height: 32, borderRadius: 10, backgroundColor: T.primary, alignItems: 'center', justifyContent: 'center', ...Platform.select({ ios: { shadowColor: T.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 8 }, android: { elevation: 3 } }) },
  mutedLine: { fontSize: 12, fontWeight: '700', color: '#94A3B8', textAlign: 'center', paddingVertical: 16 },
  emptyPanel: { minHeight: 150, borderRadius: 20, borderWidth: 1, borderStyle: 'dashed', borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', padding: 18, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '900', color: '#64748B' },
  emptyText: { fontSize: 12, fontWeight: '700', color: '#94A3B8', textAlign: 'center' },
  taskCard: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(226, 232, 240, 0.72)', backgroundColor: 'rgba(255, 255, 255, 0.96)', paddingVertical: 6, paddingHorizontal: 10, paddingLeft: 14, overflow: 'hidden', ...shadow },
  taskCardSelected: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  priorityStrip: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  checkBox: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  checkBoxActive: { backgroundColor: T.primary, borderColor: T.primary },
  taskMain: { flex: 1, minWidth: 0, gap: 4 },
  taskTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  taskCode: { fontSize: 10, fontWeight: '900', color: '#94A3B8', letterSpacing: 0.5 },
  priorityPill: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 999, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 1 },
  priorityDot: { width: 5, height: 5, borderRadius: 2.5 },
  priorityText: { fontSize: 9, fontWeight: '900' },
  taskTitle: { fontSize: 13, fontWeight: '800', color: '#1E293B', lineHeight: 16 },
  doneTitle: { color: '#94A3B8', textDecorationLine: 'line-through' },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  metaBadge: { flexDirection: 'row', alignItems: 'center', borderRadius: 6, backgroundColor: '#F1F5F9', paddingHorizontal: 5, paddingVertical: 2 },
  dateBadgeActive: { backgroundColor: '#E2E8F0' },
  statusText: { fontSize: 9, fontWeight: '900' },
  dateText: { fontSize: 10, fontWeight: '800', color: '#64748B' },
  assigneeBadge: { flexDirection: 'row', alignItems: 'center', borderRadius: 6, backgroundColor: '#F1F5F9', paddingHorizontal: 4, paddingVertical: 2, gap: 4, maxWidth: 120 },
  avatar: { width: 16, height: 16, borderRadius: 8, backgroundColor: T.primary, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarText: { fontSize: 8, fontWeight: '900', color: '#FFFFFF' },
  avatarImg: { width: 16, height: 16, borderRadius: 8 },
  assigneeText: { flex: 1, fontSize: 10, fontWeight: '800', color: '#475569' },
  labelRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  labelPill: { borderWidth: 0.5, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 },
  labelText: { fontSize: 9, fontWeight: '800' },
  pointsTextContainer: { paddingHorizontal: 4, paddingVertical: 2, alignSelf: 'center' },
  pointsValueText: { fontSize: 12, fontWeight: '800', color: '#8B5CF6' },
  centerOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.35)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  popover: { width: '100%', maxWidth: 360, borderRadius: 18, backgroundColor: '#FFFFFF', padding: 16, gap: 10 },
  popoverTitle: { fontSize: 16, fontWeight: '900', color: '#0F172A' },
  popoverSub: { fontSize: 12, fontWeight: '700', color: '#64748B', marginTop: -6 },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionBtn: { minHeight: 38, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC', justifyContent: 'center' },
  optionBtnText: { fontSize: 12, fontWeight: '900', color: '#0F172A' },
  moveList: { gap: 8, paddingTop: 4 },
  moveRow: { minHeight: 42, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  moveText: { flex: 1, fontSize: 13, fontWeight: '800', color: '#0F172A' },
  sheetSafe: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15, 23, 42, 0.38)' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 22, gap: 10 },
  handle: { width: 40, height: 4, borderRadius: 999, backgroundColor: '#CBD5E1', alignSelf: 'center', marginBottom: 8 },
  sheetTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A' },
  sheetOption: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
  sheetOptionActive: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  optionDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: '#CBD5E1' },
  optionDotActive: { backgroundColor: T.primary },
  sheetOptionText: { flex: 1, fontSize: 14, fontWeight: '800', color: '#0F172A' },
  selectedText: { fontSize: 11, fontWeight: '900', color: T.primary },
  input: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC', paddingHorizontal: 14, fontSize: 14, color: '#0F172A' },
  primaryBtn: { minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: T.primary },
  disabledBtn: { opacity: 0.55 },
  primaryText: { fontSize: 14, fontWeight: '900', color: '#FFFFFF' },
  secondaryBtn: { minHeight: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  secondaryText: { fontSize: 14, fontWeight: '900', color: '#64748B' },
  bulkBar: { position: 'absolute', left: 12, right: 12, bottom: 16, minHeight: 58, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, ...shadow },
  bulkText: { flex: 1, fontSize: 13, fontWeight: '900', color: '#0F172A' },
  bulkBtn: { height: 38, borderRadius: 11, borderWidth: 1, borderColor: '#BFDBFE', backgroundColor: '#EFF6FF', paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 5 },
  bulkBtnText: { fontSize: 12, fontWeight: '900', color: T.primary },
  bulkDangerBtn: { width: 38, height: 38, borderRadius: 11, borderWidth: 1, borderColor: '#FECACA', backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' },
  bulkClearBtn: { height: 38, justifyContent: 'center', paddingHorizontal: 4 },
  bulkClearText: { fontSize: 12, fontWeight: '900', color: '#64748B' },
  bottomPad: { height: 100 },
  fabContainer: {
    position: 'absolute',
    right: 16,
    bottom: 96,
    width: 56,
    height: 56,
    borderRadius: 28,
    ...shadow,
    shadowColor: T.primary,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  fabGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeAction: {
    width: 80,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 14,
    marginVertical: 0,
    gap: 4,
  },
  completeSwipeAction: {
    backgroundColor: '#22C55E',
  },
  restoreSwipeAction: {
    backgroundColor: '#3B82F6',
  },
  deleteSwipeAction: {
    backgroundColor: '#EF4444',
  },
  swipeActionText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  sheetSelectorRow: {
    gap: 6,
    marginVertical: 4,
  },
  selectorLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
    paddingLeft: 4,
  },
  selectorScrollContent: {
    gap: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  selectorPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  selectorPillActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  selectorPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
  },
  selectorPillTextActive: {
    color: T.primary,
  },
  deleteHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  deleteIconBg: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FECACA' },
  deleteTitle: { fontSize: 16, fontWeight: '900', color: '#1E293B' },
  deleteSub: { fontSize: 13, fontWeight: '700', color: '#64748B', marginTop: 2 },
  deleteActions: { flexDirection: 'row', gap: 8, marginTop: 12, justifyContent: 'flex-end' },
  deleteCancelBtn: { height: 38, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' },
  deleteCancelText: { fontSize: 13, fontWeight: '900', color: '#64748B' },
  deleteConfirmBtn: { height: 38, paddingHorizontal: 16, borderRadius: 10, backgroundColor: '#DC2626', justifyContent: 'center', alignItems: 'center' },
  deleteConfirmText: { fontSize: 13, fontWeight: '900', color: '#FFFFFF' },
  dropIndicatorContainer: {
    height: 8,
    justifyContent: 'center',
    width: '100%',
    marginVertical: 2,
  },
  dropIndicatorLine: {
    height: 2.5,
    backgroundColor: '#3B82F6',
    borderRadius: 999,
  },
  sheetOptionQuick: {
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  sheetOptionQuickText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
  },
  calendarContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    gap: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
    marginVertical: 4,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  calendarMonthText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  calendarNavBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarWeekRow: {
    flexDirection: 'row',
    width: '100%',
    paddingVertical: 2,
  },
  calendarWeekDay: {
    width: '14.28%',
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '900',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    rowGap: 6,
  },
  calendarDayCell: {
    width: '14.28%',
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDayInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  calendarDayCellActive: {
    backgroundColor: T.primary,
    shadowColor: T.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 4,
  },
  calendarDayCellToday: {
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  calendarDayCellEmpty: {
    width: '14.28%',
    height: 36,
  },
  calendarDayText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
  },
  calendarDayTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  calendarDayTextToday: {
    color: T.primary,
    fontWeight: '900',
  },
});
