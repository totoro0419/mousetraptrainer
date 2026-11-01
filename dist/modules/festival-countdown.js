// Fixed 2027 festival date; calculate calendar days in Japan regardless of device timezone.
export const FESTIVAL = Object.freeze({
  date: '2027-04-27',
  dateLabel: '2027.04.27',
  weekday: 'TUE'
});
const festivalUtcDay = Date.UTC(2027, 3, 27);
const japanDate = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric'
});

export function festivalCountdown(now = new Date()) {
  const parts = Object.fromEntries(
    japanDate.formatToParts(now)
      .filter(({type}) => type === 'year' || type === 'month' || type === 'day')
      .map(({type, value}) => [type, Number(value)])
  );
  const currentUtcDay = Date.UTC(parts.year, parts.month - 1, parts.day);
  const days = Math.round((festivalUtcDay - currentUtcDay) / 86_400_000);
  if (days > 0) return {phase: 'upcoming', days, prefix: 'あと', value: String(days), suffix: '日'};
  if (days === 0) return {phase: 'today', days, prefix: '', value: '本日開催', suffix: ''};
  return {phase: 'ended', days, prefix: '', value: '終了', suffix: ''};
}
