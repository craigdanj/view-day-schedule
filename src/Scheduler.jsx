import { useState, useEffect, useRef } from 'react';
import './Scheduler.css';

// Keep this in sync with the --event-width CSS custom property
const EVENT_WIDTH = 100;

const HOURS = [
  '12 am', '1 am', '2 am', '3 am', '4 am', '5 am',
  '6 am',  '7 am', '8 am', '9 am', '10 am', '11 am',
  '12 pm', '1 pm', '2 pm', '3 pm', '4 pm',  '5 pm',
  '6 pm',  '7 pm', '8 pm', '9 pm', '10 pm', '11 pm',
];

// ---------------------------------------------------------------------------
// Date helpers (replaces moment)
// ---------------------------------------------------------------------------

function sameDay(d1, d2) {
  return (
    d1.getDate()     === d2.getDate()     &&
    d1.getMonth()    === d2.getMonth()    &&
    d1.getFullYear() === d2.getFullYear()
  );
}

function addHours(date, n) {
  return new Date(date.getTime() + n * 3_600_000);
}

/** Inclusive overlap check — mirrors moment's isSameOrBefore logic. */
function datesOverlap(start1, end1, start2, end2) {
  return start1 <= end2 && start2 <= end1;
}

function formatHeaderDate(date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: '2-digit', year: 'numeric',
  }).format(date);
}

function formatTooltip(event) {
  const time = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
    month: 'short',  day: '2-digit',   year: 'numeric',
  }).format(event.date);
  return `${event.name} - ${time}`;
}

// ---------------------------------------------------------------------------
// Pure logic helpers
// ---------------------------------------------------------------------------

function getNowMarkerPosition(selectedDate) {
  const now = new Date();
  if (!sameDay(selectedDate, now)) return -10;
  return now.getHours() * EVENT_WIDTH + (now.getMinutes() * EVENT_WIDTH) / 60;
}

/**
 * Arranges events into a grid of rows so overlapping events don't stack on
 * top of each other — direct port of the Vue arrangeEvents() method.
 */
function buildEventGrid(events, selectedDate) {
  const grid = [[]];

  events
    .filter(({ date }) => date && sameDay(new Date(date), selectedDate))
    .forEach((event, index) => {
      const date     = new Date(event.date);
      const dateEdge = addHours(date, 1);
      const newEvent = {
        position: date.getHours() * EVENT_WIDTH + (date.getMinutes() * EVENT_WIDTH) / 60,
        name: event.name,
        date,
      };

      if (index === 0) {
        grid[0].push(newEvent);
        return;
      }

      for (let i = 0; i < grid.length; i++) {
        let clash = false;

        for (let j = 0; j < grid[i].length; j++) {
          const existing = grid[i][j].date;
          if (datesOverlap(date, dateEdge, existing, addHours(existing, 1))) {
            clash = true;
            break;
          }
        }

        if (clash) {
          if (grid[i + 1] !== undefined) continue;   // try the next row
          grid.push([]);
          grid[i + 1].push(newEvent);
          break;
        } else {
          grid[i].push(newEvent);
          break;
        }
      }
    });

  return grid;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Scheduler – day-view event timeline.
 *
 * Props:
 *   events      – Array<{ date: Date, name: string }>
 *   onDateChange – (date: Date) => void   (replaces Vue's $emit('vs-date-change'))
 */
export default function Scheduler({ events = [], onDateChange }) {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [eventGrid, setEventGrid]       = useState(() => buildEventGrid(events, new Date()));
  const [nowMarkerPos, setNowMarkerPos] = useState(() => getNowMarkerPosition(new Date()));
  const nowRef = useRef(null);

  // Re-arrange events whenever the events prop or the selected date changes.
  // Replaces: @Watch('events') + mounted() → arrangeEvents()
  useEffect(() => {
    setEventGrid(buildEventGrid(events, selectedDate));
  }, [events, selectedDate]);

  // Recompute the now-marker position when the selected date changes.
  // Replaces: setMarkerPosition() calls inside onSelectPrevDay / onSelectNextDay
  useEffect(() => {
    setNowMarkerPos(getNowMarkerPosition(selectedDate));
  }, [selectedDate]);

  // Scroll the now-marker into view after it moves — runs after the DOM updates.
  // Replaces: this.$nextTick(() => this.$refs.now.scrollIntoView(...))
  useEffect(() => {
    nowRef.current?.scrollIntoView({ inline: 'center' });
  }, [nowMarkerPos]);

  function selectPrevDay() {
    const prev = new Date(selectedDate);
    prev.setDate(prev.getDate() - 1);
    setSelectedDate(prev);
    onDateChange?.(prev);
  }

  function selectNextDay() {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + 1);
    setSelectedDate(next);
    onDateChange?.(next);
  }

  return (
    <div className="scheduler">
      <h3 className="scheduler__header">
        <span className="scheduler__date">{formatHeaderDate(selectedDate)}</span>
        <span className="scheduler__nav" onClick={selectPrevDay}>&lt;</span>
        <span className="scheduler__nav" onClick={selectNextDay}>&gt;</span>
      </h3>

      <div className="scheduler__container">
        <div className="scheduler__timeline">
          {HOURS.map(hour => (
            <div key={hour} className="scheduler__hour">{hour}</div>
          ))}
        </div>

        <div className="scheduler__events">
          {eventGrid.map((row, i) => (
            <div key={i} className="scheduler__event-row">
              {row.map(event => (
                <div
                  key={event.date.toString()}
                  className="scheduler__event"
                  style={{ left: event.position + 'px' }}
                  title={formatTooltip(event)}
                >
                  {event.name}
                </div>
              ))}
            </div>
          ))}
        </div>

        <div
          ref={nowRef}
          className="scheduler__now"
          style={{ left: nowMarkerPos + 'px' }}
        />
      </div>
    </div>
  );
}
