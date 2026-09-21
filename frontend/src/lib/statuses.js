export const LEAD_STATUSES = [
  "New",
  "Contacted",
  "Visited",
  "Interested",
  "Possible Joining",
  "Future Joining",
  "Registered",
  "Lost",
];

export const JOIN_TIMELINES = [
  "Within 1-2 days",
  "Within a week",
  "Within 15 days",
  "Not sure",
];

export const statusClass = (s) => "status-" + String(s || "").replace(/\s+/g, "-");
