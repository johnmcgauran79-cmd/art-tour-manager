import { useMemo } from "react";
import { Booking } from "./useBookings";
import { Tour } from "./useTours";
import { differenceInDays } from "date-fns";

export interface PaymentAlertLevel {
  level: 1 | 2 | 3;
  label: string;
  count: number;
  description: string;
}

interface UsePaymentAlertsResult {
  activeLevel: PaymentAlertLevel | null;
  totalUnpaid: number;
  level1Count: number; // Deposits owing
  level2Count: number; // Instalments owing
  level3Count: number; // Final payment owing
}

export const usePaymentAlerts = (
  bookings: Booking[] | undefined,
  tour: Tour | undefined
): UsePaymentAlertsResult => {
  return useMemo(() => {
    if (!bookings || !tour) {
      return {
        activeLevel: null,
        totalUnpaid: 0,
        level1Count: 0,
        level2Count: 0,
        level3Count: 0,
      };
    }

    const today = new Date();

    // Filter out bookings that should never be counted
    const activeBookings = bookings.filter(
      (b) =>
        b.status !== "cancelled" &&
        b.status !== "waitlisted" &&
        b.status !== "host" &&
        b.status !== "complimentary"
    );

    // Level 1: Deposits owing - "invoiced" status 7 days after booking created
    const level1Bookings = activeBookings.filter((b) => {
      if (b.status !== "invoiced") return false;
      const createdAt = new Date(b.created_at);
      const daysSinceCreated = differenceInDays(today, createdAt);
      return daysSinceCreated >= 7;
    });
    const level1Count = level1Bookings.length;

    // Level 2: Instalments owing - tour has instalment_required, past instalment_date,
    // and status is not instalment_paid, fully_paid, or complimentary
    let level2Count = 0;
    if (tour.instalment_required && tour.instalment_date) {
      const instalmentDate = new Date(tour.instalment_date);
      if (today > instalmentDate) {
        const level2Bookings = activeBookings.filter(
          (b) => b.status !== "instalment_paid" && b.status !== "fully_paid"
        );
        level2Count = level2Bookings.length;
      }
    }

    // Level 3: Final payment owing - past final_payment_date and not fully_paid or complimentary
    let level3Count = 0;
    if (tour.final_payment_date) {
      const finalPaymentDate = new Date(tour.final_payment_date);
      if (today > finalPaymentDate) {
        const level3Bookings = activeBookings.filter(
          (b) => b.status !== "fully_paid"
        );
        level3Count = level3Bookings.length;
      }
    }

    // Determine which level is active (show the most urgent one)
    let activeLevel: PaymentAlertLevel | null = null;

    if (level3Count > 0) {
      activeLevel = {
        level: 3,
        label: "Final Payment",
        count: level3Count,
        description: `${level3Count} not fully paid (past final payment date)`,
      };
    } else if (level2Count > 0) {
      activeLevel = {
        level: 2,
        label: "Instalments Due",
        count: level2Count,
        description: `${level2Count} awaiting instalment (past instalment date)`,
      };
    } else if (level1Count > 0) {
      activeLevel = {
        level: 1,
        label: "Deposits Due",
        count: level1Count,
        description: `${level1Count} awaiting deposit (invoiced 7+ days)`,
      };
    } else {
      // All good - no payment issues
      activeLevel = {
        level: 1,
        label: "All Payments OK",
        count: 0,
        description: "No outstanding payment issues",
      };
    }

    const totalUnpaid = activeBookings.filter(b => b.status !== "fully_paid").length;

    return {
      activeLevel,
      totalUnpaid,
      level1Count,
      level2Count,
      level3Count,
    };
  }, [bookings, tour]);
};
