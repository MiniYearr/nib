import { useDraggable, useDroppable } from '@dnd-kit/core';
import type { NibRecord } from '@nib/plugin-api';
import type { DayItem } from './dayModel';

export const DAY_START_MINUTES = 6 * 60;
export const DAY_END_MINUTES = 22 * 60;
export const SLOT_MINUTES = 30;
export const SLOT_PX = 26;

function Slot({ minutes }: { minutes: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot:${minutes}` });
  return (
    <div
      ref={setNodeRef}
      className="nib-timeline-slot"
      data-hour={minutes % 60 === 0}
      data-over={isOver}
      style={{ top: ((minutes - DAY_START_MINUTES) / SLOT_MINUTES) * SLOT_PX, height: SLOT_PX }}
    />
  );
}

function Block({ item, onOpen }: { item: DayItem; onOpen(task: NibRecord): void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `block:${item.task.id}`,
  });
  const scheduled = item.props.scheduled!;
  const top = ((scheduled.startMinutes - DAY_START_MINUTES) / SLOT_MINUTES) * SLOT_PX;
  const height = (scheduled.durationMinutes / SLOT_MINUTES) * SLOT_PX - 3;

  return (
    <div
      ref={setNodeRef}
      className="nib-timeline-block"
      data-done={item.done}
      data-dragging={isDragging}
      style={{
        top,
        height,
        transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
      }}
      onClick={() => onOpen(item.task)}
      {...listeners}
      {...attributes}
    >
      <span className="nib-timeline-block-title">{item.task.title || 'Untitled task'}</span>
      {item.occurrence && <span className="nib-timeline-block-recur">↻</span>}
    </div>
  );
}

export interface TimelineProps {
  blocks: DayItem[];
  onOpen(task: NibRecord): void;
}

export function Timeline({ blocks, onOpen }: TimelineProps) {
  const slots: number[] = [];
  for (let minutes = DAY_START_MINUTES; minutes < DAY_END_MINUTES; minutes += SLOT_MINUTES) {
    slots.push(minutes);
  }
  const totalHeight = ((DAY_END_MINUTES - DAY_START_MINUTES) / SLOT_MINUTES) * SLOT_PX;

  return (
    <div className="nib-timeline">
      <div className="nib-timeline-inner" style={{ height: totalHeight }}>
        <div className="nib-timeline-gutter">
          {slots
            .filter((minutes) => minutes % 60 === 0)
            .map((minutes) => (
              <span
                key={minutes}
                style={{ top: ((minutes - DAY_START_MINUTES) / SLOT_MINUTES) * SLOT_PX }}
              >
                {String(minutes / 60).padStart(2, '0')}:00
              </span>
            ))}
        </div>
        <div className="nib-timeline-canvas">
          {slots.map((minutes) => (
            <Slot key={minutes} minutes={minutes} />
          ))}
          {blocks.map((item) => (
            <Block key={item.key} item={item} onOpen={onOpen} />
          ))}
        </div>
      </div>
    </div>
  );
}
