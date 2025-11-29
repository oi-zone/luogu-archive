export const ABSOLUTE_DATE_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const RELATIVE_TIME_FORMATTER = new Intl.RelativeTimeFormat("zh-CN", {
  numeric: "auto",
});

const RELATIVE_TIME_DIVISIONS: {
  amount: number;
  unit: Intl.RelativeTimeFormatUnit;
}[] = [
  { amount: 60, unit: "second" },
  { amount: 60, unit: "minute" },
  { amount: 24, unit: "hour" },
  { amount: 7, unit: "day" },
  { amount: 4.34524, unit: "week" },
  { amount: 12, unit: "month" },
  { amount: Number.POSITIVE_INFINITY, unit: "year" },
];

export function formatRelativeTimeRaw(date: Date) {
  const diffInSeconds = Math.round((date.getTime() - Date.now()) / 1000);

  if (Math.abs(diffInSeconds) < 10) {
    return "刚刚";
  }

  let duration = diffInSeconds;
  for (const division of RELATIVE_TIME_DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return RELATIVE_TIME_FORMATTER.format(
        Math.round(duration),
        division.unit,
      );
    }
    duration /= division.amount;
  }

  return RELATIVE_TIME_FORMATTER.format(Math.round(duration), "year");
}

export function formatRelativeTime(date: Date) {
  const raw = formatRelativeTimeRaw(date);
  let result = raw[0];
  let isDigitLast = /^\d$/.test(raw[0]);

  for (let i = 1; i < raw.length; i++) {
    const isDigit = /^\d$/.test(raw[i]);
    if (isDigit !== isDigitLast) {
      result += "\u2009" + raw[i];
      isDigitLast = isDigit;
    } else {
      result += raw[i];
    }
  }
  return result;
}
