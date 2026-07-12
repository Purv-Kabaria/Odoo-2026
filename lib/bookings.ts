export type CheckInStatus = "CHECKED_IN" | "PENDING" | "MISSED";

/**
 * A CANCELLED booking only reads as MISSED when the sweep already granted
 * the grace extension — a manual/early cancellation never went through the
 * grace step, so checkInGraceExtended stays false for that case.
 */
export function deriveCheckInStatus(booking: {
  checkedIn: boolean;
  status: string;
  checkInGraceExtended: boolean;
}): CheckInStatus {
  if (booking.checkedIn) return "CHECKED_IN";
  if (booking.status === "CANCELLED" && booking.checkInGraceExtended) return "MISSED";
  return "PENDING";
}
