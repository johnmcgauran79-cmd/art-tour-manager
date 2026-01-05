import { useMemo } from "react";
import { Booking } from "./useBookings";
import { Tour } from "./useTours";
import { differenceInDays, differenceInMonths } from "date-fns";

export interface PaymentAlertLevel {
  level: 1 | 2 | 3;
  label: string;
  count: number;
  description: string;
}

interface UsePaymentAlertsResult {
  activeLevel: PaymentAlertLevel | null;
  totalUnpaid: number;
  level1Count: number;
  level2Count: number;
  level3Count: number;
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
    const tourStartDate = new Date(tour.start_date);
    const daysUntilTour = differenceInDays(tourStartDate, today);
    const monthsUntilTour = differenceInMonths(tourStartDate, today);

    // Filter out bookings that should never be counted
    const activeBookings = bookings.filter(
      (b) =>
        b.status !== "cancelled" &&
        b.status !== "waitlisted" &&
        b.status !== "host" &&
        b.status !== "fully_paid"
    );

    // Level 1: Count pending + invoiced (should be deposited)
    // Exclude racing_breaks_invoice
    const level1Bookings = activeBookings.filter(
      (b) => b.status === "pending" || b.status === "invoiced"
    );
    const level1Count = level1Bookings.length;

    // Level 2: Count pending + invoiced + deposited (should be instalment_paid)
    // Only applies if instalment_required is true AND < 6 months until tour
    // Exclude racing_breaks_invoice
    const level2Bookings = activeBookings.filter(
      (b) =>
        b.status === "pending" ||
        b.status === "invoiced" ||
        b.status === "deposited"
    );
    const level2Count = level2Bookings.length;

    // Level 3: Count all non-fully_paid bookings (includes racing_breaks_invoice)
    // Applies when < 100 days until tour
    const level3Count = activeBookings.length;

    // Determine which level is active based on time
    let activeLevel: PaymentAlertLevel | null = null;

    if (daysUntilTour < 100) {
      // Level 3: Under 100 days - everyone should be fully paid
      activeLevel = {
        level: 3,
        label: "Final Payment",
        count: level3Count,
        description: `${level3Count} not fully paid`,
      };
    } else if (monthsUntilTour < 6 && tour.instalment_required) {
      // Level 2: Under 6 months AND instalment required
      activeLevel = {
        level: 2,
        label: "Instalments Due",
        count: level2Count,
        description: `${level2Count} awaiting instalment`,
      };
    } else {
      // Level 1: Default - deposits should be paid
      activeLevel = {
        level: 1,
        label: "Deposits Due",
        count: level1Count,
        description: `${level1Count} awaiting deposit`,
      };
    }

    return {
      activeLevel,
      totalUnpaid: activeBookings.length,
      level1Count,
      level2Count,
      level3Count,
    };
  }, [bookings, tour]);
};
