// ============================================================
// OWNER DASHBOARD / BED MAP / VACANCY PIPELINE
// Prisma only
// NO SQL
// NO $queryRaw
// NO findMany()
// NO detailed records
// NO Prisma schema changes
//
// Covers:
//
// 1. Dashboard
// 2. Bed Map
// 3. Vacancy Pipeline
// 4. Residents
// 5. Rent Status
// 6. Resident Happiness
// ============================================================

import { getPrismaClient } from "../prisma.js";

const prisma = getPrismaClient("pg");


// ============================================================
// CURRENT DATABASE STATUS IDs
// From st_pg_cur_sts
// ============================================================

const STATUS = {

  // ----------------------------------------------------------
  // BED STATUS
  // ----------------------------------------------------------

  VACANT: 3,

  RESERVED: 4,

  OCCUPIED: 5,


  // ----------------------------------------------------------
  // RESIDENT STATUS
  // ----------------------------------------------------------

  ACTIVE: 10,


  // ----------------------------------------------------------
  // SERVICE / ISSUE STATUS
  // ----------------------------------------------------------

  TICKET_RAISED: 11,

  TICKET_IN_PROGRESS: 12,

  TICKET_RESOLVED: 13,


  // ----------------------------------------------------------
  // RENT STATUS
  // ----------------------------------------------------------

  PAYMENT_DUE: 18,

  PAID_FULL: 19,

  NOTICE_GIVEN: 24,

  NOTICE_ACCEPTED: 25,

  IN_NOTICE_PERIOD: 26,

  PAID_PARTIAL: 27

};


// ============================================================
// OWNER DASHBOARD SERVICE
// ============================================================

export const ownerDashboardService1 = async (pgId) => {

  // ----------------------------------------------------------
  // VALIDATE PG ID
  // ----------------------------------------------------------

  if (!Number.isInteger(pgId) || pgId <= 0) {
    throw new Error("Invalid pgId");
  }


  // ----------------------------------------------------------
  // CHECK PG EXISTS
  // ----------------------------------------------------------

  const pgExists = await prisma.dy_pg_info.count({
    where: {
      id: pgId
    }
  });


  if (pgExists === 0) {
    throw new Error("PG not found");
  }


  // ----------------------------------------------------------
  // DATE
  // ----------------------------------------------------------

 const today = new Date();
const startOfToday = new Date(today);
startOfToday.setHours(0, 0, 0, 0);

const startOfTomorrow = new Date(startOfToday);
startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);


  
 

  const next15Days = new Date(today);

  next15Days.setDate(
    next15Days.getDate() + 15
  );


  // ==========================================================
  // ALL AGGREGATIONS
  // ==========================================================

  const [

    // --------------------------------------------------------
    // BED MAP
    // --------------------------------------------------------

    totalBeds,

    occupiedBeds,

    vacantBeds,

    reservedBeds,

    noticeBeds,


    // --------------------------------------------------------
    // RESIDENTS
    // --------------------------------------------------------

    totalResidents,

    activeResidents,


    // --------------------------------------------------------
    // VACANCY PIPELINE
    // --------------------------------------------------------

    upcomingVacancy,

    enquiriesOpen,
    followUpsToday,

    // --------------------------------------------------------
    // ISSUES
    // --------------------------------------------------------

    openIssues,


    // --------------------------------------------------------
    // RENT STATUS
    // --------------------------------------------------------

    paidRent,

    dueRent,

    partialRent,

    overdueRent,


    // --------------------------------------------------------
    // HAPPINESS
    // --------------------------------------------------------

    averageRating,
    

  ] = await Promise.all([


    // ========================================================
    // BED MAP
    // ========================================================

    // Total beds belonging to this PG
    prisma.dy_pg_bed_info.count({
      where: {
        dy_pg_room_info: {
          pg_info: pgId
        }
      }
    }),


    // Occupied beds
    prisma.dy_pg_bed_info.count({
      where: {
        dy_pg_room_info: {
          pg_info: pgId
        },

        bed_status: STATUS.OCCUPIED
      }
    }),


    // Vacant beds
    prisma.dy_pg_bed_info.count({
      where: {
        dy_pg_room_info: {
          pg_info: pgId
        },

        bed_status: STATUS.VACANT
      }
    }),


    // Reserved beds
    prisma.dy_pg_bed_info.count({
      where: {
        dy_pg_room_info: {
          pg_info: pgId
        },

        bed_status: STATUS.RESERVED
      }
    }),


    // Notice beds
    prisma.dy_pg_bed_info.count({
      where: {
        dy_pg_room_info: {
          pg_info: pgId
        },

        bed_status: {
          in: [
            STATUS.NOTICE_GIVEN,
            STATUS.NOTICE_ACCEPTED,
            STATUS.IN_NOTICE_PERIOD
          ]
        }
      }
    }),


    // ========================================================
    // RESIDENTS
    // ========================================================

    // Total guests belonging to PG
    prisma.dy_pg_guest_info.count({
      where: {
        pg_id: pgId
      }
    }),


    // Active residents
    prisma.dy_pg_guest_info.count({
      where: {
        pg_id: pgId,

        guest_status: 5
      }
    }),


    // ========================================================
    // UPCOMING VACANCY
    // ========================================================

    prisma.dy_pg_bookings.count({
      where: {

        pg_id: pgId,

        planned_check_out_date: {
          gte: today,
          lte: next15Days
        }
      }
    }),


    // ========================================================
    // OPEN ENQUIRIES
    // ========================================================

    prisma.dy_pg_requests.count({
      where: {
        pg_info: pgId
      }
    }),

    // ========================================================
// FOLLOW-UPS TODAY
// planned_check_in_date = today
// ========================================================

prisma.dy_pg_bookings.count({
  where: {
    pg_id: pgId,

    planned_check_in_date: {
      gte: startOfToday,
      lt: startOfTomorrow
    }
  }
}),


    // ========================================================
    // OPEN ISSUES
    // ========================================================

    prisma.dy_pg_srv_reqs.count({
      where: {

        pg_id: pgId,

        service_status: {
          in: [
            STATUS.TICKET_RAISED,
            STATUS.TICKET_IN_PROGRESS
          ]
        }
      }
    }),


    // ========================================================
    // RENT STATUS
    // ========================================================

    // --------------------------------------------------------
    // PAID
    // --------------------------------------------------------
    //
    // payment_status = 19
    // Paid-Full
    //
    // Count payment records, because UI shows:
    //
    // Paid 32
    //
    // NOT total rupee amount.
    //
    prisma.dy_payments_info.count({
      where: {

        dy_invoices: {
          dy_pg_bookings: {
            pg_id: pgId
          }
        },

        payment_status: STATUS.PAID_FULL
      }
    }),


    // --------------------------------------------------------
    // DUE
    // --------------------------------------------------------
    //
    // payment_status = 18
    // PaymentDue
    //
    prisma.dy_payments_info.count({
      where: {

        dy_invoices: {
          dy_pg_bookings: {
            pg_id: pgId
          }
        },

        payment_status: STATUS.PAYMENT_DUE
      }
    }),


    // --------------------------------------------------------
    // PARTIAL
    // --------------------------------------------------------
    //
    // payment_status = 27
    // Paid-Partial
    //
    prisma.dy_payments_info.count({
      where: {

        dy_invoices: {
          dy_pg_bookings: {
            pg_id: pgId
          }
        },

        payment_status: STATUS.PAID_PARTIAL
      }
    }),


    // --------------------------------------------------------
    // OVERDUE
    // --------------------------------------------------------
    //
    // Overdue is NOT a separate payment_status in your
    // current status table.
    //
    // Therefore:
    //
    // invoice due date < today
    // AND payment balance > 0
    //
    // Example:
    //
    // inv_duedate = 2026-08-10
    // today       = 2026-08-25
    // balance     = 6000
    //
    // => OVERDUE
    //
    prisma.dy_payments_info.count({
      where: {

        dy_invoices: {

          dy_pg_bookings: {
            pg_id: pgId
          },

          inv_duedate: {
            lt: today
          }
        },

        balance: {
          gt: 0
        }
      }
    }),


    // ========================================================
    // RESIDENT HAPPINESS
    // ========================================================

  // ========================================================
// RESIDENT HAPPINESS
// ========================================================
//
// Happiness rating is calculated from:
// dy_pg_srv_reqs.feedback
//
// Only feedback belonging to this PG is considered.
// NULL feedback values are ignored.
//
// ========================================================

prisma.dy_pg_srv_reqs.aggregate({

  where: {

    pg_id: pgId,

    feedback: {
      not: null
    }

  },

  _avg: {
    feedback: true
  }

})

  ]);


  // ==========================================================
  // OCCUPANCY
  // ==========================================================

  const occupancyPercentage =
    totalBeds > 0
      ? Number(
          ((occupiedBeds / totalBeds) * 100).toFixed(1)
        )
      : 0;


  // ==========================================================
  // RENT STATUS
  // ==========================================================

  // ----------------------------------------------------------
  // Total residents for Rent Follow-up screen
  // ----------------------------------------------------------

  const rentStatusTotalResidents =
    totalResidents;


  // ----------------------------------------------------------
  // Total rent-status records
  // ----------------------------------------------------------
  //
  // This is used for percentage calculation.
  //
  // Example:
  //
  // Paid     = 32
  // Due      = 8
  // Partial  = 3
  // Overdue  = 7
  //
  // Total    = 50
  //
  // ----------------------------------------------------------

  const rentStatusTotal =
    paidRent +
    dueRent +
    partialRent +
    overdueRent;


  // ----------------------------------------------------------
  // Percentages
  // ----------------------------------------------------------

  const paidPercentage =
    rentStatusTotal > 0
      ? Number(
          ((paidRent / rentStatusTotal) * 100).toFixed(1)
        )
      : 0;


  const duePercentage =
    rentStatusTotal > 0
      ? Number(
          ((dueRent / rentStatusTotal) * 100).toFixed(1)
        )
      : 0;


  const partialPercentage =
    rentStatusTotal > 0
      ? Number(
          ((partialRent / rentStatusTotal) * 100).toFixed(1)
        )
      : 0;


  const overduePercentage =
    rentStatusTotal > 0
      ? Number(
          ((overdueRent / rentStatusTotal) * 100).toFixed(1)
        )
      : 0;


  // ==========================================================
  // RATING
  // ==========================================================

  const rating =
    Number(
      Number(
        averageRating?._avg?.feedback || 0
      ).toFixed(1)
    );


  // ==========================================================
  // FINAL AGGREGATED RESPONSE
  // ==========================================================

  return {

    // ========================================================
    // DASHBOARD
    // ========================================================

    dashboard: {

      occupancy: {

        occupied: occupiedBeds,

        total: totalBeds,

        percentage: occupancyPercentage
      },

      vacantBeds,

      upcomingVacancy,

      openIssues
    },


    // ========================================================
    // BED MAP
    // ========================================================

    bedMap: {

      totalBeds,

      occupiedBeds,

      vacantBeds,

      noticeBeds,

      reservedBeds
    },


    // ========================================================
    // VACANCY PIPELINE
    // ========================================================

    vacancyPipeline: {
  upcomingVacancy,
  enquiriesOpen,
  followUpsToday
},


    // ========================================================
    // RESIDENTS
    // ========================================================

    residents: {

      totalResidents,

      activeResidents
    },


    // ========================================================
    // RENT STATUS
    // ========================================================
    //
    // This matches the Rent Follow-up screen.
    //
    // ========================================================

    rentStatus: {

      paid: paidRent,

      due: dueRent,

      partial: partialRent,

      overdue: overdueRent,

      totalResidents: rentStatusTotalResidents,

      total: rentStatusTotal,

      percentages: {

        paid: paidPercentage,

        due: duePercentage,

        partial: partialPercentage,

        overdue: overduePercentage
      },

      overview: {

        paid: {
          count: paidRent,
          percentage: paidPercentage
        },

        due: {
          count: dueRent,
          percentage: duePercentage
        },

        partial: {
          count: partialRent,
          percentage: partialPercentage
        },

        overdue: {
          count: overdueRent,
          percentage: overduePercentage
        },

        totalResidents: rentStatusTotalResidents
      }

    },


    // ========================================================
    // RESIDENT HAPPINESS
    // ========================================================

    happiness: {

      rating

    }

  };

};


export const ownerDashboardService2 = async (pgId) => {

  // ----------------------------------------------------------
  // VALIDATE PG ID
  // ----------------------------------------------------------

  if (!Number.isInteger(pgId) || pgId <= 0) {
    throw new Error("Invalid pgId");
  }


  // ----------------------------------------------------------
  // CHECK PG EXISTS
  // ----------------------------------------------------------

  const pgExists = await prisma.dy_pg_info.count({
    where: {
      id: pgId
    }
  });


  if (pgExists === 0) {
    throw new Error("PG not found");
  }


  // ----------------------------------------------------------
  // DATE
  // ----------------------------------------------------------

  const today = new Date();

  const startOfToday = new Date(today);
  startOfToday.setHours(0, 0, 0, 0);

  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(
    startOfTomorrow.getDate() + 1
  );


  // ==========================================================
  // VACANCY DATE RANGES
  // ==========================================================

  // ----------------------------------------------------------
  // NEXT 15 DAYS
  // ----------------------------------------------------------

  const next15Days = new Date(startOfToday);

  next15Days.setDate(
    next15Days.getDate() + 15
  );


  // ----------------------------------------------------------
  // NEXT 30 DAYS
  // ----------------------------------------------------------

  const next30Days = new Date(startOfToday);

  next30Days.setDate(
    next30Days.getDate() + 30
  );


  // ----------------------------------------------------------
  // NEXT 60 DAYS
  // ----------------------------------------------------------

  const next60Days = new Date(startOfToday);

  next60Days.setDate(
    next60Days.getDate() + 60
  );


  // ==========================================================
  // ALL AGGREGATIONS
  // ==========================================================

  const [

    // --------------------------------------------------------
    // BED MAP
    // --------------------------------------------------------

    totalBeds,

    occupiedBeds,

    vacantBeds,

    reservedBeds,

    noticeBeds,


    // --------------------------------------------------------
    // RESIDENTS
    // --------------------------------------------------------

    totalResidents,

    activeResidents,


    // --------------------------------------------------------
    // VACANCY PIPELINE
    // --------------------------------------------------------

    upcomingVacancy,

    upcomingVacancy15Days,

    upcomingVacancy30Days,

    upcomingVacancy60Days,

    vacancyCalendar,

    enquiriesOpen,

    followUpsToday,


    // --------------------------------------------------------
    // ISSUES
    // --------------------------------------------------------

    openIssues,


    // --------------------------------------------------------
    // RENT STATUS
    // --------------------------------------------------------

    paidRent,

    dueRent,

    partialRent,

    overdueRent,


    // --------------------------------------------------------
    // HAPPINESS
    // --------------------------------------------------------

    averageRating

  ] = await Promise.all([


    // ========================================================
    // BED MAP
    // ========================================================

    // Total beds belonging to this PG
    prisma.dy_pg_bed_info.count({
      where: {
        dy_pg_room_info: {
          pg_info: pgId
        }
      }
    }),


    // Occupied beds
    prisma.dy_pg_bed_info.count({
      where: {
        dy_pg_room_info: {
          pg_info: pgId
        },

        bed_status: STATUS.OCCUPIED
      }
    }),


    // Vacant beds
    prisma.dy_pg_bed_info.count({
      where: {
        dy_pg_room_info: {
          pg_info: pgId
        },

        bed_status: STATUS.VACANT
      }
    }),


    // Reserved beds
    prisma.dy_pg_bed_info.count({
      where: {
        dy_pg_room_info: {
          pg_info: pgId
        },

        bed_status: STATUS.RESERVED
      }
    }),


    // Notice beds
    prisma.dy_pg_bed_info.count({
      where: {
        dy_pg_room_info: {
          pg_info: pgId
        },

        bed_status: {
          in: [
            STATUS.NOTICE_GIVEN,
            STATUS.NOTICE_ACCEPTED,
            STATUS.IN_NOTICE_PERIOD
          ]
        }
      }
    }),


    // ========================================================
    // RESIDENTS
    // ========================================================

    // Total guests belonging to PG
    prisma.dy_pg_guest_info.count({
      where: {
        pg_id: pgId
      }
    }),


    // Active residents
    prisma.dy_pg_guest_info.count({
      where: {
        pg_id: pgId,

        guest_status: 5
      }
    }),


    // ========================================================
    // UPCOMING VACANCY
    // ========================================================

    // Existing dashboard value
    // Today -> next 15 days
    prisma.dy_pg_bookings.count({
      where: {

        pg_id: pgId,

        planned_check_out_date: {
          gte: startOfToday,
          lte: next15Days
        }
      }
    }),


    // ========================================================
    // UPCOMING VACANCY - NEXT 15 DAYS
    // ========================================================

    prisma.dy_pg_bookings.count({
      where: {

        pg_id: pgId,

        planned_check_out_date: {
          gte: startOfToday,
          lt: next15Days
        }
      }
    }),


    // ========================================================
    // UPCOMING VACANCY - NEXT 30 DAYS
    // ========================================================

    prisma.dy_pg_bookings.count({
      where: {

        pg_id: pgId,

        planned_check_out_date: {
          gte: startOfToday,
          lt: next30Days
        }
      }
    }),


    // ========================================================
    // UPCOMING VACANCY - NEXT 60 DAYS
    // ========================================================

    prisma.dy_pg_bookings.count({
      where: {

        pg_id: pgId,

        planned_check_out_date: {
          gte: startOfToday,
          lt: next60Days
        }
      }
    }),


    // ========================================================
    // FULL VACANCY CALENDAR
    // ========================================================
    //
    // Returns bookings whose planned checkout is within
    // the next 60 days.
    //
    // We fetch the actual booking information so the frontend
    // can show vacancy against each calendar date.
    //
    // ========================================================

    prisma.dy_pg_bookings.findMany({
      where: {

        pg_id: pgId,

        planned_check_out_date: {
          gte: startOfToday,
          lt: next60Days
        }
      },

      select: {
        id: true,
        bkg_no: true,
        pg_id: true,
        room_id: true,
        bed_id: true,
        guest_id: true,
        planned_check_in_date: true,
        actual_check_in_date: true,
        planned_check_out_date: true,
        actual_check_out_date: true,
        bkg_status: true
      },

      orderBy: {
        planned_check_out_date: "asc"
      }
    }),


    // ========================================================
    // OPEN ENQUIRIES
    // ========================================================

    prisma.dy_pg_requests.count({
      where: {
        pg_info: pgId
      }
    }),


    // ========================================================
    // FOLLOW-UPS TODAY
    // planned_check_in_date = today
    // ========================================================

    prisma.dy_pg_bookings.count({
      where: {
        pg_id: pgId,

        planned_check_in_date: {
          gte: startOfToday,
          lt: startOfTomorrow
        }
      }
    }),


    // ========================================================
    // OPEN ISSUES
    // ========================================================

    prisma.dy_pg_srv_reqs.count({
      where: {

        pg_id: pgId,

        service_status: {
          in: [
            STATUS.TICKET_RAISED,
            STATUS.TICKET_IN_PROGRESS
          ]
        }
      }
    }),


    // ========================================================
    // RENT STATUS
    // ========================================================

    // PAID
    prisma.dy_payments_info.count({
      where: {

        dy_invoices: {
          dy_pg_bookings: {
            pg_id: pgId
          }
        },

        payment_status: STATUS.PAID_FULL
      }
    }),


    // DUE
    prisma.dy_payments_info.count({
      where: {

        dy_invoices: {
          dy_pg_bookings: {
            pg_id: pgId
          }
        },

        payment_status: STATUS.PAYMENT_DUE
      }
    }),


    // PARTIAL
    prisma.dy_payments_info.count({
      where: {

        dy_invoices: {
          dy_pg_bookings: {
            pg_id: pgId
          }
        },

        payment_status: STATUS.PAID_PARTIAL
      }
    }),


    // OVERDUE
    prisma.dy_payments_info.count({
      where: {

        dy_invoices: {

          dy_pg_bookings: {
            pg_id: pgId
          },

          inv_duedate: {
            lt: today
          }
        },

        balance: {
          gt: 0
        }
      }
    }),


    // ========================================================
    // RESIDENT HAPPINESS
    // ========================================================

    prisma.dy_pg_srv_reqs.aggregate({

      where: {

        pg_id: pgId,

        feedback: {
          not: null
        }

      },

      _avg: {
        feedback: true
      }

    })

  ]);


  // ==========================================================
  // BUILD CALENDAR DATA
  // ==========================================================

  /*
  ------------------------------------------------------------
  Group checkout bookings by date.

  Example:

  2026-09-18 -> 2 vacancies
  2026-09-20 -> 1 vacancy
  2026-09-25 -> 3 vacancies
  ------------------------------------------------------------
  */

  const vacancyCalendarMap = {};

  vacancyCalendar.forEach(booking => {

    if (!booking.planned_check_out_date) {
      return;
    }

    const checkoutDate =
      new Date(
        booking.planned_check_out_date
      );

    const dateKey =
      [
        checkoutDate.getFullYear(),
        String(
          checkoutDate.getMonth() + 1
        ).padStart(2, "0"),
        String(
          checkoutDate.getDate()
        ).padStart(2, "0")
      ].join("-");


    if (!vacancyCalendarMap[dateKey]) {

      vacancyCalendarMap[dateKey] = {
        date: dateKey,
        vacancyCount: 0,
        bookings: []
      };
    }


    vacancyCalendarMap[dateKey].vacancyCount += 1;


    vacancyCalendarMap[dateKey].bookings.push({
      bookingId: booking.id,
      bookingNo: booking.bkg_no,
      roomId: booking.room_id,
      bedId: booking.bed_id,
      guestId: booking.guest_id,
      plannedCheckInDate:
        booking.planned_check_in_date,
      plannedCheckOutDate:
        booking.planned_check_out_date,
      actualCheckInDate:
        booking.actual_check_in_date,
      actualCheckOutDate:
        booking.actual_check_out_date,
      bookingStatus:
        booking.bkg_status
    });

  });


  // ==========================================================
  // CONVERT MAP TO ARRAY
  // ==========================================================

  const vacancyCalendarData =
    Object.values(
      vacancyCalendarMap
    ).sort(
      (a, b) =>
        a.date.localeCompare(b.date)
    );


  // ==========================================================
  // OCCUPANCY
  // ==========================================================

  const occupancyPercentage =
    totalBeds > 0
      ? Number(
          (
            (occupiedBeds / totalBeds) *
            100
          ).toFixed(1)
        )
      : 0;


  // ==========================================================
  // RENT STATUS
  // ==========================================================

  const rentStatusTotalResidents =
    totalResidents;


  const rentStatusTotal =
    paidRent +
    dueRent +
    partialRent +
    overdueRent;


  // ----------------------------------------------------------
  // Percentages
  // ----------------------------------------------------------

  const paidPercentage =
    rentStatusTotal > 0
      ? Number(
          (
            (paidRent /
              rentStatusTotal) *
            100
          ).toFixed(1)
        )
      : 0;


  const duePercentage =
    rentStatusTotal > 0
      ? Number(
          (
            (dueRent /
              rentStatusTotal) *
            100
          ).toFixed(1)
        )
      : 0;


  const partialPercentage =
    rentStatusTotal > 0
      ? Number(
          (
            (partialRent /
              rentStatusTotal) *
            100
          ).toFixed(1)
        )
      : 0;


  const overduePercentage =
    rentStatusTotal > 0
      ? Number(
          (
            (overdueRent /
              rentStatusTotal) *
            100
          ).toFixed(1)
        )
      : 0;


  // ==========================================================
  // RATING
  // ==========================================================

  const rating =
    Number(
      Number(
        averageRating?._avg?.feedback || 0
      ).toFixed(1)
    );


  // ==========================================================
  // FINAL AGGREGATED RESPONSE
  // ==========================================================

  return {

    // ========================================================
    // DASHBOARD
    // ========================================================

    dashboard: {

      occupancy: {

        occupied: occupiedBeds,

        total: totalBeds,

        percentage:
          occupancyPercentage
      },

      vacantBeds,

      upcomingVacancy,

      openIssues
    },


    // ========================================================
    // BED MAP
    // ========================================================

    bedMap: {

      totalBeds,

      occupiedBeds,

      vacantBeds,

      noticeBeds,

      reservedBeds
    },


    // ========================================================
    // VACANCY PIPELINE
    // ========================================================

    vacancyPipeline: {

      // Existing 15-day value
      upcomingVacancy,

      // New vacancy ranges
      next15Days: upcomingVacancy15Days,

      next30Days: upcomingVacancy30Days,

      next60Days: upcomingVacancy60Days,

      enquiriesOpen,

      followUpsToday
    },


    // ========================================================
    // FULL VACANCY CALENDAR
    // ========================================================

    vacancyCalendar: {

      range: {
        from: startOfToday,
        to: next60Days
      },

      totalVacancies:
        upcomingVacancy60Days,

      dates:
        vacancyCalendarData
    },


    // ========================================================
    // RESIDENTS
    // ========================================================

    residents: {

      totalResidents,

      activeResidents
    },


    // ========================================================
    // RENT STATUS
    // ========================================================

    rentStatus: {

      paid: paidRent,

      due: dueRent,

      partial: partialRent,

      overdue: overdueRent,

      totalResidents:
        rentStatusTotalResidents,

      total:
        rentStatusTotal,

      percentages: {

        paid:
          paidPercentage,

        due:
          duePercentage,

        partial:
          partialPercentage,

        overdue:
          overduePercentage
      },

      overview: {

        paid: {
          count: paidRent,
          percentage:
            paidPercentage
        },

        due: {
          count: dueRent,
          percentage:
            duePercentage
        },

        partial: {
          count: partialRent,
          percentage:
            partialPercentage
        },

        overdue: {
          count: overdueRent,
          percentage:
            overduePercentage
        },

        totalResidents:
          rentStatusTotalResidents
      }

    },


    // ========================================================
    // RESIDENT HAPPINESS
    // ========================================================

    happiness: {

      rating

    }

  };

};


export const ownerDashboardService = async (
  pgId,
  days 
) => {

  // ----------------------------------------------------------
  // VALIDATE PG ID
  // ----------------------------------------------------------

  if (!Number.isInteger(pgId) || pgId <= 0) {
    throw new Error("Invalid pgId");
  }


  // ----------------------------------------------------------
  // VALIDATE CALENDAR DAYS
  // ----------------------------------------------------------

  days = Number(days);

  if (![15, 30, 60].includes(days)) {
    throw new Error(
      "days must be 15, 30, or 60"
    );
  }


  // ----------------------------------------------------------
  // CHECK PG EXISTS
  // ----------------------------------------------------------

  const pgExists =
    await prisma.dy_pg_info.count({
      where: {
        id: pgId
      }
    });


  if (pgExists === 0) {
    throw new Error("PG not found");
  }


  // ----------------------------------------------------------
  // DATE
  // ----------------------------------------------------------

  const today = new Date();

  const startOfToday = new Date(today);

  startOfToday.setHours(
    0,
    0,
    0,
    0
  );


  const startOfTomorrow =
    new Date(startOfToday);

  startOfTomorrow.setDate(
    startOfTomorrow.getDate() + 1
  );


  // ==========================================================
  // VACANCY DATE RANGES
  // ==========================================================

  // ----------------------------------------------------------
  // NEXT 15 DAYS
  // ----------------------------------------------------------

  const next15Days =
    new Date(startOfToday);

  next15Days.setDate(
    next15Days.getDate() + 15
  );


  // ----------------------------------------------------------
  // NEXT 30 DAYS
  // ----------------------------------------------------------

  const next30Days =
    new Date(startOfToday);

  next30Days.setDate(
    next30Days.getDate() + 30
  );


  // ----------------------------------------------------------
  // NEXT 60 DAYS
  // ----------------------------------------------------------

  const next60Days =
    new Date(startOfToday);

  next60Days.setDate(
    next60Days.getDate() + 60
  );


  // ----------------------------------------------------------
  // SELECT CALENDAR END DATE
  // ----------------------------------------------------------

  let calendarEndDate;

  if (days === 15) {

    calendarEndDate =
      next15Days;

  } else if (days === 30) {

    calendarEndDate =
      next30Days;

  } else {

    calendarEndDate =
      next60Days;
  }


  console.log(
    "VACANCY CALENDAR FILTER:",
    {
      pgId,
      days,
      from: startOfToday,
      to: calendarEndDate
    }
  );


  // ==========================================================
  // ALL AGGREGATIONS
  // ==========================================================

  const [

    // --------------------------------------------------------
    // BED MAP
    // --------------------------------------------------------

    totalBeds,

    occupiedBeds,

    vacantBeds,

    reservedBeds,

    noticeBeds,


    // --------------------------------------------------------
    // RESIDENTS
    // --------------------------------------------------------

    totalResidents,

    activeResidents,


    // --------------------------------------------------------
    // VACANCY PIPELINE
    // --------------------------------------------------------

    upcomingVacancy,

    enquiriesOpen,

    followUpsToday,


    // --------------------------------------------------------
    // ISSUES
    // --------------------------------------------------------

    openIssues,


    // --------------------------------------------------------
    // RENT STATUS
    // --------------------------------------------------------

    paidRent,

    dueRent,

    partialRent,

    overdueRent,


    // --------------------------------------------------------
    // HAPPINESS
    // --------------------------------------------------------

    averageRating,


    // --------------------------------------------------------
    // VACANCY CALENDAR
    // --------------------------------------------------------

    vacancyCalendar

  ] = await Promise.all([


    // ========================================================
    // BED MAP
    // ========================================================

    // Total beds belonging to this PG
    prisma.dy_pg_bed_info.count({
      where: {

        dy_pg_room_info: {
          pg_info: pgId
        }

      }
    }),


    // Occupied beds
    prisma.dy_pg_bed_info.count({
      where: {

        dy_pg_room_info: {
          pg_info: pgId
        },

        bed_status:
          STATUS.OCCUPIED

      }
    }),


    // Vacant beds
    prisma.dy_pg_bed_info.count({
      where: {

        dy_pg_room_info: {
          pg_info: pgId
        },

        bed_status:
          STATUS.VACANT

      }
    }),


    // Reserved beds
    prisma.dy_pg_bed_info.count({
      where: {

        dy_pg_room_info: {
          pg_info: pgId
        },

        bed_status:
          STATUS.RESERVED

      }
    }),


    // Notice beds
    prisma.dy_pg_bed_info.count({
      where: {

        dy_pg_room_info: {
          pg_info: pgId
        },

        bed_status: {
          in: [
            STATUS.NOTICE_GIVEN,
            STATUS.NOTICE_ACCEPTED,
            STATUS.IN_NOTICE_PERIOD
          ]
        }

      }
    }),


    // ========================================================
    // RESIDENTS
    // ========================================================

    // Total guests belonging to PG
    prisma.dy_pg_guest_info.count({
      where: {

        pg_id: pgId

      }
    }),


    // Active residents
    prisma.dy_pg_guest_info.count({
      where: {

        pg_id: pgId,

        guest_status: 5

      }
    }),


    // ========================================================
    // UPCOMING VACANCY
    // ========================================================

    // Existing dashboard value
    //
    // Today -> next 15 days
    //
    prisma.dy_pg_bookings.count({
      where: {

        pg_id: pgId,

        planned_check_out_date: {
          gte: startOfToday,
          lte: next15Days
        }

      }
    }),


    // ========================================================
    // OPEN ENQUIRIES
    // ========================================================

    prisma.dy_pg_requests.count({
      where: {

        pg_info: pgId

      }
    }),


    // ========================================================
    // FOLLOW-UPS TODAY
    // ========================================================

    prisma.dy_pg_bookings.count({
      where: {

        pg_id: pgId,

        planned_check_in_date: {

          gte: startOfToday,

          lt: startOfTomorrow

        }

      }
    }),


    // ========================================================
    // OPEN ISSUES
    // ========================================================

    prisma.dy_pg_srv_reqs.count({
      where: {

        pg_id: pgId,

        service_status: {

          in: [
            STATUS.TICKET_RAISED,
            STATUS.TICKET_IN_PROGRESS
          ]

        }

      }
    }),


    // ========================================================
    // RENT STATUS
    // ========================================================

    // PAID
    prisma.dy_payments_info.count({
      where: {

        dy_invoices: {

          dy_pg_bookings: {

            pg_id: pgId

          }

        },

        payment_status:
          STATUS.PAID_FULL

      }
    }),


    // DUE
    prisma.dy_payments_info.count({
      where: {

        dy_invoices: {

          dy_pg_bookings: {

            pg_id: pgId

          }

        },

        payment_status:
          STATUS.PAYMENT_DUE

      }
    }),


    // PARTIAL
    prisma.dy_payments_info.count({
      where: {

        dy_invoices: {

          dy_pg_bookings: {

            pg_id: pgId

          }

        },

        payment_status:
          STATUS.PAID_PARTIAL

      }
    }),


    // OVERDUE
    prisma.dy_payments_info.count({
      where: {

        dy_invoices: {

          dy_pg_bookings: {

            pg_id: pgId

          },

          inv_duedate: {

            lt: today

          }

        },

        balance: {

          gt: 0

        }

      }
    }),


    // ========================================================
    // RESIDENT HAPPINESS
    // ========================================================

    prisma.dy_pg_srv_reqs.aggregate({

      where: {

        pg_id: pgId,

        feedback: {

          not: null

        }

      },

      _avg: {

        feedback: true

      }

    }),


    // ========================================================
    // VACANCY CALENDAR
    // ========================================================
    //
    // THIS IS NOW FILTERED BY:
    //
    // days = 15
    // days = 30
    // days = 60
    //
    // ========================================================

    prisma.dy_pg_bookings.findMany({

      where: {

        pg_id: pgId,

        planned_check_out_date: {

          gte: startOfToday,

          lt: calendarEndDate

        }

      },

      select: {

        id: true,

        bkg_no: true,

        pg_id: true,

        room_id: true,

        bed_id: true,

        guest_id: true,

        planned_check_in_date: true,

        actual_check_in_date: true,

        planned_check_out_date: true,

        actual_check_out_date: true,

        bkg_status: true

      },

      orderBy: {

        planned_check_out_date:
          "asc"

      }

    })

  ]);


  // ==========================================================
  // BUILD CALENDAR DATA
  // ==========================================================

  /*
  ------------------------------------------------------------
  Group checkout bookings by date.

  Example:

  2026-09-18 -> 2 vacancies
  2026-09-20 -> 1 vacancy
  2026-09-25 -> 3 vacancies

  ------------------------------------------------------------
  */

  const vacancyCalendarMap = {};


  vacancyCalendar.forEach(
    booking => {

      if (
        !booking.planned_check_out_date
      ) {

        return;
      }


      const checkoutDate =
        new Date(
          booking.planned_check_out_date
        );


      // ------------------------------------------------------
      // DATE KEY
      // ------------------------------------------------------

      const dateKey =
        [
          checkoutDate.getFullYear(),

          String(
            checkoutDate.getMonth() + 1
          ).padStart(2, "0"),

          String(
            checkoutDate.getDate()
          ).padStart(2, "0")

        ].join("-");


      // ------------------------------------------------------
      // CREATE DATE
      // ------------------------------------------------------

      if (
        !vacancyCalendarMap[dateKey]
      ) {

        vacancyCalendarMap[dateKey] = {

          date: dateKey,

          vacancyCount: 0,

          bookings: []

        };

      }


      // ------------------------------------------------------
      // VACANCY COUNT
      // ------------------------------------------------------

      vacancyCalendarMap[
        dateKey
      ].vacancyCount += 1;


      // ------------------------------------------------------
      // BOOKING DETAILS
      // ------------------------------------------------------

      vacancyCalendarMap[
        dateKey
      ].bookings.push({

        bookingId:
          booking.id,

        bookingNo:
          booking.bkg_no,

        roomId:
          booking.room_id,

        bedId:
          booking.bed_id,

        guestId:
          booking.guest_id,

        plannedCheckInDate:
          booking.planned_check_in_date,

        plannedCheckOutDate:
          booking.planned_check_out_date,

        actualCheckInDate:
          booking.actual_check_in_date,

        actualCheckOutDate:
          booking.actual_check_out_date,

        bookingStatus:
          booking.bkg_status

      });

    }
  );


  // ==========================================================
  // CONVERT MAP TO ARRAY
  // ==========================================================

  const vacancyCalendarData =
    Object.values(
      vacancyCalendarMap
    ).sort(
      (a, b) =>
        a.date.localeCompare(
          b.date
        )
    );


  // ==========================================================
  // OCCUPANCY
  // ==========================================================

  const occupancyPercentage =
    totalBeds > 0
      ? Number(
          (
            (occupiedBeds /
              totalBeds) *
            100
          ).toFixed(1)
        )
      : 0;


  // ==========================================================
  // RENT STATUS
  // ==========================================================

  const rentStatusTotalResidents =
    totalResidents;


  const rentStatusTotal =
    paidRent +
    dueRent +
    partialRent +
    overdueRent;


  // ----------------------------------------------------------
  // PAID PERCENTAGE
  // ----------------------------------------------------------

  const paidPercentage =
    rentStatusTotal > 0
      ? Number(
          (
            (paidRent /
              rentStatusTotal) *
            100
          ).toFixed(1)
        )
      : 0;


  // ----------------------------------------------------------
  // DUE PERCENTAGE
  // ----------------------------------------------------------

  const duePercentage =
    rentStatusTotal > 0
      ? Number(
          (
            (dueRent /
              rentStatusTotal) *
            100
          ).toFixed(1)
        )
      : 0;


  // ----------------------------------------------------------
  // PARTIAL PERCENTAGE
  // ----------------------------------------------------------

  const partialPercentage =
    rentStatusTotal > 0
      ? Number(
          (
            (partialRent /
              rentStatusTotal) *
            100
          ).toFixed(1)
        )
      : 0;


  // ----------------------------------------------------------
  // OVERDUE PERCENTAGE
  // ----------------------------------------------------------

  const overduePercentage =
    rentStatusTotal > 0
      ? Number(
          (
            (overdueRent /
              rentStatusTotal) *
            100
          ).toFixed(1)
        )
      : 0;


  // ==========================================================
  // RATING
  // ==========================================================

  const rating =
    Number(
      Number(
        averageRating?._avg?.feedback || 0
      ).toFixed(1)
    );


  // ==========================================================
  // FINAL AGGREGATED RESPONSE
  // ==========================================================

  return {

    // ========================================================
    // DASHBOARD
    // ========================================================

    dashboard: {

      occupancy: {

        occupied:
          occupiedBeds,

        total:
          totalBeds,

        percentage:
          occupancyPercentage

      },

      vacantBeds,

      upcomingVacancy,

      openIssues

    },


    // ========================================================
    // BED MAP
    // ========================================================

    bedMap: {

      totalBeds,

      occupiedBeds,

      vacantBeds,

      noticeBeds,

      reservedBeds

    },


    // ========================================================
    // VACANCY PIPELINE
    // ========================================================

    vacancyPipeline: {

      upcomingVacancy,

      enquiriesOpen,

      followUpsToday

    },


    // ========================================================
    // VACANCY CALENDAR
    // ========================================================

    vacancyCalendar: {

      /*
      --------------------------------------------------------
      Selected filter
      --------------------------------------------------------
      */

      days,

      /*
      --------------------------------------------------------
      Calendar range
      --------------------------------------------------------
      */

      range: {

        from:
          startOfToday,

        to:
          calendarEndDate

      },

      /*
      --------------------------------------------------------
      Total vacancy for selected range
      --------------------------------------------------------
      */

      totalVacancies:
        vacancyCalendar.length,

      /*
      --------------------------------------------------------
      Day-by-day vacancy
      --------------------------------------------------------
      */

      dates:
        vacancyCalendarData

    },


    // ========================================================
    // RESIDENTS
    // ========================================================

    residents: {

      totalResidents,

      activeResidents

    },


    // ========================================================
    // RENT STATUS
    // ========================================================

    rentStatus: {

      paid:
        paidRent,

      due:
        dueRent,

      partial:
        partialRent,

      overdue:
        overdueRent,

      totalResidents:
        rentStatusTotalResidents,

      total:
        rentStatusTotal,

      percentages: {

        paid:
          paidPercentage,

        due:
          duePercentage,

        partial:
          partialPercentage,

        overdue:
          overduePercentage

      },

      overview: {

        paid: {

          count:
            paidRent,

          percentage:
            paidPercentage

        },

        due: {

          count:
            dueRent,

          percentage:
            duePercentage

        },

        partial: {

          count:
            partialRent,

          percentage:
            partialPercentage

        },

        overdue: {

          count:
            overdueRent,

          percentage:
            overduePercentage

        },

        totalResidents:
          rentStatusTotalResidents

      }

    },


    // ========================================================
    // RESIDENT HAPPINESS
    // ========================================================

    happiness: {

      rating

    }

  };

};

// ============================================================
// AGGREGATE CONTROLLERS
// ============================================================




// ============================================================
// OWNER DASHBOARD
// ============================================================

// ============================================================
// AGGREGATE CONTROLLERS
// ============================================================




// ============================================================
// OWNER DASHBOARD
// ============================================================

export const getOwnerDashboard = async (req, res) => {

  try {

    // --------------------------------------------------------
    // GET PG ID
    // --------------------------------------------------------

    const pgId = Number(req.query.pgId);


    // --------------------------------------------------------
    // VALIDATE PG ID
    // --------------------------------------------------------

    if (!Number.isInteger(pgId) || pgId <= 0) {

      return res.status(400).json({

        success: false,

        message: "Valid pgId is required"
      });
    }


    // --------------------------------------------------------
    // GET DAYS
    // --------------------------------------------------------

    // Default is 15 days if days is not provided
    const days =
      req.query.days !== undefined
        ? Number(req.query.days)
        : 15;


    // --------------------------------------------------------
    // VALIDATE DAYS
    // --------------------------------------------------------

    if (![15, 30, 60].includes(days)) {

      return res.status(400).json({

        success: false,

        message: "days must be 15, 30, or 60"
      });
    }


    // --------------------------------------------------------
    // GET AGGREGATED DATA
    // --------------------------------------------------------

    const data =
      await ownerDashboardService(
        pgId,
        days
      );


    // --------------------------------------------------------
    // SUCCESS RESPONSE
    // --------------------------------------------------------

    return res.status(200).json({

      success: true,

      message:
        "Owner dashboard aggregate fetched successfully",

      data

    });

  } catch (error) {

    console.error(
      "OWNER DASHBOARD ERROR:",
      error
    );


    // --------------------------------------------------------
    // PG NOT FOUND
    // --------------------------------------------------------

    if (error.message === "PG not found") {

      return res.status(404).json({

        success: false,

        message: "PG not found"
      });
    }


    // --------------------------------------------------------
    // INVALID DAYS
    // --------------------------------------------------------

    if (
      error.message ===
      "days must be 15, 30, or 60"
    ) {

      return res.status(400).json({

        success: false,

        message:
          "days must be 15, 30, or 60"
      });
    }


    // --------------------------------------------------------
    // SERVER ERROR
    // --------------------------------------------------------

    return res.status(500).json({

      success: false,

      message:
        "Failed to fetch owner dashboard aggregate"
    });

  }

};

export const getOwnerRentStatus = async (req, res) => {
  try {
    const pgId = Number(req.query.pgId);

    // ---------------------------------------------
    // Validate pgId
    // ---------------------------------------------
    if (!Number.isInteger(pgId) || pgId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid pgId is required"
      });
    }

    // ---------------------------------------------
    // Get bookings using pg_id
    // ---------------------------------------------
    const bookings = await prisma.dy_pg_bookings.findMany({
      where: {
        pg_id: pgId
      },

      include: {
        // Guest + User
        dy_pg_guest_info: {
          include: {
            dy_user: true
          }
        },

        // Room
        dy_pg_room_info: true,

        // Bed
        dy_pg_bed_info: true,

        // Invoice + Payment
        dy_invoices: {
          include: {
            dy_payments_info: true
          }
        }
      },

      orderBy: {
        id: "desc"
      }
    });

    // ---------------------------------------------
    // Format response
    // ---------------------------------------------
    const data = bookings.map((booking) => {

      const invoice =
        booking.dy_invoices?.[0] || null;

      const payment =
        invoice?.dy_payments_info?.[0] || null;

      // -------------------------------------------
      // Payment status
      // -------------------------------------------
      let paymentStatus = "pending";

      if (payment) {
        switch (payment.payment_status) {
          case 19:
            paymentStatus = "paid";
            break;

          case 18:
            paymentStatus = "due";
            break;

          case 27:
            paymentStatus = "partial";
            break;

          default:
            paymentStatus = "pending";
        }
      }

      // -------------------------------------------
      // Response
      // -------------------------------------------
      return {
        invoiceId: invoice?.id ?? null,

        bookingId: booking.id,

        guestId: booking.guest_id,

        userId:
          booking.dy_pg_guest_info?.user_id ?? null,

        booking: {
          id: booking.id,

          room_id: booking.room_id,

          room_name:
            booking.dy_pg_room_info?.room_name ?? null,

          bed_id: booking.bed_id,

          bed_number:
            booking.dy_pg_bed_info?.bed_number ?? null
        },

        resident: {
          firstName:
            booking.dy_pg_guest_info?.dy_user?.first_name ?? null,

          lastName:
            booking.dy_pg_guest_info?.dy_user?.last_name ?? null
        },

        invoice: {
          totalAmount:
            invoice?.inv_total ??
            invoice?.inv_amount ??
            null,

          dueDate:
            invoice?.inv_duedate ?? null
        },

        payment: {
          status: paymentStatus
        }
      };
    });

    // ---------------------------------------------
    // Response
    // ---------------------------------------------
    return res.status(200).json({
      success: true,
      data
    });

  } catch (error) {

    console.error(
      "OWNER RENT STATUS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch rent status"
    });
  }
};

export const getBedMap1 = async (req, res) => {
  try {
    const pgId = Number(req.query.pgId);

    // --------------------------------------------------
    // Validate pgId
    // --------------------------------------------------
    if (!Number.isInteger(pgId) || pgId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid pgId is required"
      });
    }

    // --------------------------------------------------
    // Get Rooms → Beds
    // --------------------------------------------------
    const rooms = await prisma.dy_pg_room_info.findMany({
      where: {
        pg_info: pgId
      },
      orderBy: {
        id: "asc"
      },
      include: {
        dy_pg_bed_info: {
          orderBy: {
            id: "asc"
          }
        }
      }
    });

    // --------------------------------------------------
    // Get all bed IDs
    // --------------------------------------------------
    const bedIds = rooms.flatMap(room =>
      room.dy_pg_bed_info.map(bed => bed.id)
    );

    // --------------------------------------------------
    // Get current bookings for these beds
    // --------------------------------------------------
    const bookings = bedIds.length
      ? await prisma.dy_pg_bookings.findMany({
          where: {
            pg_id: pgId,
            bed_id: {
              in: bedIds
            },

            // Current / active bookings
            bkg_status: {
              notIn: [0, 3]
            }
          },
          orderBy: {
            id: "desc"
          },
          include: {
            dy_pg_guest_info: true
          }
        })
      : [];

    // --------------------------------------------------
    // Get user IDs from guests
    // --------------------------------------------------
    const userIds = bookings
      .map(booking => booking.dy_pg_guest_info?.user_id)
      .filter(Boolean);

    // --------------------------------------------------
    // Get users
    // --------------------------------------------------
    const users = userIds.length
      ? await prisma.dy_user.findMany({
          where: {
            id: {
              in: userIds
            }
          }
        })
      : [];

    // --------------------------------------------------
    // Create user lookup
    // --------------------------------------------------
    const userMap = new Map(
      users.map(user => [user.id, user])
    );

    // --------------------------------------------------
    // Create booking lookup by bed
    // --------------------------------------------------
    const bookingMap = new Map();

    for (const booking of bookings) {
      if (!bookingMap.has(booking.bed_id)) {
        bookingMap.set(booking.bed_id, booking);
      }
    }

    // --------------------------------------------------
    // Build Bed Map
    // --------------------------------------------------
    const roomData = rooms.map(room => {
      const beds = room.dy_pg_bed_info.map(bed => {
        const booking = bookingMap.get(bed.id);

        const guest = booking?.dy_pg_guest_info || null;

        const user = guest?.user_id
          ? userMap.get(guest.user_id) || null
          : null;

        return {
          bedId: bed.id,
          bedNumber: bed.bed_number,
          bedStatus: bed.bed_status,

          booking: booking
            ? {
                bookingId: booking.id,
                bookingNo: booking.bkg_no,
                plannedCheckInDate:
                  booking.planned_check_in_date,
                plannedCheckOutDate:
                  booking.planned_check_out_date,
                actualCheckInDate:
                  booking.actual_check_in_date,
                actualCheckOutDate:
                  booking.actual_check_out_date,
                bookingStatus: booking.bkg_status,
                monthlyRent: booking.monthly_rent,

                guest: guest
                  ? {
                      guestId: guest.id,
                      firstName: guest.first_name,
                      lastName: guest.last_name,
                      mobileNo: guest.mobile_no,
                      guestStatus: guest.guest_status,

                      user: user
                        ? {
                            userId: user.id,
                            firstName: user.first_name,
                            lastName: user.last_name,
                            email: user.email_id,
                            mobileNo: user.mobile_no
                          }
                        : null
                    }
                  : null
              }
            : null
        };
      });

      return {
        roomId: room.id,
        roomName: room.room_name,
        floor: room.floor_info,
        roomType: room.room_type,
        bathroomType: room.bathroom_type,
        hasTv: room.has_tv,
        hasAc: room.has_ac,
        hasBalcony: room.has_balcony,

        beds
      };
    });

    // --------------------------------------------------
    // Summary
    // --------------------------------------------------
    const allBeds = roomData.flatMap(room => room.beds);

    const totalBeds = allBeds.length;

    const occupiedBeds = allBeds.filter(
      bed =>
        bed.booking !== null ||
        String(bed.bedStatus).toUpperCase() === "OCCUPIED"
    ).length;

    const vacantBeds = totalBeds - occupiedBeds;

    // --------------------------------------------------
    // Final response
    // --------------------------------------------------
    return res.status(200).json({
      success: true,
      message: "Bed map fetched successfully",

      data: {
        pgId,

        summary: {
          totalRooms: roomData.length,
          totalBeds,
          occupiedBeds,
          vacantBeds
        },

        rooms: roomData
      }
    });

  } catch (error) {
    console.error("getBedMap error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch bed map",
      error: error.message
    });
  }
};

export const getBedMap2 = async (req, res) => {
  try {
    const pgId = Number(req.query.pgId);

    // --------------------------------------------------
    // Validate pgId
    // --------------------------------------------------
    if (!Number.isInteger(pgId) || pgId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid pgId is required"
      });
    }

    // --------------------------------------------------
    // STATUS NAME MAP
    // --------------------------------------------------
    // Existing numeric STATUS constants are converted
    // into number + name for response.
    //
    // IMPORTANT:
    // This does not change your existing STATUS constants.
    // --------------------------------------------------

    const statusMap = new Map();

    Object.entries(STATUS || {}).forEach(([key, value]) => {
      if (
        typeof value === "number" ||
        (!isNaN(Number(value)) && value !== "")
      ) {
        const numericValue = Number(value);

        if (!statusMap.has(numericValue)) {
          statusMap.set(
            numericValue,
            key
              .replace(/_/g, " ")
              .toLowerCase()
              .replace(/\b\w/g, char => char.toUpperCase())
          );
        }
      }
    });

    // --------------------------------------------------
    // STATUS HELPER
    // --------------------------------------------------

    const getStatusDetails = (status) => {

      if (
        status === null ||
        status === undefined
      ) {
        return {
          number: null,
          name: null
        };
      }

      const numericStatus =
        Number(status);

      return {
        number: numericStatus,
        name:
          statusMap.get(numericStatus) ||
          "UNKNOWN"
      };
    };


    // --------------------------------------------------
    // BED STATUS HELPER
    // --------------------------------------------------

    const getBedStatusDetails = (status) => {

      const statusDetails =
        getStatusDetails(status);

      // Additional fallback for known
      // bed statuses from your existing system.
      //
      // These values can be adjusted if your
      // STATUS constants use different numbers.

      if (
        statusDetails.name === "UNKNOWN"
      ) {

        const fallbackBedStatuses = {

          3: "VACANT",

          4: "RESERVED",

          5: "OCCUPIED"

        };

        return {

          number:
            statusDetails.number,

          name:
            fallbackBedStatuses[
              statusDetails.number
            ] || "UNKNOWN"

        };

      }

      return statusDetails;
    };


    // --------------------------------------------------
    // BOOKING STATUS HELPER
    // --------------------------------------------------

    const getBookingStatusDetails = (status) => {

      const statusDetails =
        getStatusDetails(status);

      if (
        statusDetails.name === "UNKNOWN"
      ) {

        const fallbackBookingStatuses = {

          3: "VACANT",

          4: "RESERVED",

          5: "OCCUPIED"

        };

        return {

          number:
            statusDetails.number,

          name:
            fallbackBookingStatuses[
              statusDetails.number
            ] || "UNKNOWN"

        };

      }

      return statusDetails;
    };


    // --------------------------------------------------
    // GUEST STATUS HELPER
    // --------------------------------------------------

    const getGuestStatusDetails = (status) => {

      const statusDetails =
        getStatusDetails(status);

      if (
        statusDetails.name === "UNKNOWN"
      ) {

        const fallbackGuestStatuses = {

          5: "ACTIVE"

        };

        return {

          number:
            statusDetails.number,

          name:
            fallbackGuestStatuses[
              statusDetails.number
            ] || "UNKNOWN"

        };

      }

      return statusDetails;
    };


    // --------------------------------------------------
    // Get Rooms → Beds
    // --------------------------------------------------
    const rooms = await prisma.dy_pg_room_info.findMany({
      where: {
        pg_info: pgId
      },
      orderBy: {
        id: "asc"
      },
      include: {
        dy_pg_bed_info: {
          orderBy: {
            id: "asc"
          }
        }
      }
    });


    // --------------------------------------------------
    // Get all bed IDs
    // --------------------------------------------------
    const bedIds = rooms.flatMap(room =>
      room.dy_pg_bed_info.map(bed => bed.id)
    );


    // --------------------------------------------------
    // Get current bookings for these beds
    // --------------------------------------------------
    const bookings = bedIds.length
      ? await prisma.dy_pg_bookings.findMany({
          where: {
            pg_id: pgId,
            bed_id: {
              in: bedIds
            },

            // Current / active bookings
            bkg_status: {
              notIn: [0, 3]
            }
          },
          orderBy: {
            id: "desc"
          },
          include: {
            dy_pg_guest_info: true
          }
        })
      : [];


    // --------------------------------------------------
    // Get user IDs from guests
    // --------------------------------------------------
    const userIds = bookings
      .map(booking =>
        booking.dy_pg_guest_info?.user_id
      )
      .filter(Boolean);


    // --------------------------------------------------
    // Get users
    // --------------------------------------------------
    const users = userIds.length
      ? await prisma.dy_user.findMany({
          where: {
            id: {
              in: userIds
            }
          }
        })
      : [];


    // --------------------------------------------------
    // Create user lookup
    // --------------------------------------------------
    const userMap = new Map(
      users.map(user => [user.id, user])
    );


    // --------------------------------------------------
    // Create booking lookup by bed
    // --------------------------------------------------
    const bookingMap = new Map();

    for (const booking of bookings) {

      if (
        !bookingMap.has(
          booking.bed_id
        )
      ) {

        bookingMap.set(
          booking.bed_id,
          booking
        );

      }

    }


    // --------------------------------------------------
    // Build Bed Map
    // --------------------------------------------------
    const roomData = rooms.map(room => {

      const beds =
        room.dy_pg_bed_info.map(bed => {

          const booking =
            bookingMap.get(
              bed.id
            );

          const guest =
            booking?.dy_pg_guest_info ||
            null;

          const user =
            guest?.user_id
              ? userMap.get(
                  guest.user_id
                ) || null
              : null;


          // ==================================================
          // BED STATUS
          // ==================================================

          const bedStatus =
            getBedStatusDetails(
              bed.bed_status
            );


          // ==================================================
          // BOOKING STATUS
          // ==================================================

          const bookingStatus =
            booking
              ? getBookingStatusDetails(
                  booking.bkg_status
                )
              : {
                  number: null,
                  name: null
                };


          // ==================================================
          // GUEST STATUS
          // ==================================================

          const guestStatus =
            guest
              ? getGuestStatusDetails(
                  guest.guest_status
                )
              : {
                  number: null,
                  name: null
                };


          // ==================================================
          // BED VIEW DETAILS
          // ==================================================

          const viewDetails = {

            // ------------------------------------------------
            // BED INFORMATION
            // ------------------------------------------------

            bedInfo: {

              ...bed,

              status: bedStatus

            },


            // ------------------------------------------------
            // ROOM INFORMATION
            // ------------------------------------------------

            roomInfo: {

              ...room,

              // Remove nested beds from roomInfo
              // because beds already exist separately.
              dy_pg_bed_info: undefined

            },


            // ------------------------------------------------
            // BOOKING INFORMATION
            // ------------------------------------------------

            bookingInfo: booking
              ? {

                  ...booking,

                  // Remove nested guest object
                  // because guestInfo is separately provided.
                  dy_pg_guest_info: undefined,

                  status:
                    bookingStatus

                }
              : null,


            // ------------------------------------------------
            // GUEST INFORMATION
            // ------------------------------------------------

            guestInfo: guest
              ? {

                  ...guest,

                  status:
                    guestStatus

                }
              : null,


            // ------------------------------------------------
            // USER INFORMATION
            // ------------------------------------------------

            userInfo: user
              ? {

                  ...user

                }
              : null,


            // ------------------------------------------------
            // STATUS SUMMARY
            // ------------------------------------------------

            status: {

              bed: bedStatus,

              booking:
                bookingStatus,

              guest:
                guestStatus

            }

          };


          // ==================================================
          // EXISTING RESPONSE
          // ==================================================

          return {

            bedId:
              bed.id,

            bedNumber:
              bed.bed_number,

            bedStatus:
              bed.bed_status,


            booking: booking
              ? {

                  bookingId:
                    booking.id,

                  bookingNo:
                    booking.bkg_no,

                  plannedCheckInDate:
                    booking.planned_check_in_date,

                  plannedCheckOutDate:
                    booking.planned_check_out_date,

                  actualCheckInDate:
                    booking.actual_check_in_date,

                  actualCheckOutDate:
                    booking.actual_check_out_date,

                  bookingStatus:
                    booking.bkg_status,

                  monthlyRent:
                    booking.monthly_rent,


                  guest: guest
                    ? {

                        guestId:
                          guest.id,

                        firstName:
                          guest.first_name,

                        lastName:
                          guest.last_name,

                        mobileNo:
                          guest.mobile_no,

                        guestStatus:
                          guest.guest_status,


                        user: user
                          ? {

                              userId:
                                user.id,

                              firstName:
                                user.first_name,

                              lastName:
                                user.last_name,

                              email:
                                user.email_id,

                              mobileNo:
                                user.mobile_no

                            }
                          : null

                      }
                    : null

                }
              : null,


            // ==================================================
            // NEW
            // ==================================================
            // Complete details for this bed.
            // ==================================================

            viewDetails

          };

        });


      // ======================================================
      // ROOM STATISTICS
      // ======================================================

      const roomTotalBeds =
        beds.length;


      const roomOccupiedBeds =
        beds.filter(
          bed =>
            bed.booking !== null ||
            String(
              bed.bedStatus
            ).toUpperCase() ===
              "OCCUPIED" ||
            getBedStatusDetails(
              bed.bedStatus
            ).name ===
              "Occupied"
        ).length;


      const roomVacantBeds =
        beds.filter(
          bed =>
            getBedStatusDetails(
              bed.bedStatus
            ).number ===
              STATUS.VACANT
        ).length;


      const roomReservedBeds =
        beds.filter(
          bed =>
            getBedStatusDetails(
              bed.bedStatus
            ).number ===
              STATUS.RESERVED
        ).length;


      const roomNoticeBeds =
        beds.filter(
          bed => {

            const status =
              getBedStatusDetails(
                bed.bedStatus
              ).number;

            return [

              STATUS.NOTICE_GIVEN,

              STATUS.NOTICE_ACCEPTED,

              STATUS.IN_NOTICE_PERIOD

            ].includes(status);

          }
        ).length;


      // ======================================================
      // RETURN ROOM
      // ======================================================

      return {

        roomId:
          room.id,

        roomName:
          room.room_name,

        floor:
          room.floor_info,

        roomType:
          room.room_type,

        bathroomType:
          room.bathroom_type,

        hasTv:
          room.has_tv,

        hasAc:
          room.has_ac,

        hasBalcony:
          room.has_balcony,


        // --------------------------------------------------
        // Existing beds
        // --------------------------------------------------

        beds,


        // --------------------------------------------------
        // NEW ROOM STATISTICS
        // --------------------------------------------------

        statistics: {

          totalBeds:
            roomTotalBeds,

          occupiedBeds:
            roomOccupiedBeds,

          vacantBeds:
            roomVacantBeds,

          reservedBeds:
            roomReservedBeds,

          noticeBeds:
            roomNoticeBeds,

          occupancyPercentage:
            roomTotalBeds > 0
              ? Number(
                  (
                    (
                      roomOccupiedBeds /
                      roomTotalBeds
                    ) * 100
                  ).toFixed(1)
                )
              : 0

        }

      };

    });


    // --------------------------------------------------
    // Summary
    // --------------------------------------------------

    const allBeds =
      roomData.flatMap(
        room => room.beds
      );


    const totalBeds =
      allBeds.length;


    const occupiedBeds =
      allBeds.filter(
        bed =>
          bed.booking !== null ||
          String(
            bed.bedStatus
          ).toUpperCase() ===
            "OCCUPIED"
      ).length;


    const vacantBeds =
      totalBeds -
      occupiedBeds;


    // --------------------------------------------------
    // RESERVED BEDS
    // --------------------------------------------------

    const reservedBeds =
      allBeds.filter(
        bed =>
          getBedStatusDetails(
            bed.bedStatus
          ).number ===
            STATUS.RESERVED
      ).length;


    // --------------------------------------------------
    // NOTICE BEDS
    // --------------------------------------------------

    const noticeBeds =
      allBeds.filter(
        bed => {

          const status =
            getBedStatusDetails(
              bed.bedStatus
            ).number;

          return [

            STATUS.NOTICE_GIVEN,

            STATUS.NOTICE_ACCEPTED,

            STATUS.IN_NOTICE_PERIOD

          ].includes(status);

        }
      ).length;


    // --------------------------------------------------
    // ROOM STATISTICS
    // --------------------------------------------------

    const totalRooms =
      roomData.length;


    const occupiedPercentage =
      totalBeds > 0
        ? Number(
            (
              (
                occupiedBeds /
                totalBeds
              ) * 100
            ).toFixed(1)
          )
        : 0;


    const vacantPercentage =
      totalBeds > 0
        ? Number(
            (
              (
                vacantBeds /
                totalBeds
              ) * 100
            ).toFixed(1)
          )
        : 0;


    const reservedPercentage =
      totalBeds > 0
        ? Number(
            (
              (
                reservedBeds /
                totalBeds
              ) * 100
            ).toFixed(1)
          )
        : 0;


    const noticePercentage =
      totalBeds > 0
        ? Number(
            (
              (
                noticeBeds /
                totalBeds
              ) * 100
            ).toFixed(1)
          )
        : 0;


    // --------------------------------------------------
    // Final response
    // --------------------------------------------------

    return res.status(200).json({

      success: true,

      message:
        "Bed map fetched successfully",

      data: {

        pgId,


        // ==================================================
        // SUMMARY
        // ==================================================

        summary: {

          totalRooms,

          totalBeds,

          occupiedBeds,

          vacantBeds,

          reservedBeds,

          noticeBeds,


          percentages: {

            occupied:
              occupiedPercentage,

            vacant:
              vacantPercentage,

            reserved:
              reservedPercentage,

            notice:
              noticePercentage

          }

        },


        // ==================================================
        // STATUS STATISTICS
        // ==================================================

        statusStatistics: {

          beds: {

            total: totalBeds,

            occupied: {

              number:
                STATUS.OCCUPIED,

              name:
                "Occupied",

              count:
                occupiedBeds,

              percentage:
                occupiedPercentage

            },

            vacant: {

              number:
                STATUS.VACANT,

              name:
                "Vacant",

              count:
                vacantBeds,

              percentage:
                vacantPercentage

            },

            reserved: {

              number:
                STATUS.RESERVED,

              name:
                "Reserved",

              count:
                reservedBeds,

              percentage:
                reservedPercentage

            },

            notice: {

              numbers: [

                STATUS.NOTICE_GIVEN,

                STATUS.NOTICE_ACCEPTED,

                STATUS.IN_NOTICE_PERIOD

              ],

              name:
                "Notice",

              count:
                noticeBeds,

              percentage:
                noticePercentage

            }

          }

        },


        // ==================================================
        // ROOMS
        // ==================================================

        rooms:
          roomData

      }

    });

  } catch (error) {

    console.error(
      "getBedMap error:",
      error
    );

    return res.status(500).json({

      success: false,

      message:
        "Failed to fetch bed map",

      error:
        error.message

    });

  }
};




export const getBedMap = async (req, res) => {
  try {
    const pgId = Number(req.query.pgId);

    // --------------------------------------------------
    // Validate pgId
    // --------------------------------------------------

    if (!Number.isInteger(pgId) || pgId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid pgId is required"
      });
    }


    // ==================================================
    // STATUS NAME MAP
    // ==================================================

    const statusMap = new Map();

    Object.entries(STATUS || {}).forEach(
      ([key, value]) => {

        if (
          typeof value === "number" ||
          (!isNaN(Number(value)) &&
            value !== "")
        ) {

          const numericValue =
            Number(value);

          if (
            !statusMap.has(
              numericValue
            )
          ) {

            statusMap.set(
              numericValue,

              key
                .replace(/_/g, " ")
                .toLowerCase()
                .replace(
                  /\b\w/g,
                  char =>
                    char.toUpperCase()
                )
            );

          }

        }

      }
    );


    // ==================================================
    // ADD COMMON FALLBACK STATUS NAMES
    // ==================================================

    const fallbackStatusMap = {

      1: "Active",

      3: "Vacant",

      4: "Reserved",

      5: "Occupied"

    };


    // ==================================================
    // STATUS HELPER
    // ==================================================

    const getStatusDetails = (
      status
    ) => {

      if (
        status === null ||
        status === undefined
      ) {

        return {

          number: null,

          name: null

        };

      }


      const numericStatus =
        Number(status);


      return {

        number:
          numericStatus,

        name:
          statusMap.get(
            numericStatus
          ) ||
          fallbackStatusMap[
            numericStatus
          ] ||
          "UNKNOWN"

      };

    };


    // ==================================================
    // BED STATUS
    // ==================================================

    const getBedStatusDetails = (
      status
    ) => {

      const statusDetails =
        getStatusDetails(
          status
        );


      const fallbackBedStatuses = {

        3: "VACANT",

        4: "RESERVED",

        5: "OCCUPIED"

      };


      if (
        statusDetails.name ===
        "UNKNOWN"
      ) {

        return {

          number:
            statusDetails.number,

          name:
            fallbackBedStatuses[
              statusDetails.number
            ] ||
            "UNKNOWN"

        };

      }


      return statusDetails;

    };


    // ==================================================
    // BOOKING STATUS
    // ==================================================

    const getBookingStatusDetails = (
      status
    ) => {

      const statusDetails =
        getStatusDetails(
          status
        );


      const fallbackBookingStatuses = {

        3: "VACANT",

        4: "RESERVED",

        5: "OCCUPIED"

      };


      if (
        statusDetails.name ===
        "UNKNOWN"
      ) {

        return {

          number:
            statusDetails.number,

          name:
            fallbackBookingStatuses[
              statusDetails.number
            ] ||
            "UNKNOWN"

        };

      }


      return statusDetails;

    };


    // ==================================================
    // GUEST STATUS
    // ==================================================

    const getGuestStatusDetails = (
      status
    ) => {

      const statusDetails =
        getStatusDetails(
          status
        );


      const fallbackGuestStatuses = {

        5: "ACTIVE"

      };


      if (
        statusDetails.name ===
        "UNKNOWN"
      ) {

        return {

          number:
            statusDetails.number,

          name:
            fallbackGuestStatuses[
              statusDetails.number
            ] ||
            "UNKNOWN"

        };

      }


      return statusDetails;

    };


    // ==================================================
    // AMENITY STATUS
    // ==================================================
    //
    // st_pg_amns.rstatus:
    //
    // 1 = Active
    // 0 = Inactive
    //
    // ==================================================

    const getAmenityStatusDetails = (
      status
    ) => {

      if (
        status === null ||
        status === undefined
      ) {

        return {

          number: null,

          name: null

        };

      }


      const numericStatus =
        Number(status);


      return {

        number:
          numericStatus,

        name:
          numericStatus === 1
            ? "Active"
            : numericStatus === 0
              ? "Inactive"
              : "UNKNOWN"

      };

    };


    // ==================================================
    // GET ROOMS
    // ==================================================

    const rooms =
      await prisma.dy_pg_room_info.findMany({

        where: {

          pg_info:
            pgId

        },

        orderBy: {

          id:
            "asc"

        },

        include: {

          dy_pg_bed_info: {

            orderBy: {

              id:
                "asc"

            }

          }

        }

      });


    // ==================================================
    // GET BED IDS
    // ==================================================

    const bedIds =
      rooms.flatMap(
        room =>
          room.dy_pg_bed_info.map(
            bed =>
              bed.id
          )
      );


    // ==================================================
    // GET CURRENT BOOKINGS
    // ==================================================

    const bookings =
      bedIds.length

        ? await prisma.dy_pg_bookings.findMany({

            where: {

              pg_id:
                pgId,

              bed_id: {

                in:
                  bedIds

              },

              bkg_status: {

                notIn: [

                  0,

                  3

                ]

              }

            },

            orderBy: {

              id:
                "desc"

            },

            include: {

              dy_pg_guest_info:
                true

            }

          })

        : [];


    // ==================================================
    // GET USER IDS
    // ==================================================

    const userIds =
      bookings
        .map(
          booking =>
            booking
              .dy_pg_guest_info
              ?.user_id
        )
        .filter(
          Boolean
        );


    // ==================================================
    // GET USERS
    // ==================================================

    const users =
      userIds.length

        ? await prisma.dy_user.findMany({

            where: {

              id: {

                in:
                  userIds

              }

            }

          })

        : [];


    // ==================================================
    // USER MAP
    // ==================================================

    const userMap =
      new Map(

        users.map(
          user => [

            user.id,

            user

          ]
        )

      );


    // ==================================================
    // BOOKING MAP
    // ==================================================

    const bookingMap =
      new Map();


    for (
      const booking
      of bookings
    ) {

      if (
        !bookingMap.has(
          booking.bed_id
        )
      ) {

        bookingMap.set(

          booking.bed_id,

          booking

        );

      }

    }


    // ==================================================
    // GET PG AMENITY MAP
    // ==================================================
    //
    // dy_pg_amns_map
    //
    // pg_info -> PG ID
    // amns_info -> st_pg_amns.id
    //
    // Example:
    //
    // {
    //   id: 2,
    //   pg_info: 9,
    //   amns_info: 1
    // }
    //
    // st_pg_amns:
    //
    // id: 1
    // amenity_name: WashingMachine
    //
    // ==================================================

    const amenityMaps =
      await prisma.dy_pg_amns_map.findMany({

        where: {

          pg_info:
            pgId

        },

        orderBy: {

          id:
            "asc"

        }

      });


    // ==================================================
    // AMENITY IDS
    // ==================================================

    const amenityIds =
      amenityMaps
        .map(
          item =>
            item.amns_info
        )
        .filter(
          value =>
            value !== null &&
            value !== undefined
        );


    // ==================================================
    // GET AMENITY MASTER DATA
    // ==================================================

    const amenities =
      amenityIds.length

        ? await prisma.st_pg_amns.findMany({

            where: {

              id: {

                in:
                  amenityIds

              }

            },

            orderBy: {

              id:
                "asc"

            }

          })

        : [];


    // ==================================================
    // AMENITY MAP
    // ==================================================

    const amenityMasterMap =
      new Map(

        amenities.map(
          amenity => [

            amenity.id,

            amenity

          ]
        )

      );


    // ==================================================
    // FINAL AMENITIES
    // ==================================================

    const pgAmenities =
      amenityMaps.map(
        amenityMap => {

          const amenity =
            amenityMasterMap.get(
              amenityMap.amns_info
            );


          return {

            // ------------------------------------------
            // dy_pg_amns_map
            // ------------------------------------------

            mapId:
              amenityMap.id,

            pgInfo:
              amenityMap.pg_info,

            amnsInfo:
              amenityMap.amns_info,


            // ------------------------------------------
            // st_pg_amns
            // ------------------------------------------

            amenityName:
              amenity?.amenity_name ||
              null,

            amenityStatus:
              amenity?.rstatus ??
              null,

            status:
              getAmenityStatusDetails(
                amenity?.rstatus
              )

          };

        }

      );


    // ==================================================
    // BUILD ROOM DATA
    // ==================================================

    const roomData =
      rooms.map(
        room => {

          const beds =
            room.dy_pg_bed_info.map(
              bed => {

                const booking =
                  bookingMap.get(
                    bed.id
                  );


                const guest =
                  booking
                    ?.dy_pg_guest_info ||
                  null;


                const user =
                  guest?.user_id

                    ? userMap.get(
                        guest.user_id
                      ) ||
                      null

                    : null;


                // ======================================
                // BED STATUS
                // ======================================

                const bedStatus =
                  getBedStatusDetails(
                    bed.bed_status
                  );


                // ======================================
                // BOOKING STATUS
                // ======================================

                const bookingStatus =
                  booking

                    ? getBookingStatusDetails(
                        booking.bkg_status
                      )

                    : {

                        number:
                          null,

                        name:
                          null

                      };


                // ======================================
                // GUEST STATUS
                // ======================================

                const guestStatus =
                  guest

                    ? getGuestStatusDetails(
                        guest.guest_status
                      )

                    : {

                        number:
                          null,

                        name:
                          null

                      };


                // ======================================
                // VIEW DETAILS
                // ======================================

                const viewDetails = {

                  // ------------------------------------
                  // BED INFORMATION
                  // ------------------------------------

                  bedInfo: {

                    ...bed,

                    status:
                      bedStatus

                  },


                  // ------------------------------------
                  // ROOM INFORMATION
                  // ------------------------------------

                  roomInfo: {

                    ...room,

                    dy_pg_bed_info:
                      undefined

                  },


                  // ------------------------------------
                  // BOOKING INFORMATION
                  // ------------------------------------

                  bookingInfo:

                    booking

                      ? {

                          ...booking,

                          dy_pg_guest_info:
                            undefined,

                          status:
                            bookingStatus

                        }

                      : null,


                  // ------------------------------------
                  // GUEST INFORMATION
                  // ------------------------------------

                  guestInfo:

                    guest

                      ? {

                          ...guest,

                          status:
                            guestStatus

                        }

                      : null,


                  // ------------------------------------
                  // USER INFORMATION
                  // ------------------------------------

                  userInfo:

                    user

                      ? {

                          ...user

                        }

                      : null,


                  // ------------------------------------
                  // AMENITIES
                  // ------------------------------------
                  //
                  // NEW
                  //
                  // Complete PG amenity mapping.
                  //
                  // Example:
                  //
                  // amnsInfo: 1
                  // amenityName: WashingMachine
                  //
                  // ------------------------------------

                  amenities:
                    pgAmenities,


                  // ------------------------------------
                  // STATUS SUMMARY
                  // ------------------------------------

                  status: {

                    bed:
                      bedStatus,

                    booking:
                      bookingStatus,

                    guest:
                      guestStatus

                  }

                };


                // ======================================
                // EXISTING BED RESPONSE
                // ======================================

                return {

                  bedId:
                    bed.id,

                  bedNumber:
                    bed.bed_number,

                  bedStatus:
                    bed.bed_status,


                  booking:

                    booking

                      ? {

                          bookingId:
                            booking.id,

                          bookingNo:
                            booking.bkg_no,

                          plannedCheckInDate:
                            booking
                              .planned_check_in_date,

                          plannedCheckOutDate:
                            booking
                              .planned_check_out_date,

                          actualCheckInDate:
                            booking
                              .actual_check_in_date,

                          actualCheckOutDate:
                            booking
                              .actual_check_out_date,

                          bookingStatus:
                            booking.bkg_status,

                          monthlyRent:
                            booking.monthly_rent,


                          guest:

                            guest

                              ? {

                                  guestId:
                                    guest.id,

                                  firstName:
                                    guest.first_name,

                                  lastName:
                                    guest.last_name,

                                  mobileNo:
                                    guest.mobile_no,

                                  guestStatus:
                                    guest.guest_status,


                                  user:

                                    user

                                      ? {

                                          userId:
                                            user.id,

                                          firstName:
                                            user.first_name,

                                          lastName:
                                            user.last_name,

                                          email:
                                            user.email_id,

                                          mobileNo:
                                            user.mobile_no

                                        }

                                      : null

                                }

                              : null

                        }

                      : null,


                  // ====================================
                  // NEW COMPLETE DETAILS
                  // ====================================

                  viewDetails

                };

              }

            );


          // =================================================
          // ROOM STATISTICS
          // =================================================

          const roomTotalBeds =
            beds.length;


          const roomOccupiedBeds =
            beds.filter(
              bed =>

                bed.booking !== null ||

                String(
                  bed.bedStatus
                ).toUpperCase() ===
                  "OCCUPIED" ||

                getBedStatusDetails(
                  bed.bedStatus
                ).name ===
                  "Occupied"

            ).length;


          const roomVacantBeds =
            beds.filter(
              bed =>

                getBedStatusDetails(
                  bed.bedStatus
                ).number ===
                  STATUS.VACANT

            ).length;


          const roomReservedBeds =
            beds.filter(
              bed =>

                getBedStatusDetails(
                  bed.bedStatus
                ).number ===
                  STATUS.RESERVED

            ).length;


          const roomNoticeBeds =
            beds.filter(
              bed => {

                const status =
                  getBedStatusDetails(
                    bed.bedStatus
                  ).number;


                return [

                  STATUS.NOTICE_GIVEN,

                  STATUS.NOTICE_ACCEPTED,

                  STATUS.IN_NOTICE_PERIOD

                ].includes(
                  status
                );

              }

            ).length;


          // =================================================
          // ROOM RESPONSE
          // =================================================

          return {

            roomId:
              room.id,

            roomName:
              room.room_name,

            floor:
              room.floor_info,

            roomType:
              room.room_type,

            bathroomType:
              room.bathroom_type,

            hasTv:
              room.has_tv,

            hasAc:
              room.has_ac,

            hasBalcony:
              room.has_balcony,


            beds,


            // =============================================
            // ROOM STATISTICS
            // =============================================

            statistics: {

              totalBeds:
                roomTotalBeds,

              occupiedBeds:
                roomOccupiedBeds,

              vacantBeds:
                roomVacantBeds,

              reservedBeds:
                roomReservedBeds,

              noticeBeds:
                roomNoticeBeds,

              occupancyPercentage:

                roomTotalBeds > 0

                  ? Number(

                      (

                        (
                          roomOccupiedBeds /
                          roomTotalBeds
                        ) *
                        100

                      ).toFixed(1)

                    )

                  : 0

            }

          };

        }

      );


    // ==================================================
    // ALL BEDS
    // ==================================================

    const allBeds =
      roomData.flatMap(
        room =>
          room.beds
      );


    const totalBeds =
      allBeds.length;


    // ==================================================
    // OCCUPIED
    // ==================================================

    const occupiedBeds =
      allBeds.filter(

        bed =>

          bed.booking !== null ||

          String(
            bed.bedStatus
          ).toUpperCase() ===
            "OCCUPIED"

      ).length;


    // ==================================================
    // VACANT
    // ==================================================

    const vacantBeds =
      totalBeds -
      occupiedBeds;


    // ==================================================
    // RESERVED
    // ==================================================

    const reservedBeds =
      allBeds.filter(

        bed =>

          getBedStatusDetails(
            bed.bedStatus
          ).number ===
            STATUS.RESERVED

      ).length;


    // ==================================================
    // NOTICE
    // ==================================================

    const noticeBeds =
      allBeds.filter(
        bed => {

          const status =
            getBedStatusDetails(
              bed.bedStatus
            ).number;


          return [

            STATUS.NOTICE_GIVEN,

            STATUS.NOTICE_ACCEPTED,

            STATUS.IN_NOTICE_PERIOD

          ].includes(
            status
          );

        }

      ).length;


    // ==================================================
    // ROOM STATISTICS
    // ==================================================

    const totalRooms =
      roomData.length;


    const occupiedPercentage =
      totalBeds > 0

        ? Number(

            (

              (
                occupiedBeds /
                totalBeds
              ) *
              100

            ).toFixed(1)

          )

        : 0;


    const vacantPercentage =
      totalBeds > 0

        ? Number(

            (

              (
                vacantBeds /
                totalBeds
              ) *
              100

            ).toFixed(1)

          )

        : 0;


    const reservedPercentage =
      totalBeds > 0

        ? Number(

            (

              (
                reservedBeds /
                totalBeds
              ) *
              100

            ).toFixed(1)

          )

        : 0;


    const noticePercentage =
      totalBeds > 0

        ? Number(

            (

              (
                noticeBeds /
                totalBeds
              ) *
              100

            ).toFixed(1)

          )

        : 0;


    // ==================================================
    // AMENITY STATISTICS
    // ==================================================

    const totalAmenities =
      pgAmenities.length;


    const activeAmenities =
      pgAmenities.filter(

        amenity =>

          amenity.status?.number ===
            1

      ).length;


    const inactiveAmenities =
      pgAmenities.filter(

        amenity =>

          amenity.status?.number ===
            0

      ).length;


    // ==================================================
    // FINAL RESPONSE
    // ==================================================

    return res.status(200).json({

      success:
        true,

      message:
        "Bed map fetched successfully",

      data: {

        pgId,


        // =================================================
        // SUMMARY
        // =================================================

        summary: {

          totalRooms,

          totalBeds,

          occupiedBeds,

          vacantBeds,

          reservedBeds,

          noticeBeds,


          percentages: {

            occupied:
              occupiedPercentage,

            vacant:
              vacantPercentage,

            reserved:
              reservedPercentage,

            notice:
              noticePercentage

          }

        },


        // =================================================
        // STATUS STATISTICS
        // =================================================

        statusStatistics: {

          beds: {

            total:
              totalBeds,


            occupied: {

              number:
                STATUS.OCCUPIED,

              name:
                "Occupied",

              count:
                occupiedBeds,

              percentage:
                occupiedPercentage

            },


            vacant: {

              number:
                STATUS.VACANT,

              name:
                "Vacant",

              count:
                vacantBeds,

              percentage:
                vacantPercentage

            },


            reserved: {

              number:
                STATUS.RESERVED,

              name:
                "Reserved",

              count:
                reservedBeds,

              percentage:
                reservedPercentage

            },


            notice: {

              numbers: [

                STATUS.NOTICE_GIVEN,

                STATUS.NOTICE_ACCEPTED,

                STATUS.IN_NOTICE_PERIOD

              ],

              name:
                "Notice",

              count:
                noticeBeds,

              percentage:
                noticePercentage

            }

          },


          // =============================================
          // AMENITY STATISTICS
          // =============================================

          amenities: {

            total:
              totalAmenities,

            active: {

              number:
                1,

              name:
                "Active",

              count:
                activeAmenities

            },

            inactive: {

              number:
                0,

              name:
                "Inactive",

              count:
                inactiveAmenities

            }

          }

        },


        // =================================================
        // PG AMENITIES
        // =================================================
        //
        // This is also available at top level so frontend
        // does not need to read every bed to get PG amenities.
        //
        // =================================================

        amenities:
          pgAmenities,


        // =================================================
        // ROOMS
        // =================================================

        rooms:
          roomData

      }

    });

  }

  catch (error) {

    console.error(
      "getBedMap error:",
      error
    );


    return res.status(500).json({

      success:
        false,

      message:
        "Failed to fetch bed map",

      error:
        error.message

    });

  }
};


/* ============================================================
   RESIDENT HAPPINESS AGGREGATE services
============================================================ */

/* ============================================================
   RESIDENT HAPPINESS AGGREGATE
   GET /api/pg/resident-happiness/aggregate?pgId=9
============================================================ */

/* ============================================================
   RESIDENT HAPPINESS AGGREGATE FUNCTION
   Prisma only
   No raw SQL
============================================================ */

/* ============================================================
   ISSUES + RESIDENT HAPPINESS AGGREGATE
   Prisma only
   No raw SQL
============================================================ */



/* ============================================================
/* ============================================================
   HELPER: FORMAT DATE
   YYYY-MM-DD
============================================================ */

const getDatabaseDate = (value) => {
  if (!value) {
    return null;
  }

  // If Prisma returns a Date object,
  // format it using local date components.
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  // If value is a string
  const valueString = String(value);

  // MySQL DATETIME:
  // 2026-09-02 00:25:28
  if (/^\d{4}-\d{2}-\d{2}/.test(valueString)) {
    return valueString.substring(0, 10);
  }

  return null;
};

const formatDate = (date) => {
  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
};


/* ============================================================
   HELPER: GET DATABASE DATE

   IMPORTANT:
   Do NOT use new Date() for MySQL DATETIME date extraction.

   Example:

   2026-09-02 00:25:28
            ↓
   2026-09-02
============================================================ */




/* ============================================================
   HELPER: START OF DAY
============================================================ */

const startOfDay = (date = new Date()) => {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
};


/* ============================================================
   HELPER: NEXT DAY
============================================================ */

const startOfNextDay = (date = new Date()) => {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + 1
  );
};


/* ============================================================
   HELPER: CALCULATE SATISFACTION TREND

   SOURCE:
   dy_pg_srv_reqs

   RATING:
   feedback

   DATE:
   request_eta_date

   Example:

   2026-09-02 00:25:28 → feedback 5
   2026-08-25 00:25:28 → feedback 4
   2026-09-01 00:25:28 → feedback 3

   Result:

   2026-08-25 → 4
   2026-09-01 → 3
   2026-09-02 → 5
============================================================ */

const calculateSatisfactionTrend = (
  serviceRequests,
  numberOfDays
) => {

  const today = startOfDay();

  const startDate = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - (numberOfDays - 1)
  );

  const trend = [];


  for (let i = 0; i < numberOfDays; i++) {

    const currentDate = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate() + i
    );


    const dateString = formatDate(
      currentDate
    );


    /* --------------------------------------------------------
       Get feedback based on request_eta_date
    -------------------------------------------------------- */

    const feedbacks = serviceRequests
      .filter((request) => {

        /* ----------------------------------------------------
           Feedback must exist
        ---------------------------------------------------- */

        if (
          request.feedback === null ||
          request.feedback === undefined
        ) {
          return false;
        }


        /* ----------------------------------------------------
           Convert feedback to number
        ---------------------------------------------------- */

        const feedback = Number(
          request.feedback
        );


        /* ----------------------------------------------------
           Only ratings 1 - 5 are valid
        ---------------------------------------------------- */

        if (
          !Number.isFinite(feedback) ||
          feedback < 1 ||
          feedback > 5
        ) {
          return false;
        }


        /* ----------------------------------------------------
           request_eta_date must exist
        ---------------------------------------------------- */

        if (
          !request.request_eta_date
        ) {
          return false;
        }


        /* ----------------------------------------------------
           IMPORTANT:

           Use database date directly.

           Example:

           2026-09-02 00:25:28
                   ↓
           2026-09-02
        ---------------------------------------------------- */

        const requestEtaDate =
          getDatabaseDate(
            request.request_eta_date
          );


        return (
          requestEtaDate ===
          dateString
        );
      })
      .map((request) =>
        Number(request.feedback)
      );


    /* --------------------------------------------------------
       Number of responses
    -------------------------------------------------------- */

    const responses =
      feedbacks.length;


    /* --------------------------------------------------------
       Average rating
    -------------------------------------------------------- */

    let avgRating = 0;


    if (responses > 0) {

      const totalRating =
        feedbacks.reduce(
          (sum, rating) =>
            sum + rating,
          0
        );


      avgRating = Number(
        (
          totalRating /
          responses
        ).toFixed(1)
      );
    }


    /* --------------------------------------------------------
       Add result
    -------------------------------------------------------- */

    trend.push({

      date: dateString,

      avgRating,

      responses

    });
  }


  return trend;
};


/* ============================================================
   MAIN AGGREGATE FUNCTION

   IMPORTANT:
   This function receives ONLY pgId.

   DO NOT USE:
   req
   res
============================================================ */

export const getIssuesAndResidentHappinessAggregate =
  async (pgId) => {

    try {

      /* ======================================================
         1. VALIDATE pgId
      ====================================================== */

      const numericPgId =
        Number(pgId);


      if (
        !Number.isInteger(numericPgId) ||
        numericPgId <= 0
      ) {

        throw new Error(
          "Valid pgId is required"
        );
      }


      /* ======================================================
         2. TODAY
      ====================================================== */

      const now = new Date();

      const todayStart =
        startOfDay(now);

      const tomorrowStart =
        startOfNextDay(now);


      /* ======================================================
         3. STATUS IDs

         11 = TicketRaised
         12 = TicketInProgress
         13 = TicketResolved
      ====================================================== */

      const TICKET_RAISED = 11;

      const TICKET_IN_PROGRESS = 12;

      const TICKET_RESOLVED = 13;


      /* ======================================================
         4. GET SERVICE REQUESTS

         SOURCE:
         dy_pg_srv_reqs

         IMPORTANT FIELDS:

         feedback
         request_create_date
         request_eta_date
         service_status
      ====================================================== */

      const serviceRequests =
        await prisma.dy_pg_srv_reqs.findMany({

          where: {
            pg_id: numericPgId
          },

          select: {

            id: true,

            request_create_date: true,

            request_eta_date: true,

            SLA: true,

            feedback: true,

            feedback_summary: true,

            service_status: true

          },

          orderBy: {
            request_create_date: "asc"
          }

        });


      /* ======================================================
         5. ALL
      ====================================================== */

      const all =
        serviceRequests.length;


      /* ======================================================
         6. OPEN

         11 = TicketRaised
         12 = TicketInProgress
      ====================================================== */

      const openRequests =
        serviceRequests.filter(
          (request) =>
            request.service_status ===
              TICKET_RAISED ||

            request.service_status ===
              TICKET_IN_PROGRESS
        );


      const open =
        openRequests.length;


      /* ======================================================
         7. IN PROGRESS
      ====================================================== */

      const inProgress =
        serviceRequests.filter(
          (request) =>
            request.service_status ===
            TICKET_IN_PROGRESS
        ).length;


      /* ======================================================
         8. RESOLVED
      ====================================================== */

      const resolvedRequests =
        serviceRequests.filter(
          (request) =>
            request.service_status ===
            TICKET_RESOLVED
        );


      const resolved =
        resolvedRequests.length;


      /* ======================================================
         9. OVERDUE

         ETA DATE < TODAY = OVERDUE

         ETA TODAY = NOT OVERDUE
      ====================================================== */

      const overdueRequests =
        openRequests.filter(
          (request) => {

            if (
              !request.request_eta_date
            ) {
              return false;
            }


            const etaDatabaseDate =
              getDatabaseDate(
                request.request_eta_date
              );


            if (!etaDatabaseDate) {
              return false;
            }


            const todayDatabaseDate =
              formatDate(todayStart);


            return (
              etaDatabaseDate <
              todayDatabaseDate
            );
          }
        );


      const overdue =
        overdueRequests.length;


      /* ======================================================
         10. HIGH PRIORITY

         dy_pg_srv_reqs does not have
         a priority field.

         Therefore:

         highPriority = 0
      ====================================================== */

      const highPriority = 0;


      /* ======================================================
         11. RESOLVED TODAY

         There is no resolved_date.

         Therefore request_eta_date is
         used as existing proxy.

         Resolved + ETA today
         = resolvedToday
      ====================================================== */

      const todayDatabaseDate =
        formatDate(todayStart);


      const resolvedToday =
        resolvedRequests.filter(
          (request) => {

            if (
              !request.request_eta_date
            ) {
              return false;
            }


            const etaDatabaseDate =
              getDatabaseDate(
                request.request_eta_date
              );


            return (
              etaDatabaseDate ===
              todayDatabaseDate
            );
          }
        ).length;


      /* ======================================================
         12. RESIDENT HAPPINESS

         SOURCE:

         dy_pg_srv_reqs.feedback

         Valid:

         1
         2
         3
         4
         5
      ====================================================== */

      const validFeedbacks =
        serviceRequests
          .map((request) =>
            Number(request.feedback)
          )
          .filter(
            (feedback) =>
              Number.isFinite(feedback) &&
              feedback >= 1 &&
              feedback <= 5
          );


      /* ======================================================
         13. AVG RATING
      ====================================================== */

      let avgRating = 0;


      if (
        validFeedbacks.length > 0
      ) {

        const totalFeedback =
          validFeedbacks.reduce(
            (sum, feedback) =>
              sum + feedback,
            0
          );


        avgRating = Number(
          (
            totalFeedback /
            validFeedbacks.length
          ).toFixed(1)
        );
      }


      /* ======================================================
         14. RESOLVED THIS WEEK

         request_eta_date is used as proxy
      ====================================================== */

      const dayOfWeek =
        todayStart.getDay();


      const weekStart =
        new Date(
          todayStart.getFullYear(),
          todayStart.getMonth(),
          todayStart.getDate() -
            dayOfWeek
        );


      const weekEnd =
        new Date(
          weekStart.getFullYear(),
          weekStart.getMonth(),
          weekStart.getDate() + 7
        );


      const resolvedThisWeek =
        resolvedRequests.filter(
          (request) => {

            if (
              !request.request_eta_date
            ) {
              return false;
            }


            const etaDatabaseDate =
              getDatabaseDate(
                request.request_eta_date
              );


            if (!etaDatabaseDate) {
              return false;
            }


            const etaDate =
              new Date(
                `${etaDatabaseDate}T00:00:00`
              );


            return (
              etaDate >= weekStart &&
              etaDate < weekEnd
            );
          }
        ).length;


      /* ======================================================
         15. SATISFACTION TREND

         SOURCE:
         dy_pg_srv_reqs.feedback

         DATE:
         dy_pg_srv_reqs.request_eta_date
      ====================================================== */

      const satisfactionTrend = {

        last7Days:
          calculateSatisfactionTrend(
            serviceRequests,
            7
          ),

        last14Days:
          calculateSatisfactionTrend(
            serviceRequests,
            14
          ),

        last28Days:
          calculateSatisfactionTrend(
            serviceRequests,
            28
          )

      };


      /* ======================================================
         16. RETURN DATA
      ====================================================== */

      return {

        issues: {

          summary: {

            open,

            overdue,

            highPriority,

            resolvedToday

          },

          counts: {

            all,

            open,

            inProgress,

            resolved

          }

        },


        residentHappiness: {

          summary: {

            avgRating,

            resolvedThisWeek

          },

          satisfactionTrend

        }

      };


    } catch (error) {

      console.error(
        "Issues and Resident Happiness aggregate calculation error:",
        error
      );

      throw error;
    }
  };


/* ============================================================
   HTTP CONTROLLER
============================================================ */

export const getIssuesAndResidentHappiness =
  async (req, res) => {

    try {

      /* ======================================================
         1. GET pgId
      ====================================================== */

      const pgId =
        Number(req.query.pgId);


      /* ======================================================
         2. VALIDATE pgId
      ====================================================== */

      if (
        !Number.isInteger(pgId) ||
        pgId <= 0
      ) {

        return res.status(400).json({

          success: false,

          message:
            "Valid pgId is required"

        });
      }


      /* ======================================================
         3. CALL AGGREGATE
      ====================================================== */

      const data =
        await getIssuesAndResidentHappinessAggregate(
          pgId
        );


      /* ======================================================
         4. RESPONSE
      ====================================================== */

      return res.status(200).json({

        success: true,

        message:
          "Issues and Resident Happiness aggregates fetched successfully",

        data

      });


    } catch (error) {

      console.error(
        "Issues and Resident Happiness controller error:",
        error
      );


      return res.status(500).json({

        success: false,

        message:
          "Failed to fetch Issues and Resident Happiness aggregates",

        error: error.message

      });
    }
  };
  
export const getServiceRequestDetails = async (req, res) => {
  try {

    // ==========================================================
    // VALIDATE PG ID
    // ==========================================================

    const pgId = Number(req.query.pgId);

    if (
      !Number.isInteger(pgId) ||
      pgId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid pgId is required"
      });
    }

    // ==========================================================
    // CALCULATE OVERDUE DAYS
    //
    // request_eta_date -> current date
    //
    // Example:
    // ETA       = 2026-08-25
    // Today     = 2026-09-01
    // overdue   = 7
    //
    // If ETA is today/future:
    // overdueDays = 0
    // ==========================================================

    const getOverdueDays = (etaDate) => {

      // No ETA
      if (!etaDate) {
        return 0;
      }

      const eta = new Date(etaDate);

      // Invalid date
      if (Number.isNaN(eta.getTime())) {
        return 0;
      }

      // Current date
      const today = new Date();

      // Start of today
      const todayStart = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      );

      // Start of ETA date
      const etaStart = new Date(
        eta.getFullYear(),
        eta.getMonth(),
        eta.getDate()
      );

      // --------------------------------------------------------
      // ETA is today or future
      // --------------------------------------------------------

      if (etaStart >= todayStart) {
        return 0;
      }

      // --------------------------------------------------------
      // Difference
      // --------------------------------------------------------

      const difference =
        todayStart.getTime() -
        etaStart.getTime();

      // --------------------------------------------------------
      // Milliseconds -> days
      // --------------------------------------------------------

      return Math.floor(
        difference /
        (1000 * 60 * 60 * 24)
      );
    };

    // ==========================================================
    // 1. GET SERVICE REQUESTS
    // ==========================================================

    const serviceRequests =
      await prisma.dy_pg_srv_reqs.findMany({

        where: {
          pg_id: pgId
        },

        select: {

          // Service request ID
          id: true,

          // User who created/requested the service
          requestor_info: true,

          // User assigned to the service request
          request_assigned_to: true,

          // Service information
          service_title: true,
          service_description: true,

          // SLA
          SLA: true,

          // Feedback
          feedback: true,

          // Status
          service_status: true,
          feedback_summary:true,

          // PG
          pg_id: true,

          // Required for overdueDays
          request_eta_date: true
        },

        orderBy: {
          id: "desc"
        }
      });

    // ==========================================================
    // 2. COLLECT BOTH USER IDS
    //
    // requestor_info
    //        ↓
    //      dy_user.id
    //
    // request_assigned_to
    //        ↓
    //      dy_user.id
    // ==========================================================

    const userIds = [
      ...new Set(

        serviceRequests

          .flatMap(
            (request) => [

              Number(
                request.requestor_info
              ),

              Number(
                request.request_assigned_to
              )
            ]
          )

          .filter(
            (id) =>
              Number.isInteger(id) &&
              id > 0
          )
      )
    ];

    // ==========================================================
    // 3. GET USERS FROM dy_user
    // ==========================================================

    let users = [];

    if (userIds.length > 0) {

      users =
        await prisma.dy_user.findMany({

          where: {

            id: {
              in: userIds
            }
          },

          select: {

            id: true,

            first_name: true,

            last_name: true
          }
        });
    }

    // ==========================================================
    // 4. CREATE USER MAP
    // ==========================================================

    const userMap =
      new Map(

        users.map(
          (user) => [

            Number(
              user.id
            ),

            user
          ]
        )
      );

    // ==========================================================
    // 5. GET GUEST INFORMATION
    //
    // dy_user.id
    //       =
    // dy_pg_guest_info.user_id
    // ==========================================================

    let guests = [];

    if (userIds.length > 0) {

      guests =
        await prisma.dy_pg_guest_info.findMany({

          where: {

            user_id: {
              in: userIds
            },

            pg_id: pgId
          },

          select: {

            id: true,

            user_id: true
          }
        });
    }

    // ==========================================================
    // 6. CREATE GUEST MAP
    // ==========================================================

    const guestMap =
      new Map();

    guests.forEach(
      (guest) => {

        guestMap.set(

          Number(
            guest.user_id
          ),

          guest
        );
      }
    );

    // ==========================================================
    // 7. GET GUEST IDS
    // ==========================================================

    const guestIds = [

      ...new Set(

        guests

          .map(
            (guest) =>
              Number(
                guest.id
              )
          )

          .filter(
            (id) =>
              Number.isInteger(id) &&
              id > 0
          )
      )
    ];

    // ==========================================================
    // 8. GET BOOKINGS
    //
    // dy_pg_guest_info.id
    //          =
    // dy_pg_bookings.guest_id
    // ==========================================================

    let bookings = [];

    if (guestIds.length > 0) {

      bookings =
        await prisma.dy_pg_bookings.findMany({

          where: {

            guest_id: {
              in: guestIds
            },

            pg_id: pgId
          },

          select: {

            id: true,

            guest_id: true,

            room_id: true
          },

          orderBy: {

            id: "desc"
          }
        });
    }

    // ==========================================================
    // 9. CREATE BOOKING MAP
    //
    // If one guest has multiple bookings,
    // latest booking is used.
    // ==========================================================

    const bookingMap =
      new Map();

    bookings.forEach(
      (booking) => {

        const guestId =
          Number(
            booking.guest_id
          );

        if (
          !bookingMap.has(
            guestId
          )
        ) {

          bookingMap.set(
            guestId,
            booking
          );
        }
      }
    );

    // ==========================================================
    // 10. GET ROOM IDS
    //
    // dy_pg_bookings.room_id
    //          =
    // dy_pg_room_info.id
    // ==========================================================

    const roomIds = [

      ...new Set(

        bookings

          .map(
            (booking) =>
              Number(
                booking.room_id
              )
          )

          .filter(
            (id) =>
              Number.isInteger(id) &&
              id > 0
          )
      )
    ];

    // ==========================================================
    // 11. GET ROOMS
    // ==========================================================

    let rooms = [];

    if (roomIds.length > 0) {

      rooms =
        await prisma.dy_pg_room_info.findMany({

          where: {

            id: {
              in: roomIds
            }
          },

          select: {

            id: true,

            room_name: true
          }
        });
    }

    // ==========================================================
    // 12. CREATE ROOM MAP
    // ==========================================================

    const roomMap =
      new Map(

        rooms.map(
          (room) => [

            Number(
              room.id
            ),

            room
          ]
        )
      );

    // ==========================================================
    // 13. BUILD FINAL DATA
    // ==========================================================

    const data =
      serviceRequests.map(
        (request) => {

          // ====================================================
          // REQUESTOR USER
          // ====================================================

          const requestorUserId =
            Number(
              request.requestor_info
            );

          const requestor =
            userMap.get(
              requestorUserId
            ) || null;

          // ====================================================
          // ASSIGNED USER
          // ====================================================

          const assignedUserId =
            Number(
              request.request_assigned_to
            );

          const assignedTo =
            userMap.get(
              assignedUserId
            ) || null;

          // ====================================================
          // GUEST
          // ====================================================

          const guest =
            guestMap.get(
              requestorUserId
            ) || null;

          // ====================================================
          // BOOKING
          // ====================================================

          const booking =
            guest
              ? bookingMap.get(
                  Number(
                    guest.id
                  )
                ) || null
              : null;

          // ====================================================
          // ROOM
          // ====================================================

          const room =
            booking &&
            booking.room_id !== null &&
            booking.room_id !== undefined

              ? roomMap.get(
                  Number(
                    booking.room_id
                  )
                ) || null

              : null;

          // ====================================================
          // OVERDUE DAYS
          // ====================================================

          const overdueDays =
            getOverdueDays(
              request.request_eta_date
            );

          // ====================================================
          // RETURN
          // ====================================================

          return {

            // ==================================================
            // SERVICE REQUEST
            // ==================================================

            serviceRequest: {

              id:
                request.id,

              requestorInfo:
                request.requestor_info,

              requestAssignedTo:
                assignedTo
                  ? {
                      id:
                        assignedTo.id,

                      firstName:
                        assignedTo.first_name,

                      lastName:
                        assignedTo.last_name
                    }
                  : null,

              serviceTitle:
                request.service_title,

              serviceDescription:
                request.service_description,
                 feedbackSummary:
    request.feedback_summary,


              SLA:
                request.SLA,

              feedback:
                request.feedback,

              serviceStatus:
                request.service_status,

              pgId:
                request.pg_id,

              requestEtaDate:
                request.request_eta_date,

              overdueDays:
                overdueDays
            },

            // ==================================================
            // REQUESTOR
            // ==================================================

            requestor:
              requestor
                ? {

                    id:
                      requestor.id,

                    firstName:
                      requestor.first_name,

                    lastName:
                      requestor.last_name
                  }

                : null,

            // ==================================================
            // GUEST
            // ==================================================

            guest:
              guest
                ? {

                    id:
                      guest.id,

                    userId:
                      guest.user_id
                  }

                : null,

            // ==================================================
            // BOOKING
            // ==================================================

            booking:
              booking
                ? {

                    id:
                      booking.id,

                    guestId:
                      booking.guest_id,

                    roomId:
                      booking.room_id
                  }

                : null,

            // ==================================================
            // ROOM
            // ==================================================

            room:
              room
                ? {

                    id:
                      room.id,

                    roomName:
                      room.room_name
                  }

                : null
          };
        }
      );

    // ==========================================================
    // FINAL RESPONSE
    // ==========================================================

    return res.status(200).json({

      success: true,

      message:
        "Service request details fetched successfully",

      data

    });

  } catch (error) {

    console.error(
      "Service request details error:",
      error
    );

    return res.status(500).json({

      success: false,

      message:
        "Failed to fetch service request details",

      error:
        error.message
    });
  }
};







/* ============================================================
   GET TODAY DASHBOARD TASKS FOR MANAGER
   ------------------------------------------------------------
   API:
   GET /api/pg/owner/dashboard/today-tasks?pgId=9
============================================================ */

export const getTodayDashboardTasksformanager = async (req, res) => {
  try {

    // ==========================================================
    // 1. GET PG ID
    // ==========================================================

    const pgId = Number(req.query.pgId);

    if (!Number.isInteger(pgId) || pgId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid pgId is required"
      });
    }


    // ==========================================================
    // 2. TODAY DATE RANGE
    // ==========================================================

    const now = new Date();

    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0
    );

    const tomorrowStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      0,
      0,
      0,
      0
    );


    // ==========================================================
    // 3. GET TODAY CHECK-IN BOOKINGS
    // ==========================================================

    const checkInBookings =
      await prisma.dy_pg_bookings.findMany({

        where: {
          pg_id: pgId,

          planned_check_in_date: {
            gte: todayStart,
            lt: tomorrowStart
          }
        },

        select: {
          id: true,
          bkg_no: true,
          pg_id: true,
          room_id: true,
          bed_id: true,
          guest_id: true,
          planned_check_in_date: true
        },

        orderBy: {
          planned_check_in_date: "asc"
        }
      });


    // ==========================================================
    // 4. GET TODAY CHECK-OUT BOOKINGS
    // ==========================================================

    const checkOutBookings =
      await prisma.dy_pg_bookings.findMany({

        where: {
          pg_id: pgId,

          planned_check_out_date: {
            gte: todayStart,
            lt: tomorrowStart
          }
        },

        select: {
          id: true,
          bkg_no: true,
          pg_id: true,
          room_id: true,
          bed_id: true,
          guest_id: true,
          planned_check_out_date: true
        },

        orderBy: {
          planned_check_out_date: "asc"
        }
      });


    // ==========================================================
    // 5. COLLECT GUEST IDS
    // ==========================================================

    const guestIds = [
      ...new Set([
        ...checkInBookings.map(
          (booking) => booking.guest_id
        ),

        ...checkOutBookings.map(
          (booking) => booking.guest_id
        )
      ])
    ].filter(
      (id) => id !== null && id !== undefined
    );


    // ==========================================================
    // 6. GET GUEST INFORMATION
    //
    // IMPORTANT:
    // first_name / last_name are NOT in dy_pg_guest_info.
    //
    // They are coming through:
    //
    // dy_pg_guest_info.user_id
    //          ↓
    //       dy_user.id
    //
    // ==========================================================

    const guests = guestIds.length > 0
      ? await prisma.dy_pg_guest_info.findMany({

          where: {
            id: {
              in: guestIds
            }
          },

          select: {
            id: true,
            user_id: true,

            dy_user: {
              select: {
                first_name: true,
                last_name: true
              }
            }
          }
        })
      : [];


    // ==========================================================
    // 7. CREATE GUEST MAP
    // ==========================================================

    const guestMap = new Map(
      guests.map((guest) => {

        const firstName =
          guest.dy_user?.first_name || "";

        const lastName =
          guest.dy_user?.last_name || "";

        const fullName =
          `${firstName} ${lastName}`.trim();

        return [
          guest.id,
          {
            guestId: guest.id,
            userId: guest.user_id,
            firstName,
            lastName,
            fullName: fullName || null
          }
        ];
      })
    );


    // ==========================================================
    // 8. COLLECT ROOM IDS
    // ==========================================================

    const roomIds = [
      ...new Set([
        ...checkInBookings.map(
          (booking) => booking.room_id
        ),

        ...checkOutBookings.map(
          (booking) => booking.room_id
        )
      ])
    ].filter(
      (id) => id !== null && id !== undefined
    );


    // ==========================================================
    // 9. GET ROOM INFORMATION
    // ==========================================================

    const rooms = roomIds.length > 0
      ? await prisma.dy_pg_room_info.findMany({

          where: {
            id: {
              in: roomIds
            }
          },

          select: {
            id: true,
            room_name: true
          }
        })
      : [];


    // ==========================================================
    // 10. CREATE ROOM MAP
    // ==========================================================

    const roomMap = new Map(
      rooms.map((room) => [
        room.id,
        room.room_name
      ])
    );


    // ==========================================================
    // 11. FORMAT TIME
    // ==========================================================

    const formatTime = (date) => {

      if (!date) {
        return null;
      }

      return new Intl.DateTimeFormat(
        "en-IN",
        {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true
        }
      ).format(new Date(date));
    };


    // ==========================================================
    // 12. FORMAT DATE
    // ==========================================================

    const formatDate = (date) => {

      if (!date) {
        return null;
      }

      return new Intl.DateTimeFormat(
        "en-IN",
        {
          day: "2-digit",
          month: "2-digit",
          year: "numeric"
        }
      ).format(new Date(date));
    };


    // ==========================================================
    // 13. CREATE CHECK-IN TASKS
    // ==========================================================

    const checkInTasks =
      checkInBookings.map((booking) => {

        const guest =
          guestMap.get(booking.guest_id);

        return {

          taskType: "CHECK_IN",

          taskTitle: "Check-in",

          guestId: booking.guest_id,

          userId: guest?.userId || null,

          guestName:
            guest?.fullName || null,

          firstName:
            guest?.firstName || null,

          lastName:
            guest?.lastName || null,

          bookingId: booking.id,

          bookingNo: booking.bkg_no,

          roomId: booking.room_id,

          room:
            roomMap.get(booking.room_id) || null,

          bedId: booking.bed_id,

          date:
            formatDate(
              booking.planned_check_in_date
            ),

          time:
            formatTime(
              booking.planned_check_in_date
            ),

          taskDate:
            booking.planned_check_in_date
        };
      });


    // ==========================================================
    // 14. CREATE CHECK-OUT TASKS
    // ==========================================================

    const checkOutTasks =
      checkOutBookings.map((booking) => {

        const guest =
          guestMap.get(booking.guest_id);

        return {

          taskType: "CHECK_OUT",

          taskTitle: "Check-out",

          guestId: booking.guest_id,

          userId: guest?.userId || null,

          guestName:
            guest?.fullName || null,

          firstName:
            guest?.firstName || null,

          lastName:
            guest?.lastName || null,

          bookingId: booking.id,

          bookingNo: booking.bkg_no,

          roomId: booking.room_id,

          room:
            roomMap.get(booking.room_id) || null,

          bedId: booking.bed_id,

          date:
            formatDate(
              booking.planned_check_out_date
            ),

          time:
            formatTime(
              booking.planned_check_out_date
            ),

          taskDate:
            booking.planned_check_out_date
        };
      });


    // ==========================================================
    // 15. COMBINE TODAY'S TASKS
    // ==========================================================

    const todayTasks = [
      ...checkInTasks,
      ...checkOutTasks
    ];


    // ==========================================================
    // 16. SORT TASKS BY TIME
    // ==========================================================

    todayTasks.sort((a, b) => {

      return (
        new Date(a.taskDate).getTime() -
        new Date(b.taskDate).getTime()
      );

    });


    // ==========================================================
    // 17. REMOVE INTERNAL taskDate
    // ==========================================================

    const finalTodayTasks =
      todayTasks.map((task) => {

        const {
          taskDate,
          ...cleanTask
        } = task;

        return cleanTask;
      });


    // ==========================================================
    // 18. CALCULATE COUNTS
    // ==========================================================

    const todayCheckIns =
      checkInBookings.length;

    const todayCheckOuts =
      checkOutBookings.length;


    // ==========================================================
    // 19. FINAL RESPONSE
    // ==========================================================

    return res.status(200).json({

      success: true,

      message:
        "Today's dashboard tasks fetched successfully",

      data: {

        summary: {

          todayCheckIns,

          todayCheckOuts

        },

        todayTasks:
          finalTodayTasks

      }

    });

  } catch (error) {

    console.error(
      "Today's dashboard tasks error:",
      error
    );

    return res.status(500).json({

      success: false,

      message:
        "Failed to fetch today's dashboard tasks",

      error:
        error.message

    });

  }
};



/**
 * ============================================================
 * GET CHECK-IN / CHECK-OUT AGGREGATE
 *
 * SINGLE API
 *
 * GET /api/aggregate/check-ins-checkouts?pg_id=9
 *
 * ============================================================
 */


/**
 * ============================================================
 * CHECK-IN / CHECK-OUT AGGREGATE
 * ============================================================
 *
 * BUSINESS RULE:
 *
 * Pending KYC =
 *
 * booking.pg_id = requested pg_id
 * AND booking.bkg_status = 5
 * AND booking.guest_id IS NOT NULL
 * AND NO matching record exists in dy_pg_kyc_info
 *
 * IMPORTANT:
 *
 * bookings table:
 *     guest_id
 *
 * KYC table:
 *     guest_info
 *
 * Therefore:
 *
 * booking.guest_id === kyc.guest_info
 *
 * ============================================================
 */

/**
 * ============================================================
 * GET CHECK-IN / CHECK-OUT AGGREGATE
 *
 * SINGLE API
 *
 * GET /api/aggregate/check-ins-checkouts?pg_id=9
 *
 * ============================================================
 */

/**
 * ============================================================
 * GET CHECK-IN / CHECK-OUT AGGREGATE
 *
 * SINGLE API
 *
 * GET /api/aggregate/check-ins-checkouts?pg_id=9
 *
 * ============================================================
 */


/**
 * ============================================================
 * CHECK-IN / CHECK-OUT AGGREGATE
 * ============================================================
 *
 * BUSINESS RULE:
 *
 * Pending KYC =
 *
 * booking.pg_id = requested pg_id
 * AND booking.bkg_status = 5
 * AND booking.guest_id IS NOT NULL
 * AND NO matching record exists in dy_pg_kyc_info
 *
 *
 * USER NAME FLOW:
 *
 * dy_pg_bookings.guest_id
 *        ↓
 * dy_pg_guest_info.id
 *        ↓
 * dy_pg_guest_info.user_id
 *        ↓
 * dy_user.id
 *        ↓
 * first_name + last_name
 *
 * ============================================================
 */
/**
 * ============================================================
 * CHECK-IN / CHECK-OUT AGGREGATE + STATUS UPDATE
 * ============================================================
 *
 * AGGREGATE:
 *
 * GET
 * /api/pg/aggregate/manager/getCheckInCheckoutAggregate/getAllRecords?pg_id=9
 *
 *
 * UPDATE:
 *
 * PATCH
 * /api/pg/aggregate/manager/getCheckInCheckoutAggregate/status
 *
 *
 * CHECK-IN BODY:
 *
 * {
 *   "booking_id": 824,
 *   "action": "check_in",
 *   "modified_by": 787
 * }
 *
 *
 * CHECK-OUT BODY:
 *
 * {
 *   "booking_id": 824,
 *   "action": "check_out",
 *   "modified_by": 787
 * }
 *
 *
 * ============================================================
 * BUSINESS STATUS
 * ============================================================
 *
 * 3 = VACANT
 * 4 = RESERVED
 * 5 = OCCUPIED
 *
 *
 * ============================================================
 * TODAY'S ARRIVALS
 * ============================================================
 *
 * planned_check_in_date = TODAY
 * AND actual_check_in_date IS NULL
 * AND bkg_status = 4
 *
 *
 * AFTER CHECK-IN
 *
 * bkg_status = 5
 * actual_check_in_date != NULL
 *
 * => Removed from Today's Arrivals
 *
 *
 * ============================================================
 * TODAY'S CHECK-OUTS
 * ============================================================
 *
 * planned_check_out_date = TODAY
 * AND actual_check_in_date IS NOT NULL
 * AND actual_check_out_date IS NULL
 * AND bkg_status = 5
 *
 *
 * AFTER CHECK-OUT
 *
 * bkg_status = 3
 * actual_check_out_date != NULL
 *
 * => Removed from Today's Check-outs
 *
 * ============================================================
 */


/**
 * ============================================================
 * GET CHECK-IN / CHECK-OUT AGGREGATE
 * ============================================================
 */

export const getCheckInCheckoutAggregate = async (req, res) => {
  try {

    // ========================================================
    // 1. GET PG ID
    // ========================================================

    const { pg_id } = req.query;

    if (!pg_id) {
      return res.status(400).json({
        success: false,
        status: 400,
        error: "BAD_REQUEST",
        message: "pg_id is required"
      });
    }

    const pgId = Number(pg_id);

    if (!Number.isInteger(pgId) || pgId <= 0) {
      return res.status(400).json({
        success: false,
        status: 400,
        error: "BAD_REQUEST",
        message: "pg_id must be a valid positive integer"
      });
    }


    // ========================================================
    // 2. TODAY DATE RANGE
    // ========================================================

    const now = new Date();

    const startOfToday = new Date(now);

    startOfToday.setHours(
      0,
      0,
      0,
      0
    );

    const endOfToday = new Date(now);

    endOfToday.setHours(
      23,
      59,
      59,
      999
    );


    // ========================================================
    // 3. TODAY'S CHECK-INS / ARRIVALS
    // ========================================================
    //
    // BUSINESS RULE:
    //
    // planned_check_in_date = TODAY
    // AND actual_check_in_date IS NULL
    // AND bkg_status = 4
    //
    // 4 = RESERVED
    //
    // Once check-in happens:
    //
    // bkg_status = 5
    // actual_check_in_date != NULL
    //
    // Therefore it automatically disappears.
    //
    // ========================================================

    const todaysCheckIns =
      await prisma.dy_pg_bookings.findMany({
        where: {

          pg_id: pgId,

          planned_check_in_date: {
            gte: startOfToday,
            lte: endOfToday
          },

          actual_check_in_date: null,

          bkg_status: 4

        },

        orderBy: {
          planned_check_in_date: "asc"
        }
      });


    // ========================================================
    // 4. TODAY'S CHECK-OUTS
    // ========================================================
    //
    // BUSINESS RULE:
    //
    // planned_check_out_date = TODAY
    // AND actual_check_in_date IS NOT NULL
    // AND actual_check_out_date IS NULL
    // AND bkg_status = 5
    //
    // 5 = OCCUPIED
    //
    // Once checkout happens:
    //
    // bkg_status = 3
    // actual_check_out_date != NULL
    //
    // Therefore it automatically disappears.
    //
    // ========================================================

    const todaysCheckOuts =
      await prisma.dy_pg_bookings.findMany({
        where: {

          pg_id: pgId,

          planned_check_out_date: {
            gte: startOfToday,
            lte: endOfToday
          },

          actual_check_in_date: {
            not: null
          },

          actual_check_out_date: null,

          bkg_status: 5

        },

        orderBy: {
          planned_check_out_date: "asc"
        }
      });


    // ========================================================
    // 5. UPCOMING CHECK-INS
    // ========================================================
    //
    // KEEPING YOUR EXISTING LOGIC
    //
    // ========================================================

    const upcomingCheckIns =
      await prisma.dy_pg_bookings.findMany({
        where: {

          pg_id: pgId,

          planned_check_in_date: {
            gt: endOfToday
          }

        },

        orderBy: {
          planned_check_in_date: "asc"
        },

        take: 50
      });


    // ========================================================
    // 6. UPCOMING CHECK-OUTS
    // ========================================================
    //
    // KEEPING YOUR EXISTING LOGIC
    //
    // ========================================================

    const upcomingCheckOuts =
      await prisma.dy_pg_bookings.findMany({
        where: {

          pg_id: pgId,

          planned_check_out_date: {
            gt: endOfToday
          }

        },

        orderBy: {
          planned_check_out_date: "asc"
        },

        take: 50
      });


    // ========================================================
    // 7. COMPLETED CHECK-INS
    // ========================================================
    //
    // KEEPING YOUR EXISTING LOGIC
    //
    // ========================================================

    const completedCheckIns =
      await prisma.dy_pg_bookings.findMany({
        where: {

          pg_id: pgId,

          actual_check_in_date: {
            not: null,
            lte: endOfToday
          }

        },

        orderBy: {
          actual_check_in_date: "desc"
        },

        take: 50
      });


    // ========================================================
    // 8. COMPLETED CHECK-OUTS
    // ========================================================

    const completedCheckOuts =
      await prisma.dy_pg_bookings.findMany({
        where: {

          pg_id: pgId,

          actual_check_out_date: {
            not: null,
            lte: endOfToday
          }

        },

        orderBy: {
          actual_check_out_date: "desc"
        },

        take: 50
      });


    // ========================================================
    // 9. COLLECT ALL BOOKINGS
    // ========================================================

    const allBookings = [
      ...todaysCheckIns,
      ...todaysCheckOuts,
      ...upcomingCheckIns,
      ...upcomingCheckOuts,
      ...completedCheckIns,
      ...completedCheckOuts
    ];


    // ========================================================
    // 10. COLLECT UNIQUE GUEST IDS
    // ========================================================

    const guestIds = [
      ...new Set(
        allBookings
          .map(
            (booking) =>
              booking.guest_id
          )
          .filter(
            (guestId) =>
              guestId !== null &&
              guestId !== undefined
          )
      )
    ];


    // ========================================================
    // 11. GET GUEST INFORMATION
    // ========================================================

    let guestRecords = [];

    if (guestIds.length > 0) {

      guestRecords =
        await prisma.dy_pg_guest_info.findMany({
          where: {

            id: {
              in: guestIds
            },

            pg_id: pgId

          },

          select: {

            id: true,

            user_id: true

          }
        });
    }


    // ========================================================
    // 12. GUEST -> USER MAP
    // ========================================================

    const guestUserMap =
      new Map();

    guestRecords.forEach(
      (guest) => {

        if (
          guest.id !== null &&
          guest.id !== undefined
        ) {

          guestUserMap.set(
            Number(guest.id),
            guest.user_id
          );

        }

      }
    );


    // ========================================================
    // 13. UNIQUE USER IDS
    // ========================================================

    const userIds = [
      ...new Set(
        guestRecords
          .map(
            (guest) =>
              guest.user_id
          )
          .filter(
            (userId) =>
              userId !== null &&
              userId !== undefined
          )
      )
    ];


    // ========================================================
    // 14. GET USERS
    // ========================================================

    let userRecords = [];

    if (userIds.length > 0) {

      userRecords =
        await prisma.dy_user.findMany({

          where: {

            id: {
              in: userIds
            }

          },

          select: {

            id: true,

            first_name: true,

            last_name: true

          }

        });

    }


    // ========================================================
    // 15. USER MAP
    // ========================================================

    const userMap =
      new Map();

    userRecords.forEach(
      (user) => {

        const firstName =
          user.first_name || "";

        const lastName =
          user.last_name || "";

        const userName =
          `${firstName} ${lastName}`.trim();

        userMap.set(
          Number(user.id),
          userName || null
        );

      }
    );


    // ========================================================
    // 16. BOOKING -> USER NAME MAP
    // ========================================================

    const bookingUserMap =
      new Map();

    allBookings.forEach(
      (booking) => {

        const guestId =
          booking.guest_id;

        if (
          guestId === null ||
          guestId === undefined
        ) {

          bookingUserMap.set(
            booking.id,
            null
          );

          return;
        }

        const userId =
          guestUserMap.get(
            Number(guestId)
          );

        const userName =
          userId !== null &&
          userId !== undefined
            ? userMap.get(
                Number(userId)
              )
            : null;

        bookingUserMap.set(
          booking.id,
          userName || null
        );

      }
    );


    // ========================================================
    // 17. STATUS 5 BOOKINGS FOR KYC
    // ========================================================

    const pendingKycBookings =
      await prisma.dy_pg_bookings.findMany({

        where: {

          pg_id: pgId,

          bkg_status: 5,

          guest_id: {
            not: null
          }

        },

        select: {

          id: true,

          bkg_no: true,

          guest_id: true,

          room_id: true,

          bed_id: true,

          planned_check_in_date: true,

          planned_check_out_date: true,

          actual_check_in_date: true,

          actual_check_out_date: true,

          bkg_status: true

        },

        orderBy: {

          planned_check_in_date: "asc"

        }

      });


    // ========================================================
    // 18. UNIQUE KYC GUEST IDS
    // ========================================================

    const pendingKycGuestIds = [
      ...new Set(
        pendingKycBookings
          .map(
            (booking) =>
              booking.guest_id
          )
          .filter(
            (guestId) =>
              guestId !== null &&
              guestId !== undefined
          )
      )
    ];


    // ========================================================
    // 19. FIND EXISTING KYC
    // ========================================================

    let existingKycGuestIds = [];

    if (
      pendingKycGuestIds.length > 0
    ) {

      const kycRecords =
        await prisma.dy_pg_kyc_info.findMany({

          where: {

            guest_info: {
              in: pendingKycGuestIds
            },

            pg_info: pgId

          },

          select: {

            guest_info: true

          }

        });

      existingKycGuestIds =
        kycRecords
          .map(
            (kyc) =>
              kyc.guest_info
          )
          .filter(
            (guestId) =>
              guestId !== null &&
              guestId !== undefined
          );

    }


    // ========================================================
    // 20. KYC SET
    // ========================================================

    const existingKycSet =
      new Set(
        existingKycGuestIds
      );


    // ========================================================
    // 21. ACTUAL PENDING KYC
    // ========================================================

    const actualPendingKycBookings =
      pendingKycBookings.filter(
        (booking) =>
          !existingKycSet.has(
            booking.guest_id
          )
      );


    // ========================================================
    // 22. PENDING KYC COUNT
    // ========================================================

    const pendingKyc =
      actualPendingKycBookings.length;


    // ========================================================
    // 23. VACANT READY
    // ========================================================

    let vacantReady = 0;

    try {

      vacantReady =
        await prisma.dy_pg_bed_info.count({

          where: {

            pg_id: pgId,

            /*
             * IMPORTANT:
             * Your schema has bed_status as INTEGER.
             *
             * If your vacant status ID is 3,
             * use bed_status: 3.
             *
             * Do NOT use:
             *
             * status: "VACANT"
             *
             * because that field does not exist
             * in your Prisma schema.
             */

            bed_status: 3

          }

        });

    } catch (bedError) {

      console.log(
        "VACANT READY COUNT SKIPPED:",
        bedError.message
      );

      vacantReady = 0;
    }


    // ========================================================
    // 24. FORMAT TODAY ARRIVALS
    // ========================================================

    const formattedTodayArrivals =
      todaysCheckIns.map(
        (booking) =>
          formatArrival(
            booking,
            bookingUserMap
          )
      );


    // ========================================================
    // 25. FORMAT TODAY CHECKOUTS
    // ========================================================

    const formattedTodayCheckouts =
      todaysCheckOuts.map(
        (booking) =>
          formatCheckout(
            booking,
            bookingUserMap
          )
      );


    // ========================================================
    // 26. FORMAT UPCOMING ARRIVALS
    // ========================================================

    const formattedUpcomingArrivals =
      upcomingCheckIns.map(
        (booking) =>
          formatArrival(
            booking,
            bookingUserMap
          )
      );


    // ========================================================
    // 27. FORMAT UPCOMING CHECKOUTS
    // ========================================================

    const formattedUpcomingCheckouts =
      upcomingCheckOuts.map(
        (booking) =>
          formatCheckout(
            booking,
            bookingUserMap
          )
      );


    // ========================================================
    // 28. FORMAT COMPLETED ARRIVALS
    // ========================================================

    const formattedCompletedArrivals =
      completedCheckIns.map(
        (booking) =>
          formatArrival(
            booking,
            bookingUserMap
          )
      );


    // ========================================================
    // 29. FORMAT COMPLETED CHECKOUTS
    // ========================================================

    const formattedCompletedCheckouts =
      completedCheckOuts.map(
        (booking) =>
          formatCheckout(
            booking,
            bookingUserMap
          )
      );


    // ========================================================
    // 30. FINAL RESPONSE
    // ========================================================

    return res.status(200).json({

      success: true,

      data: {

        // ====================================================
        // SUMMARY
        // ====================================================

        summary: {

          todaysCheckIns:
            todaysCheckIns.length,

          todaysCheckOuts:
            todaysCheckOuts.length,

          pendingKyc,

          vacantReady

        },


        // ====================================================
        // TODAY
        // ====================================================

        today: {

          arrivals:
            formattedTodayArrivals,

          checkouts:
            formattedTodayCheckouts

        },


        // ====================================================
        // UPCOMING
        // ====================================================

        upcoming: {

          arrivals:
            formattedUpcomingArrivals,

          checkouts:
            formattedUpcomingCheckouts

        },


        // ====================================================
        // COMPLETED
        // ====================================================

        completed: {

          arrivals:
            formattedCompletedArrivals,

          checkouts:
            formattedCompletedCheckouts

        },


        // ====================================================
        // WALK-IN
        // ====================================================

        walkInEnquiries: 0,


        // ====================================================
        // KYC
        // ====================================================

        kyc: {

          statusCodeUsed: 5,

          status5Bookings:
            pendingKycBookings.length,

          uniqueStatus5Guests:
            pendingKycGuestIds.length,

          guestsWithKyc:
            existingKycSet.size,

          bookingsWithKyc:
            pendingKycBookings.filter(
              (booking) =>
                existingKycSet.has(
                  booking.guest_id
                )
            ).length,

          bookingsWithoutKyc:
            actualPendingKycBookings.length

        }

      }

    });

  } catch (error) {

    console.error(
      "CHECK-IN CHECK-OUT AGGREGATE ERROR:",
      error
    );

    return res.status(500).json({

      success: false,

      status: 500,

      error:
        "INTERNAL_SERVER_ERROR",

      message:
        error.message

    });

  }
};


/**
 * ============================================================
 * FORMAT ARRIVAL
 * ============================================================
 */

const formatArrival = (
  booking,
  bookingUserMap
) => {

  return {

    booking_id:
      booking.id,

    booking_no:
      booking.bkg_no,

    guest_id:
      booking.guest_id,

    user_name:
      bookingUserMap.get(
        booking.id
      ) || null,

    room_id:
      booking.room_id,

    bed_id:
      booking.bed_id,

    planned_check_in_date:
      booking.planned_check_in_date,

    actual_check_in_date:
      booking.actual_check_in_date,

    planned_check_out_date:
      booking.planned_check_out_date,

    actual_check_out_date:
      booking.actual_check_out_date,

    booking_status:
      booking.bkg_status,

    status:
      getArrivalStatus(
        booking
      )

  };

};


/**
 * ============================================================
 * FORMAT CHECKOUT
 * ============================================================
 */

const formatCheckout = (
  booking,
  bookingUserMap
) => {

  return {

    booking_id:
      booking.id,

    booking_no:
      booking.bkg_no,

    guest_id:
      booking.guest_id,

    user_name:
      bookingUserMap.get(
        booking.id
      ) || null,

    room_id:
      booking.room_id,

    bed_id:
      booking.bed_id,

    planned_check_in_date:
      booking.planned_check_in_date,

    actual_check_in_date:
      booking.actual_check_in_date,

    planned_check_out_date:
      booking.planned_check_out_date,

    actual_check_out_date:
      booking.actual_check_out_date,

    booking_status:
      booking.bkg_status,

    status:
      getCheckoutStatus(
        booking
      )

  };

};


/**
 * ============================================================
 * ARRIVAL STATUS
 * ============================================================
 */

const getArrivalStatus = (
  booking
) => {

  // ----------------------------------------------------------
  // Already checked in
  // ----------------------------------------------------------

  if (
    booking.actual_check_in_date
  ) {

    return "CHECKED_IN";

  }


  // ----------------------------------------------------------
  // Room + bed assigned
  // ----------------------------------------------------------

  if (
    booking.room_id !== null &&
    booking.room_id !== undefined &&
    booking.bed_id !== null &&
    booking.bed_id !== undefined
  ) {

    return "ROOM_ASSIGNED";

  }


  // ----------------------------------------------------------
  // Booking ready
  // ----------------------------------------------------------

  return "READY";

};


/**
 * ============================================================
 * CHECKOUT STATUS
 * ============================================================
 */

const getCheckoutStatus = (
  booking
) => {

  // ----------------------------------------------------------
  // Already checked out
  // ----------------------------------------------------------

  if (
    booking.actual_check_out_date
  ) {

    return "COMPLETED";

  }


  // ----------------------------------------------------------
  // Checkout confirmed
  // ----------------------------------------------------------

  return "CONFIRMED";

};


/**
 * ============================================================
 * UPDATE CHECK-IN / CHECK-OUT STATUS
 * ============================================================
 *
 * PATCH
 * /api/pg/aggregate/manager/getCheckInCheckoutAggregate/status
 *
 * ============================================================
 */

export const updateCheckInCheckoutStatus1 = async (
  req,
  res
) => {

  try {

    // ========================================================
    // 1. REQUEST DATA
    // ========================================================

    const {
      booking_id,
      action,
      modified_by
    } = req.body;


    // ========================================================
    // 2. VALIDATE BOOKING ID
    // ========================================================

    const bookingId =
      Number(booking_id);

    if (
      !Number.isInteger(bookingId) ||
      bookingId <= 0
    ) {

      return res.status(400).json({

        success: false,

        status: 400,

        error:
          "BAD_REQUEST",

        message:
          "Valid booking_id is required"

      });

    }


    // ========================================================
    // 3. VALIDATE ACTION
    // ========================================================

    if (
      action !== "check_in" &&
      action !== "check_out"
    ) {

      return res.status(400).json({

        success: false,

        status: 400,

        error:
          "BAD_REQUEST",

        message:
          "action must be either check_in or check_out"

      });

    }


    // ========================================================
    // 4. MODIFIED BY
    // ========================================================

    let modifiedBy = null;

    if (
      modified_by !== undefined &&
      modified_by !== null &&
      modified_by !== ""
    ) {

      modifiedBy =
        Number(modified_by);

      if (
        !Number.isInteger(modifiedBy) ||
        modifiedBy <= 0
      ) {

        return res.status(400).json({

          success: false,

          status: 400,

          error:
            "BAD_REQUEST",

          message:
            "modified_by must be a valid positive integer"

        });

      }

    }


    // ========================================================
    // 5. TODAY RANGE
    // ========================================================

    const now =
      new Date();


    const startOfToday =
      new Date(now);

    startOfToday.setHours(
      0,
      0,
      0,
      0
    );


    const endOfToday =
      new Date(now);

    endOfToday.setHours(
      23,
      59,
      59,
      999
    );


    // ========================================================
    // 6. GET BOOKING
    // ========================================================

    const booking =
      await prisma.dy_pg_bookings.findUnique({

        where: {

          id: bookingId

        },

        select: {

          id: true,

          bkg_no: true,

          pg_id: true,

          room_id: true,

          bed_id: true,

          guest_id: true,

          planned_check_in_date: true,

          actual_check_in_date: true,

          planned_check_out_date: true,

          actual_check_out_date: true,

          bkg_status: true

        }

      });


    if (!booking) {

      return res.status(404).json({

        success: false,

        status: 404,

        error:
          "NOT_FOUND",

        message:
          "Booking not found"

      });

    }


    // ========================================================
    // 7. CHECK-IN
    // ========================================================

    if (
      action === "check_in"
    ) {

      // ------------------------------------------------------
      // STATUS MUST BE RESERVED
      // ------------------------------------------------------

      if (
        booking.bkg_status !== 4
      ) {

        return res.status(409).json({

          success: false,

          status: 409,

          error:
            "INVALID_STATUS",

          message:
            "Only Reserved bookings can be checked in",

          current_status:
            booking.bkg_status,

          required_status:
            4

        });

      }


      // ------------------------------------------------------
      // MUST NOT ALREADY HAVE ACTUAL CHECK-IN
      // ------------------------------------------------------

      if (
        booking.actual_check_in_date
      ) {

        return res.status(409).json({

          success: false,

          status: 409,

          error:
            "ALREADY_CHECKED_IN",

          message:
            "Booking is already checked in",

          actual_check_in_date:
            booking.actual_check_in_date

        });

      }


      // ------------------------------------------------------
      // PLANNED CHECK-IN DATE REQUIRED
      // ------------------------------------------------------

      if (
        !booking.planned_check_in_date
      ) {

        return res.status(409).json({

          success: false,

          status: 409,

          error:
            "NO_CHECK_IN_DATE",

          message:
            "Booking does not have a planned check-in date"

        });

      }


      // ------------------------------------------------------
      // CHECK-IN MUST BE TODAY
      // ------------------------------------------------------

      const plannedCheckIn =
        new Date(
          booking.planned_check_in_date
        );


      if (
        plannedCheckIn < startOfToday ||
        plannedCheckIn > endOfToday
      ) {

        return res.status(409).json({

          success: false,

          status: 409,

          error:
            "NOT_TODAY",

          message:
            "Only today's arrivals can be checked in",

          planned_check_in_date:
            booking.planned_check_in_date

        });

      }


      // ------------------------------------------------------
      // TRANSACTION
      // ------------------------------------------------------

      const result =
        await prisma.$transaction(
          async (tx) => {

            // =================================================
            // UPDATE BOOKING
            //
            // 4 RESERVED
            //        ↓
            // 5 OCCUPIED
            // =================================================

            const updatedBooking =
              await tx.dy_pg_bookings.update({

                where: {

                  id:
                    booking.id

                },

                data: {

                  bkg_status:
                    5,

                  actual_check_in_date:
                    now,

                  modified_time:
                    now,

                  ...(modifiedBy
                    ? {
                        modified_by:
                          modifiedBy
                      }
                    : {})

                },

                select: {

                  id: true,

                  bkg_no: true,

                  pg_id: true,

                  room_id: true,

                  bed_id: true,

                  guest_id: true,

                  planned_check_in_date: true,

                  actual_check_in_date: true,

                  planned_check_out_date: true,

                  actual_check_out_date: true,

                  bkg_status: true

                }

              });


            // =================================================
            // UPDATE BED
            //
            // 5 = OCCUPIED
            // =================================================

            let updatedBed = null;


            if (
              booking.bed_id !== null &&
              booking.bed_id !== undefined
            ) {

              updatedBed =
                await tx.dy_pg_bed_info.update({

                  where: {

                    id:
                      booking.bed_id

                  },

                  data: {

                    bed_status:
                      5

                  },

                  select: {

                    id: true,

                    room_info: true,

                    bed_number: true,

                    bed_status: true

                  }

                });

            }


            return {

              updatedBooking,

              updatedBed

            };

          }
        );


      // ------------------------------------------------------
      // RESPONSE
      // ------------------------------------------------------

      return res.status(200).json({

        success: true,

        status: 200,

        message:
          "Check-in completed successfully",

        action:
          "check_in",

        data: {

          booking: {

            id:
              result.updatedBooking.id,

            booking_no:
              result.updatedBooking.bkg_no,

            pg_id:
              result.updatedBooking.pg_id,

            room_id:
              result.updatedBooking.room_id,

            bed_id:
              result.updatedBooking.bed_id,

            guest_id:
              result.updatedBooking.guest_id,

            planned_check_in_date:
              result
                .updatedBooking
                .planned_check_in_date,

            actual_check_in_date:
              result
                .updatedBooking
                .actual_check_in_date,

            planned_check_out_date:
              result
                .updatedBooking
                .planned_check_out_date,

            actual_check_out_date:
              result
                .updatedBooking
                .actual_check_out_date,

            booking_status:
              result
                .updatedBooking
                .bkg_status,

            status:
              "OCCUPIED"

          },


          bed:
            result.updatedBed
              ? {

                  id:
                    result.updatedBed.id,

                  room_id:
                    result.updatedBed.room_info,

                  bed_number:
                    result.updatedBed.bed_number,

                  bed_status:
                    result.updatedBed.bed_status,

                  status:
                    "OCCUPIED"

                }

              : null

        }

      });

    }


    // ========================================================
    // 8. CHECK-OUT
    // ========================================================

    if (
      action === "check_out"
    ) {

      // ------------------------------------------------------
      // STATUS MUST BE OCCUPIED
      // ------------------------------------------------------

      if (
        booking.bkg_status !== 5
      ) {

        return res.status(409).json({

          success: false,

          status: 409,

          error:
            "INVALID_STATUS",

          message:
            "Only Occupied bookings can be checked out",

          current_status:
            booking.bkg_status,

          required_status:
            5

        });

      }


      // ------------------------------------------------------
      // MUST HAVE ACTUAL CHECK-IN
      // ------------------------------------------------------

      if (
        !booking.actual_check_in_date
      ) {

        return res.status(409).json({

          success: false,

          status: 409,

          error:
            "NOT_CHECKED_IN",

          message:
            "Guest must be checked in before checkout"

        });

      }


      // ------------------------------------------------------
      // MUST NOT ALREADY BE CHECKED OUT
      // ------------------------------------------------------

      if (
        booking.actual_check_out_date
      ) {

        return res.status(409).json({

          success: false,

          status: 409,

          error:
            "ALREADY_CHECKED_OUT",

          message:
            "Booking is already checked out",

          actual_check_out_date:
            booking.actual_check_out_date

        });

      }


      // ------------------------------------------------------
      // PLANNED CHECKOUT REQUIRED
      // ------------------------------------------------------

      if (
        !booking.planned_check_out_date
      ) {

        return res.status(409).json({

          success: false,

          status: 409,

          error:
            "NO_CHECK_OUT_DATE",

          message:
            "Booking does not have a planned check-out date"

        });

      }


      // ------------------------------------------------------
      // CHECKOUT MUST BE TODAY
      // ------------------------------------------------------

      const plannedCheckOut =
        new Date(
          booking.planned_check_out_date
        );


      if (
        plannedCheckOut < startOfToday ||
        plannedCheckOut > endOfToday
      ) {

        return res.status(409).json({

          success: false,

          status: 409,

          error:
            "NOT_TODAY",

          message:
            "Only today's check-outs can be completed",

          planned_check_out_date:
            booking.planned_check_out_date

        });

      }


      // ------------------------------------------------------
      // TRANSACTION
      // ------------------------------------------------------

      const result =
        await prisma.$transaction(
          async (tx) => {

            // =================================================
            // UPDATE BOOKING
            //
            // 5 OCCUPIED
            //        ↓
            // 3 VACANT
            // =================================================

            const updatedBooking =
              await tx.dy_pg_bookings.update({

                where: {

                  id:
                    booking.id

                },

                data: {

                  bkg_status:
                    3,

                  actual_check_out_date:
                    now,

                  modified_time:
                    now,

                  ...(modifiedBy
                    ? {
                        modified_by:
                          modifiedBy
                      }
                    : {})

                },

                select: {

                  id: true,

                  bkg_no: true,

                  pg_id: true,

                  room_id: true,

                  bed_id: true,

                  guest_id: true,

                  planned_check_in_date: true,

                  actual_check_in_date: true,

                  planned_check_out_date: true,

                  actual_check_out_date: true,

                  bkg_status: true

                }

              });


            // =================================================
            // UPDATE BED
            //
            // 3 = VACANT
            // =================================================

            let updatedBed = null;


            if (
              booking.bed_id !== null &&
              booking.bed_id !== undefined
            ) {

              updatedBed =
                await tx.dy_pg_bed_info.update({

                  where: {

                    id:
                      booking.bed_id

                  },

                  data: {

                    bed_status:
                      3

                  },

                  select: {

                    id: true,

                    room_info: true,

                    bed_number: true,

                    bed_status: true

                  }

                });

            }


            return {

              updatedBooking,

              updatedBed

            };

          }
        );


      // ------------------------------------------------------
      // RESPONSE
      // ------------------------------------------------------

      return res.status(200).json({

        success: true,

        status: 200,

        message:
          "Check-out completed successfully",

        action:
          "check_out",

        data: {

          booking: {

            id:
              result.updatedBooking.id,

            booking_no:
              result.updatedBooking.bkg_no,

            pg_id:
              result.updatedBooking.pg_id,

            room_id:
              result.updatedBooking.room_id,

            bed_id:
              result.updatedBooking.bed_id,

            guest_id:
              result.updatedBooking.guest_id,

            planned_check_in_date:
              result
                .updatedBooking
                .planned_check_in_date,

            actual_check_in_date:
              result
                .updatedBooking
                .actual_check_in_date,

            planned_check_out_date:
              result
                .updatedBooking
                .planned_check_out_date,

            actual_check_out_date:
              result
                .updatedBooking
                .actual_check_out_date,

            booking_status:
              result
                .updatedBooking
                .bkg_status,

            status:
              "VACANT"

          },


          bed:
            result.updatedBed
              ? {

                  id:
                    result.updatedBed.id,

                  room_id:
                    result.updatedBed.room_info,

                  bed_number:
                    result.updatedBed.bed_number,

                  bed_status:
                    result.updatedBed.bed_status,

                  status:
                    "VACANT"

                }

              : null

        }

      });

    }

  } catch (error) {

    console.error(
      "UPDATE CHECK-IN CHECK-OUT ERROR:",
      error
    );

    return res.status(500).json({

      success: false,

      status: 500,

      error:
        "INTERNAL_SERVER_ERROR",

      message:
        "Failed to update check-in/check-out status",

      details:
        error.message

    });

  }

};





export const updateCheckInCheckoutStatus2 = async (
  req,
  res
) => {

  try {

    // ========================================================
    // 1. GET REQUEST DATA FROM fields
    // ========================================================
    //
    // Expected:
    //
    // {
    //   "fields": {
    //     "booking_id": 568,
    //     "action": "check_out",
    //     "user_id": 10
    //   }
    // }
    //
    // ========================================================

    const fields = req.body?.fields;


    // ========================================================
    // 2. VALIDATE fields OBJECT
    // ========================================================

    if (
      !fields ||
      typeof fields !== "object" ||
      Array.isArray(fields)
    ) {

      return res.status(400).json({

        success: false,

        status: 400,

        error:
          "BAD_REQUEST",

        message:
          "fields object is required"

      });

    }


    // ========================================================
    // 3. GET VALUES FROM fields
    // ========================================================

    const {
      booking_id,
      action,
      user_id
    } = fields;


    // ========================================================
    // 4. VALIDATE BOOKING ID
    // ========================================================

    const bookingId =
      Number(booking_id);


    if (
      !Number.isInteger(bookingId) ||
      bookingId <= 0
    ) {

      return res.status(400).json({

        success: false,

        status: 400,

        error:
          "BAD_REQUEST",

        message:
          "Valid booking_id is required"

      });

    }


    // ========================================================
    // 5. NORMALIZE ACTION
    // ========================================================
    //
    // Accept:
    //
    // "check_in"
    // "CHECK_IN"
    // "Check_In"
    //
    // "check_out"
    // "CHECK_OUT"
    // "Check_Out"
    //
    // ========================================================

    const normalizedAction =
      typeof action === "string"
        ? action.trim().toLowerCase()
        : "";


    // ========================================================
    // 6. VALIDATE ACTION
    // ========================================================

    if (
      normalizedAction !== "check_in" &&
      normalizedAction !== "check_out"
    ) {

      return res.status(400).json({

        success: false,

        status: 400,

        error:
          "BAD_REQUEST",

        message:
          "action must be either check_in or check_out"

      });

    }


    // ========================================================
    // 7. VALIDATE USER ID
    // ========================================================
    //
    // user_id is used as modified_by in the database.
    //
    // ========================================================

    let modifiedBy = null;


    if (
      user_id !== undefined &&
      user_id !== null &&
      user_id !== ""
    ) {

      modifiedBy =
        Number(user_id);


      if (
        !Number.isInteger(modifiedBy) ||
        modifiedBy <= 0
      ) {

        return res.status(400).json({

          success: false,

          status: 400,

          error:
            "BAD_REQUEST",

          message:
            "user_id must be a valid positive integer"

        });

      }

    }


    // ========================================================
    // 8. CURRENT DATE / TIME
    // ========================================================

    const now =
      new Date();


    // ========================================================
    // 9. TODAY START
    // ========================================================

    const startOfToday =
      new Date(now);

    startOfToday.setHours(
      0,
      0,
      0,
      0
    );


    // ========================================================
    // 10. TODAY END
    // ========================================================

    const endOfToday =
      new Date(now);

    endOfToday.setHours(
      23,
      59,
      59,
      999
    );


    // ========================================================
    // 11. GET BOOKING
    // ========================================================

    const booking =
      await prisma.dy_pg_bookings.findUnique({

        where: {

          id:
            bookingId

        },

        select: {

          id: true,

          bkg_no: true,

          pg_id: true,

          room_id: true,

          bed_id: true,

          guest_id: true,

          planned_check_in_date: true,

          actual_check_in_date: true,

          planned_check_out_date: true,

          actual_check_out_date: true,

          bkg_status: true

        }

      });


    // ========================================================
    // 12. BOOKING NOT FOUND
    // ========================================================

    if (!booking) {

      return res.status(404).json({

        success: false,

        status: 404,

        error:
          "NOT_FOUND",

        message:
          "Booking not found"

      });

    }


    // ========================================================
    // ========================================================
    //
    //                    CHECK-IN
    //
    // ========================================================
    // ========================================================

    if (
      normalizedAction === "check_in"
    ) {


      // ======================================================
      // 13. CHECK-IN STATUS VALIDATION
      // ======================================================
      //
      // Only RESERVED bookings can be checked in.
      //
      // 4 = RESERVED
      //
      // ======================================================

      if (
        booking.bkg_status !== 4
      ) {

        return res.status(409).json({

          success: false,

          status: 409,

          error:
            "INVALID_STATUS",

          message:
            "Only Reserved bookings can be checked in",

          current_status:
            booking.bkg_status,

          required_status:
            4

        });

      }


      // ======================================================
      // 14. CHECK IF ALREADY CHECKED IN
      // ======================================================

      if (
        booking.actual_check_in_date
      ) {

        return res.status(409).json({

          success: false,

          status: 409,

          error:
            "ALREADY_CHECKED_IN",

          message:
            "Booking is already checked in",

          actual_check_in_date:
            booking.actual_check_in_date

        });

      }


      // ======================================================
      // 15. CHECK PLANNED CHECK-IN DATE
      // ======================================================

      if (
        !booking.planned_check_in_date
      ) {

        return res.status(409).json({

          success: false,

          status: 409,

          error:
            "NO_CHECK_IN_DATE",

          message:
            "Booking does not have a planned check-in date"

        });

      }


      // ======================================================
      // 16. CHECK-IN MUST BE TODAY
      // ======================================================

      const plannedCheckIn =
        new Date(
          booking.planned_check_in_date
        );


      if (
        plannedCheckIn < startOfToday ||
        plannedCheckIn > endOfToday
      ) {

        return res.status(409).json({

          success: false,

          status: 409,

          error:
            "NOT_TODAY",

          message:
            "Only today's arrivals can be checked in",

          planned_check_in_date:
            booking.planned_check_in_date

        });

      }


      // ======================================================
      // 17. CHECK-IN TRANSACTION
      // ======================================================

      const result =
        await prisma.$transaction(
          async (tx) => {


            // =================================================
            // UPDATE BOOKING
            //
            // 4 RESERVED
            //      ↓
            // 5 OCCUPIED
            // =================================================

            const updatedBooking =
              await tx.dy_pg_bookings.update({

                where: {

                  id:
                    booking.id

                },

                data: {

                  bkg_status:
                    5,

                  actual_check_in_date:
                    now,

                  modified_time:
                    now,

                  ...(modifiedBy !== null
                    ? {
                        modified_by:
                          modifiedBy
                      }
                    : {})

                },

                select: {

                  id: true,

                  bkg_no: true,

                  pg_id: true,

                  room_id: true,

                  bed_id: true,

                  guest_id: true,

                  planned_check_in_date: true,

                  actual_check_in_date: true,

                  planned_check_out_date: true,

                  actual_check_out_date: true,

                  bkg_status: true

                }

              });


            // =================================================
            // UPDATE BED
            //
            // 3 VACANT
            //      ↓
            // 5 OCCUPIED
            // =================================================

            let updatedBed = null;


            if (
              booking.bed_id !== null &&
              booking.bed_id !== undefined
            ) {

              updatedBed =
                await tx.dy_pg_bed_info.update({

                  where: {

                    id:
                      booking.bed_id

                  },

                  data: {

                    bed_status:
                      5

                  },

                  select: {

                    id: true,

                    room_info: true,

                    bed_number: true,

                    bed_status: true

                  }

                });

            }


            return {

              updatedBooking,

              updatedBed

            };

          }
        );


      // ======================================================
      // 18. CHECK-IN SUCCESS RESPONSE
      // ======================================================

      return res.status(200).json({

        success: true,

        status: 200,

        message:
          "Check-in completed successfully",

        action:
          "check_in",

        data: {

          booking: {

            id:
              result.updatedBooking.id,

            booking_no:
              result.updatedBooking.bkg_no,

            pg_id:
              result.updatedBooking.pg_id,

            room_id:
              result.updatedBooking.room_id,

            bed_id:
              result.updatedBooking.bed_id,

            guest_id:
              result.updatedBooking.guest_id,

            planned_check_in_date:
              result.updatedBooking
                .planned_check_in_date,

            actual_check_in_date:
              result.updatedBooking
                .actual_check_in_date,

            planned_check_out_date:
              result.updatedBooking
                .planned_check_out_date,

            actual_check_out_date:
              result.updatedBooking
                .actual_check_out_date,

            booking_status:
              result.updatedBooking
                .bkg_status,

            status:
              "OCCUPIED"

          },


          bed:
            result.updatedBed
              ? {

                  id:
                    result.updatedBed.id,

                  room_id:
                    result.updatedBed.room_info,

                  bed_number:
                    result.updatedBed.bed_number,

                  bed_status:
                    result.updatedBed.bed_status,

                  status:
                    "OCCUPIED"

                }

              : null

        }

      });

    }


    // ========================================================
    // ========================================================
    //
    //                    CHECK-OUT
    //
    // ========================================================
    // ========================================================

    if (
      normalizedAction === "check_out"
    ) {


      // ======================================================
      // 19. CHECKOUT STATUS VALIDATION
      // ======================================================
      //
      // Only OCCUPIED bookings can be checked out.
      //
      // 5 = OCCUPIED
      //
      // ======================================================

      if (
        booking.bkg_status !== 5
      ) {

        return res.status(409).json({

          success: false,

          status: 409,

          error:
            "INVALID_STATUS",

          message:
            "Only Occupied bookings can be checked out",

          current_status:
            booking.bkg_status,

          required_status:
            5

        });

      }


      // ======================================================
      // 20. MUST HAVE ACTUAL CHECK-IN
      // ======================================================

      if (
        !booking.actual_check_in_date
      ) {

        return res.status(409).json({

          success: false,

          status: 409,

          error:
            "NOT_CHECKED_IN",

          message:
            "Guest must be checked in before checkout"

        });

      }


      // ======================================================
      // 21. MUST NOT ALREADY BE CHECKED OUT
      // ======================================================

      if (
        booking.actual_check_out_date
      ) {

        return res.status(409).json({

          success: false,

          status: 409,

          error:
            "ALREADY_CHECKED_OUT",

          message:
            "Booking is already checked out",

          actual_check_out_date:
            booking.actual_check_out_date

        });

      }


      // ======================================================
      // 22. PLANNED CHECKOUT DATE REQUIRED
      // ======================================================

      if (
        !booking.planned_check_out_date
      ) {

        return res.status(409).json({

          success: false,

          status: 409,

          error:
            "NO_CHECK_OUT_DATE",

          message:
            "Booking does not have a planned check-out date"

        });

      }


      // ======================================================
      // 23. CHECKOUT MUST BE TODAY
      // ======================================================

      const plannedCheckOut =
        new Date(
          booking.planned_check_out_date
        );


      if (
        plannedCheckOut < startOfToday ||
        plannedCheckOut > endOfToday
      ) {

        return res.status(409).json({

          success: false,

          status: 409,

          error:
            "NOT_TODAY",

          message:
            "Only today's check-outs can be completed",

          planned_check_out_date:
            booking.planned_check_out_date

        });

      }


      // ======================================================
      // 24. CHECKOUT TRANSACTION
      // ======================================================

      const result =
        await prisma.$transaction(
          async (tx) => {


            // =================================================
            // UPDATE BOOKING
            //
            // 5 OCCUPIED
            //      ↓
            // 3 VACANT
            // =================================================

            const updatedBooking =
              await tx.dy_pg_bookings.update({

                where: {

                  id:
                    booking.id

                },

                data: {

                  bkg_status:
                    3,

                  actual_check_out_date:
                    now,

                  modified_time:
                    now,

                  ...(modifiedBy !== null
                    ? {
                        modified_by:
                          modifiedBy
                      }
                    : {})

                },

                select: {

                  id: true,

                  bkg_no: true,

                  pg_id: true,

                  room_id: true,

                  bed_id: true,

                  guest_id: true,

                  planned_check_in_date: true,

                  actual_check_in_date: true,

                  planned_check_out_date: true,

                  actual_check_out_date: true,

                  bkg_status: true

                }

              });


            // =================================================
            // UPDATE BED
            //
            // 5 OCCUPIED
            //      ↓
            // 3 VACANT
            // =================================================

            let updatedBed = null;


            if (
              booking.bed_id !== null &&
              booking.bed_id !== undefined
            ) {

              updatedBed =
                await tx.dy_pg_bed_info.update({

                  where: {

                    id:
                      booking.bed_id

                  },

                  data: {

                    bed_status:
                      3

                  },

                  select: {

                    id: true,

                    room_info: true,

                    bed_number: true,

                    bed_status: true

                  }

                });

            }


            return {

              updatedBooking,

              updatedBed

            };

          }
        );


      // ======================================================
      // 25. CHECKOUT SUCCESS RESPONSE
      // ======================================================

      return res.status(200).json({

        success: true,

        status: 200,

        message:
          "Check-out completed successfully",

        action:
          "check_out",

        data: {

          booking: {

            id:
              result.updatedBooking.id,

            booking_no:
              result.updatedBooking.bkg_no,

            pg_id:
              result.updatedBooking.pg_id,

            room_id:
              result.updatedBooking.room_id,

            bed_id:
              result.updatedBooking.bed_id,

            guest_id:
              result.updatedBooking.guest_id,

            planned_check_in_date:
              result.updatedBooking
                .planned_check_in_date,

            actual_check_in_date:
              result.updatedBooking
                .actual_check_in_date,

            planned_check_out_date:
              result.updatedBooking
                .planned_check_out_date,

            actual_check_out_date:
              result.updatedBooking
                .actual_check_out_date,

            booking_status:
              result.updatedBooking
                .bkg_status,

            status:
              "VACANT"

          },


          bed:
            result.updatedBed
              ? {

                  id:
                    result.updatedBed.id,

                  room_id:
                    result.updatedBed.room_info,

                  bed_number:
                    result.updatedBed.bed_number,

                  bed_status:
                    result.updatedBed.bed_status,

                  status:
                    "VACANT"

                }

              : null

        }

      });

    }


  } catch (error) {

    // ========================================================
    // 26. ERROR HANDLING
    // ========================================================

    console.error(
      "UPDATE CHECK-IN CHECK-OUT ERROR:",
      error
    );


    return res.status(500).json({

      success: false,

      status: 500,

      error:
        "INTERNAL_SERVER_ERROR",

      message:
        "Failed to update check-in/check-out status",

      details:
        error.message

    });

  }

};


// ============================================================
// UPDATE CHECK-IN / CHECK-OUT STATUS
//
// ROUTE:
//
// PUT
// /api/pg/aggregate/manager/updateCheckInCheckout/updateRecord
//
// SUPPORTED REQUEST FORMAT 1:
//
// {
//   "fields": {
//     "booking_id": 572,
//     "action": "check_in",
//     "user_id": 536
//   }
// }
//
// SUPPORTED REQUEST FORMAT 2:
//
// {
//   "booking_id": 572,
//   "action": "check_in",
//   "user_id": 536
// }
//
// ============================================================
//
// STATUS:
//
// 3 = Vacant
// 4 = Reserved
// 5 = Occupied
//
// CHECK-IN:
//
// bkg_status = 4
// actual_check_in_date = NULL
//
// After CHECK-IN:
//
// bkg_status = 5
// actual_check_in_date = NOW
// bed_status = 5
//
// CHECK-OUT:
//
// bkg_status = 5
// actual_check_in_date IS NOT NULL
// actual_check_out_date IS NULL
//
// After CHECK-OUT:
//
// bkg_status = 3
// actual_check_out_date = NOW
// bed_status = 3
//
// IMPORTANT:
//
// Future planned check-in dates are allowed.
//
// Example:
//
// planned_check_in_date = 2026-09-13 16:50:23
// bkg_status = 4
// actual_check_in_date = NULL
//
// CHECK-IN is allowed.
// ============================================================

export const updateCheckInCheckoutStatus = async (
  req,
  res
) => {

  try {

    // ========================================================
    // 1. REQUEST DATA
    //
    // Support both:
    //
    // req.body.fields
    //
    // and:
    //
    // req.body
    //
    // ========================================================

    const requestData =
      req.body?.fields &&
      typeof req.body.fields === "object"
        ? req.body.fields
        : req.body;


    const {
      booking_id,
      action,
      modified_by,
      user_id
    } = requestData || {};


    // ========================================================
    // 2. VALIDATE BOOKING ID
    // ========================================================

    const bookingId =
      Number(booking_id);


    if (
      !Number.isInteger(bookingId) ||
      bookingId <= 0
    ) {

      return res.status(400).json({

        success: false,

        status: 400,

        error: "BAD_REQUEST",

        message:
          "Valid booking_id is required"

      });

    }


    // ========================================================
    // 3. NORMALIZE ACTION
    //
    // Supports:
    //
    // check_in
    // CHECK_IN
    // Check_In
    //
    // check_out
    // CHECK_OUT
    // Check_Out
    //
    // ========================================================

    const normalizedAction =
      String(action || "")
        .trim()
        .toLowerCase();


    if (
      normalizedAction !== "check_in" &&
      normalizedAction !== "check_out"
    ) {

      return res.status(400).json({

        success: false,

        status: 400,

        error: "BAD_REQUEST",

        message:
          "action must be either check_in or check_out"

      });

    }


    // ========================================================
    // 4. MODIFIED BY
    //
    // Preferred:
    //
    // modified_by
    //
    // Also supports:
    //
    // user_id
    //
    // ========================================================

    const modifiedByRaw =
      modified_by ??
      user_id;


    const modifiedBy =
      Number(modifiedByRaw);


    if (
      !Number.isInteger(modifiedBy) ||
      modifiedBy <= 0
    ) {

      return res.status(400).json({

        success: false,

        status: 400,

        error: "BAD_REQUEST",

        message:
          "Valid modified_by or user_id is required"

      });

    }


    // ========================================================
    // 5. GET BOOKING
    // ========================================================

    const booking =
      await prisma.dy_pg_bookings.findUnique({

        where: {

          id: bookingId

        },

        select: {

          id: true,

          bkg_no: true,

          pg_id: true,

          room_id: true,

          bed_id: true,

          guest_id: true,

          planned_check_in_date: true,

          actual_check_in_date: true,

          planned_check_out_date: true,

          actual_check_out_date: true,

          bkg_status: true,

          modified_time: true,

          modified_by: true

        }

      });


    // ========================================================
    // 6. BOOKING NOT FOUND
    // ========================================================

    if (!booking) {

      return res.status(404).json({

        success: false,

        status: 404,

        error: "NOT_FOUND",

        message:
          "Booking not found",

        booking_id:
          bookingId

      });

    }


    // ========================================================
    // 7. CURRENT DATE/TIME
    // ========================================================

    const now =
      new Date();


    // ========================================================
    // 8. CHECK-IN
    // ========================================================

    if (
      normalizedAction === "check_in"
    ) {

      // ------------------------------------------------------
      // 8.1 BOOKING MUST BE RESERVED
      //
      // 4 = Reserved
      // ------------------------------------------------------

      if (
        booking.bkg_status !== 4
      ) {

        return res.status(409).json({

          success: false,

          status: 409,

          error: "INVALID_STATUS",

          message:
            "Only reserved bookings can be checked in",

          booking_id:
            booking.id,

          bkg_status:
            booking.bkg_status

        });

      }


      // ------------------------------------------------------
      // 8.2 ACTUAL CHECK-IN MUST BE NULL
      //
      // Prevent duplicate check-in.
      // ------------------------------------------------------

      if (
        booking.actual_check_in_date !== null
      ) {

        return res.status(409).json({

          success: false,

          status: 409,

          error: "ALREADY_CHECKED_IN",

          message:
            "Booking is already checked in",

          booking_id:
            booking.id,

          actual_check_in_date:
            booking.actual_check_in_date

        });

      }


      // ======================================================
      // 8.3 NO DATE RESTRICTION FOR CHECK-IN
      //
      // IMPORTANT:
      //
      // We DO NOT check whether planned_check_in_date
      // is today.
      //
      // Therefore all of these are allowed:
      //
      // Today
      // Tomorrow
      // Day after tomorrow
      // Any future date
      //
      // PROVIDED:
      //
      // bkg_status = 4
      // actual_check_in_date = NULL
      //
      // ======================================================


      // ------------------------------------------------------
      // 8.4 UPDATE BOOKING + BED
      //
      // Both are updated inside one transaction.
      // ------------------------------------------------------

      const result =
        await prisma.$transaction(
          async (tx) => {

            // ==================================================
            // UPDATE BOOKING
            // ==================================================

            const updatedBooking =
              await tx.dy_pg_bookings.update({

                where: {

                  id: booking.id

                },

                data: {

                  // ------------------------------------------
                  // 4 Reserved → 5 Occupied
                  // ------------------------------------------

                  bkg_status: 5,

                  // ------------------------------------------
                  // Actual check-in date/time
                  // ------------------------------------------

                  actual_check_in_date:
                    now,

                  // ------------------------------------------
                  // Modified information
                  // ------------------------------------------

                  modified_time:
                    now,

                  modified_by:
                    modifiedBy

                },

                select: {

                  id: true,

                  bkg_no: true,

                  pg_id: true,

                  room_id: true,

                  bed_id: true,

                  guest_id: true,

                  planned_check_in_date: true,

                  actual_check_in_date: true,

                  planned_check_out_date: true,

                  actual_check_out_date: true,

                  bkg_status: true,

                  modified_time: true,

                  modified_by: true

                }

              });


            // ==================================================
            // UPDATE BED
            // ==================================================

            let updatedBed = null;


            if (
              booking.bed_id !== null &&
              booking.bed_id !== undefined
            ) {

              updatedBed =
                await tx.dy_pg_bed_info.update({

                  where: {

                    id: booking.bed_id

                  },

                  data: {

                    // ----------------------------------------
                    // 5 = Occupied
                    // ----------------------------------------

                    bed_status: 5

                  },

                  select: {

                    id: true,

                    room_info: true,

                    bed_number: true,

                    bed_status: true

                  }

                });

            }


            // ==================================================
            // RETURN TRANSACTION DATA
            // ==================================================

            return {

              updatedBooking,

              updatedBed

            };

          }

        );


      // ======================================================
      // 8.5 CHECK-IN SUCCESS RESPONSE
      // ======================================================

      return res.status(200).json({

        success: true,

        status: 200,

        message:
          "Check-in completed successfully",

        data: {

          booking_id:
            result.updatedBooking.id,

          booking_no:
            result.updatedBooking.bkg_no,

          pg_id:
            result.updatedBooking.pg_id,

          room_id:
            result.updatedBooking.room_id,

          bed_id:
            result.updatedBooking.bed_id,

          guest_id:
            result.updatedBooking.guest_id,

          action:
            "check_in",

          planned_check_in_date:
            result.updatedBooking
              .planned_check_in_date,

          actual_check_in_date:
            result.updatedBooking
              .actual_check_in_date,

          planned_check_out_date:
            result.updatedBooking
              .planned_check_out_date,

          actual_check_out_date:
            result.updatedBooking
              .actual_check_out_date,

          booking_status:
            result.updatedBooking
              .bkg_status,

          bed_status:
            result.updatedBed
              ?.bed_status ??
            null,

          modified_by:
            result.updatedBooking
              .modified_by,

          modified_time:
            result.updatedBooking
              .modified_time

        }

      });

    }


    // ========================================================
    // 9. CHECK-OUT
    // ========================================================

    if (
      normalizedAction === "check_out"
    ) {

      // ------------------------------------------------------
      // 9.1 BOOKING MUST BE OCCUPIED
      //
      // 5 = Occupied
      // ------------------------------------------------------

      if (
        booking.bkg_status !== 5
      ) {

        return res.status(409).json({

          success: false,

          status: 409,

          error: "INVALID_STATUS",

          message:
            "Only occupied bookings can be checked out",

          booking_id:
            booking.id,

          bkg_status:
            booking.bkg_status

        });

      }


      // ------------------------------------------------------
      // 9.2 CHECK-IN MUST HAVE HAPPENED
      // ------------------------------------------------------

      if (
        booking.actual_check_in_date === null
      ) {

        return res.status(409).json({

          success: false,

          status: 409,

          error: "NOT_CHECKED_IN",

          message:
            "Booking must be checked in before checkout",

          booking_id:
            booking.id

        });

      }


      // ------------------------------------------------------
      // 9.3 PREVENT DUPLICATE CHECKOUT
      // ------------------------------------------------------

      if (
        booking.actual_check_out_date !== null
      ) {

        return res.status(409).json({

          success: false,

          status: 409,

          error: "ALREADY_CHECKED_OUT",

          message:
            "Booking is already checked out",

          booking_id:
            booking.id,

          actual_check_out_date:
            booking.actual_check_out_date

        });

      }


      // ======================================================
      // 9.4 CHECKOUT DATE VALIDATION
      //
      // Existing business rule is retained:
      //
      // planned_check_out_date must be TODAY.
      //
      // ======================================================

      if (
        booking.planned_check_out_date
      ) {

        const plannedCheckout =
          new Date(
            booking.planned_check_out_date
          );


        // ----------------------------------------------------
        // Start of today
        // ----------------------------------------------------

        const startOfToday =
          new Date(now);

        startOfToday.setHours(
          0,
          0,
          0,
          0
        );


        // ----------------------------------------------------
        // End of today
        // ----------------------------------------------------

        const endOfToday =
          new Date(now);

        endOfToday.setHours(
          23,
          59,
          59,
          999
        );


        // ----------------------------------------------------
        // Validate checkout date
        // ----------------------------------------------------

        if (
          plannedCheckout < startOfToday ||
          plannedCheckout > endOfToday
        ) {

          return res.status(409).json({

            success: false,

            status: 409,

            error: "NOT_TODAY",

            message:
              "Only today's checkouts can be completed",

            planned_check_out_date:
              booking.planned_check_out_date

          });

        }

      }


      // ======================================================
      // 9.5 UPDATE BOOKING + BED
      // ======================================================

      const result =
        await prisma.$transaction(
          async (tx) => {

            // ==================================================
            // UPDATE BOOKING
            // ==================================================

            const updatedBooking =
              await tx.dy_pg_bookings.update({

                where: {

                  id: booking.id

                },

                data: {

                  // ------------------------------------------
                  // 5 Occupied → 3 Vacant
                  // ------------------------------------------

                  bkg_status: 3,

                  // ------------------------------------------
                  // Actual checkout date/time
                  // ------------------------------------------

                  actual_check_out_date:
                    now,

                  // ------------------------------------------
                  // Modified information
                  // ------------------------------------------

                  modified_time:
                    now,

                  modified_by:
                    modifiedBy

                },

                select: {

                  id: true,

                  bkg_no: true,

                  pg_id: true,

                  room_id: true,

                  bed_id: true,

                  guest_id: true,

                  planned_check_in_date: true,

                  actual_check_in_date: true,

                  planned_check_out_date: true,

                  actual_check_out_date: true,

                  bkg_status: true,

                  modified_time: true,

                  modified_by: true

                }

              });


            // ==================================================
            // UPDATE BED
            // ==================================================

            let updatedBed = null;


            if (
              booking.bed_id !== null &&
              booking.bed_id !== undefined
            ) {

              updatedBed =
                await tx.dy_pg_bed_info.update({

                  where: {

                    id: booking.bed_id

                  },

                  data: {

                    // ----------------------------------------
                    // 3 = Vacant
                    // ----------------------------------------

                    bed_status: 3

                  },

                  select: {

                    id: true,

                    room_info: true,

                    bed_number: true,

                    bed_status: true

                  }

                });

            }


            // ==================================================
            // RETURN TRANSACTION DATA
            // ==================================================

            return {

              updatedBooking,

              updatedBed

            };

          }

        );


      // ======================================================
      // 9.6 CHECK-OUT SUCCESS RESPONSE
      // ======================================================

      return res.status(200).json({

        success: true,

        status: 200,

        message:
          "Check-out completed successfully",

        data: {

          booking_id:
            result.updatedBooking.id,

          booking_no:
            result.updatedBooking.bkg_no,

          pg_id:
            result.updatedBooking.pg_id,

          room_id:
            result.updatedBooking.room_id,

          bed_id:
            result.updatedBooking.bed_id,

          guest_id:
            result.updatedBooking.guest_id,

          action:
            "check_out",

          planned_check_in_date:
            result.updatedBooking
              .planned_check_in_date,

          actual_check_in_date:
            result.updatedBooking
              .actual_check_in_date,

          planned_check_out_date:
            result.updatedBooking
              .planned_check_out_date,

          actual_check_out_date:
            result.updatedBooking
              .actual_check_out_date,

          booking_status:
            result.updatedBooking
              .bkg_status,

          bed_status:
            result.updatedBed
              ?.bed_status ??
            null,

          modified_by:
            result.updatedBooking
              .modified_by,

          modified_time:
            result.updatedBooking
              .modified_time

        }

      });

    }


  } catch (error) {

    // ========================================================
    // ERROR HANDLING
    // ========================================================

    console.error(
      "updateCheckInCheckoutStatus error:",
      error
    );


    return res.status(500).json({

      success: false,

      status: 500,

      error:
        "INTERNAL_SERVER_ERROR",

      message:
        "Failed to update check-in/check-out status",

      details:
        error.message

    });

  }

};


export const getResidentHome = async (req, res) => {
  try {
    // ==========================================================
    // 1. FRONTEND SENDS ONLY userId
    //
    // GET
    // /api/pg/aggregate/resident/home?userId=536
    // ==========================================================

    const userId = Number(req.query.userId);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid userId is required"
      });
    }

    // ==========================================================
    // 2. GET GUEST INFORMATION
    //
    // dy_user.id
    //      ↓
    // dy_pg_guest_info.user_id
    // ==========================================================

    const guest = await prisma.dy_pg_guest_info.findFirst({
      where: {
        user_id: userId
      },

      select: {
        id: true,
        guest_type: true,
        guest_status: true,
        perm_address: true,
        pg_id: true,
        user_id: true,
        emergency_contact_name: true
      },

      orderBy: {
        id: "asc"
      }
    });

    if (!guest) {
      return res.status(404).json({
        success: false,
        message: "Resident guest information not found"
      });
    }

    // ==========================================================
    // 3. GET PG ID INTERNALLY
    // ==========================================================

    const pgId = Number(guest.pg_id);

    if (!Number.isInteger(pgId) || pgId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid PG information for resident"
      });
    }

    // ==========================================================
    // 4. GET PG
    // ==========================================================

    const pg = await prisma.dy_pg_info.findUnique({
      where: {
        id: pgId
      },

      select: {
        id: true,
        pg_name: true,
        pg_owner: true
      }
    });

    if (!pg) {
      return res.status(404).json({
        success: false,
        message: "PG not found"
      });
    }

    // ==========================================================
    // 5. GET USER
    // ==========================================================

    const user = await prisma.dy_user.findUnique({
      where: {
        id: userId
      },

      select: {
        id: true,
        first_name: true,
        last_name: true,
        email_id: true,
        mobile_no: true
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // ==========================================================
    // 6. IF RESIDENT IS NOT ACTIVE
    // ==========================================================

    if (guest.guest_status !== 5) {
      return res.status(200).json({
        success: true,

        message: "Resident is not active",

        data: {
          pg: {
            id: pg.id,
            name: pg.pg_name
          },

          summary: {
            openRequests: 0,
            announcements: 0
          },

          resident: {
            guestId: guest.id,
            userId: user.id,

            name: `${user.first_name || ""} ${
              user.last_name || ""
            }`.trim(),

            mobile: user.mobile_no || null,
            email: user.email_id || null
          },

          recentRequests: [],

          latestAnnouncements: []
        }
      });
    }

    // ==========================================================
    // 7. GET CURRENT BOOKING
    //
    // IMPORTANT:
    //
    // bookings.guest_id = guest.id
    //
    // Frontend does NOT send guestId.
    // ==========================================================

    const booking = await prisma.dy_pg_bookings.findFirst({
      where: {
        pg_id: pgId,

        guest_id: guest.id,

        actual_check_out_date: null
      },

      orderBy: {
        id: "desc"
      },

      select: {
        id: true,

        guest_id: true,

        room_id: true,

        bed_id: true,

        planned_check_in_date: true,

        actual_check_in_date: true,

        planned_check_out_date: true,

        monthly_rent: true,

        notice_period_time: true,

        bkg_status: true
      }
    });

    // ==========================================================
    // 8. GET ROOM
    // ==========================================================

    let room = null;

    if (booking?.room_id) {
      room = await prisma.dy_pg_room_info.findUnique({
        where: {
          id: booking.room_id
        },

        select: {
          id: true,
          room_name: true,
          room_type: true,
          floor_info: true,
          bathroom_type: true,
          has_tv: true,
          has_ac: true,
          has_balcony: true
        }
      });
    }

    // ==========================================================
    // 9. GET BED
    // ==========================================================

    let bed = null;

    if (booking?.bed_id) {
      bed = await prisma.dy_pg_bed_info.findUnique({
        where: {
          id: booking.bed_id
        },

        select: {
          id: true,
          bed_number: true,
          bed_status: true
        }
      });
    }

    // ==========================================================
    // 10. GET RESIDENT'S OPEN REQUEST COUNT
    //
    // IMPORTANT:
    //
    // OLD CODE:
    //
    // pg_id = pgId
    //
    // That gives ALL residents' requests.
    //
    // NEW CODE:
    //
    // requestor_info = userId
    //
    // That gives ONLY logged-in resident's requests.
    // ==========================================================

    const openRequests =
      await prisma.dy_pg_srv_reqs.count({
        where: {
          requestor_info: userId,

          pg_id: pgId,

          service_status: {
            in: [11, 12]
          }
        }
      });

    // ==========================================================
    // 11. GET RECENT REQUESTS
    //
    // ONLY THIS RESIDENT
    //
    // requestor_info = userId
    // ==========================================================

    const recentRequests =
      await prisma.dy_pg_srv_reqs.findMany({
        where: {
          requestor_info: userId,

          pg_id: pgId
        },

        orderBy: {
          request_create_date: "desc"
        },

        take: 3,

        select: {
          id: true,

          service_title: true,

          service_description: true,

          request_create_date: true,

          request_eta_date: true,

          SLA: true,

          service_category: true,

          service_status: true,

          pg_id: true,

          feedback: true,

          feedback_summary: true
        }
      });

    // ==========================================================
    // 12. GET ANNOUNCEMENTS
    // ==========================================================

    const announcements =
      await prisma.dy_pg_events_info.findMany({
        where: {
          pg_id: pgId
        },

        orderBy: {
          event_date: "desc"
        },

        take: 3,

        select: {
          id: true,

          event_date: true,

          event_title: true,

          event_description: true
        }
      });

    // ==========================================================
    // 13. RENT
    // ==========================================================

    const monthlyRent = Number(
      booking?.monthly_rent || 0
    );

    // ==========================================================
    // 14. BUILD RESIDENT
    // ==========================================================

    const resident = {
      guestId: guest.id,

      userId: user.id,

      name: `${user.first_name || ""} ${
        user.last_name || ""
      }`.trim(),

      mobile: user.mobile_no || null,

      email: user.email_id || null,

      stay: {
        bookingId: booking?.id || null,

        room: {
          id: room?.id || null,

          name: room?.room_name || null
        },

        bed: {
          id: bed?.id || null,

          number: bed?.bed_number || null
        },

        joinedOn:
          booking?.actual_check_in_date ||
          booking?.planned_check_in_date ||
          null,

        expectedCheckout:
          booking?.planned_check_out_date ||
          null,

        status: "Active"
      },

      rentStatus: {
        monthlyRent,

        status:
          monthlyRent > 0
            ? "Due"
            : "Paid"
      }
    };

    // ==========================================================
    // 15. FORMAT RECENT REQUESTS
    // ==========================================================

    const formattedRecentRequests =
      recentRequests.map((request) => ({
        id: request.id,

        title: request.service_title,

        description:
          request.service_description,

        createdAt:
          request.request_create_date,

        etaDate:
          request.request_eta_date,

        SLA: request.SLA,

        categoryId:
          request.service_category,

        statusId:
          request.service_status,

        feedback:
          request.feedback,

        feedbackSummary:
          request.feedback_summary,

        pgId:
          request.pg_id
      }));

    // ==========================================================
    // 16. FINAL RESPONSE
    // ==========================================================

    return res.status(200).json({
      success: true,

      message:
        "Resident home dashboard fetched successfully",

      data: {
        pg: {
          id: pg.id,

          name: pg.pg_name
        },

        summary: {
          openRequests,

          announcements:
            announcements.length
        },

        resident,

        recentRequests:
          formattedRecentRequests,

        latestAnnouncements:
          announcements.map(
            (announcement) => ({
              id: announcement.id,

              title:
                announcement.event_title,

              description:
                announcement.event_description,

              date:
                announcement.event_date
            })
          )
      }
    });

  } catch (error) {
    console.error(
      "Resident home dashboard error:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to fetch resident home dashboard",

      error: error.message
    });
  }
};

export const getResidentMyStay = async (req, res) => {
  try {
    // ==========================================================
    // USER ID
    //
    // Frontend:
    //
    // GET /api/resident/my-stay?user_id=10
    //
    // ==========================================================

    const userId = Number(req.query.user_id);

    // ==========================================================
    // VALIDATION
    // ==========================================================

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid user_id is required"
      });
    }

    // ==========================================================
    // HELPER
    // ==========================================================

    const getFullName = (firstName, lastName) => {
      return (
        `${firstName || ""} ${lastName || ""}`.trim() || null
      );
    };

    // ==========================================================
    // 1. GET USER
    // ==========================================================

    const user = await prisma.dy_user.findUnique({
      where: {
        id: userId
      },

      select: {
        id: true,
        first_name: true,
        last_name: true,
        email_id: true,
        mobile_no: true
      }
    });

    // ==========================================================
    // USER NOT FOUND
    // ==========================================================

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // ==========================================================
    // 2. GET ACTIVE GUEST
    //
    // dy_pg_guest_info.user_id = dy_user.id
    //
    // guest_status = 5 => Active
    //
    // ==========================================================

    const guest = await prisma.dy_pg_guest_info.findFirst({
      where: {
        user_id: userId,
        guest_status: 5
      },

      orderBy: {
        id: "desc"
      },

      select: {
        id: true,
        guest_type: true,
        guest_status: true,
        perm_address: true,
        pg_id: true,
        user_id: true,
        emergency_contact: true,
        emergency_contact_name: true
      }
    });

    // ==========================================================
    // GUEST NOT FOUND
    // ==========================================================

    if (!guest) {
      return res.status(404).json({
        success: false,
        message:
          "Active guest information not found for this user"
      });
    }

    // ==========================================================
    // 3. GET PG
    //
    // pg_id comes from guest
    //
    // ==========================================================

    const pgId = Number(guest.pg_id);

    if (!Number.isInteger(pgId) || pgId <= 0) {
      return res.status(404).json({
        success: false,
        message: "Valid PG not found for this guest"
      });
    }

    const pg = await prisma.dy_pg_info.findUnique({
      where: {
        id: pgId
      },

      select: {
        id: true,
        pg_name: true,
        pg_owner: true
      }
    });

    // ==========================================================
    // PG NOT FOUND
    // ==========================================================

    if (!pg) {
      return res.status(404).json({
        success: false,
        message: "PG not found for this guest"
      });
    }

    // ==========================================================
    // 4. GET MANAGERS
    //
    // IMPORTANT:
    //
    // DO NOT USE pg.pg_owner
    //
    // Manager is determined by:
    //
    // dy_pg_usr_map
    //      |
    //      | pg_id
    //      ↓
    // user_id
    //      |
    //      ↓
    // dy_user_roles
    //      |
    //      | role_id = 3
    //      | is_active = 1
    //      ↓
    // dy_user
    //
    // ==========================================================

    // ----------------------------------------------------------
    // STEP 4.1
    // Get users mapped to this PG
    // ----------------------------------------------------------

    const pgUserMappings =
      await prisma.dy_pg_usr_map.findMany({
        where: {
          pg_id: pgId
        },

        select: {
          user_id: true
        }
      });

    // ----------------------------------------------------------
    // STEP 4.2
    // Extract user IDs
    // ----------------------------------------------------------

    const mappedUserIds = [
      ...new Set(
        pgUserMappings
          .map((item) => item.user_id)
          .filter(
            (id) =>
              id !== null &&
              id !== undefined
          )
      )
    ];

    // ----------------------------------------------------------
    // STEP 4.3
    // Find users having Manager role
    //
    // role_id = 3 => Manager
    //
    // ----------------------------------------------------------

    const managerRoleUsers =
      mappedUserIds.length > 0
        ? await prisma.dy_user_roles.findMany({
            where: {
              user_id: {
                in: mappedUserIds
              },

              role_id: 3,

              is_active: 1
            },

            select: {
              user_id: true
            },

            orderBy: {
              id: "asc"
            }
          })
        : [];

    // ----------------------------------------------------------
    // STEP 4.4
    // Manager user IDs
    // ----------------------------------------------------------

    const managerUserIds = [
      ...new Set(
        managerRoleUsers
          .map((item) => item.user_id)
          .filter(Boolean)
      )
    ];

    // ----------------------------------------------------------
    // STEP 4.5
    // Get manager users
    // ----------------------------------------------------------

    const managerUsers =
      managerUserIds.length > 0
        ? await prisma.dy_user.findMany({
            where: {
              id: {
                in: managerUserIds
              }
            },

            select: {
              id: true,
              first_name: true,
              last_name: true,
              mobile_no: true,
              email_id: true
            }
          })
        : [];

    // ----------------------------------------------------------
    // STEP 4.6
    // Manager response
    // ----------------------------------------------------------

    const managers = managerUsers.map(
      (manager) => ({
        id: manager.id,

        name: getFullName(
          manager.first_name,
          manager.last_name
        ),

        mobile:
          manager.mobile_no || null,

        email:
          manager.email_id || null
      })
    );

    // ==========================================================
    // 5. GET CURRENT BOOKING
    //
    // guest.id = booking.guest_id
    //
    // actual_check_out_date = null
    // => current stay
    //
    // ==========================================================

    const booking =
      await prisma.dy_pg_bookings.findFirst({
        where: {
          pg_id: pgId,

          guest_id: guest.id,

          actual_check_out_date: null
        },

        orderBy: {
          id: "desc"
        },

        select: {
          id: true,
          pg_id: true,
          room_id: true,
          bed_id: true,

          planned_check_in_date: true,
          actual_check_in_date: true,

          planned_check_out_date: true,
          actual_check_out_date: true,

          monthly_rent: true,
          notice_period_time: true,

          bkg_status: true
        }
      });

    // ==========================================================
    // 6. RESIDENT RESPONSE
    //
    // This is used in both cases:
    //
    // - booking exists
    // - booking doesn't exist
    //
    // ==========================================================

    const residentBasicResponse = {
      guestId: guest.id,

      userId: guest.user_id,

      name: getFullName(
        user.first_name,
        user.last_name
      ),

      firstName:
        user.first_name || null,

      lastName:
        user.last_name || null,

      mobile:
        user.mobile_no || null,

      email:
        user.email_id || null,

      guestType:
        guest.guest_type,

      guestStatus:
        guest.guest_status
    };

    // ==========================================================
    // 7. NO CURRENT BOOKING
    // ==========================================================

    if (!booking) {
      return res.status(200).json({
        success: true,

        message:
          "Resident found but no current stay found",

        data: {
          pg: {
            id: pg.id,

            name: pg.pg_name
          },

          totalResidents: 1,

          residents: [
            {
              resident:
                residentBasicResponse,

              stay: null,

              roomDetails: null,

              roommates: [],

              amenities: [],

              managers,

              noticeCheckout: null
            }
          ]
        }
      });
    }

    // ==========================================================
    // 8. GET ROOM
    // ==========================================================

    const room =
      booking.room_id
        ? await prisma.dy_pg_room_info.findUnique({
            where: {
              id: booking.room_id
            },

            select: {
              id: true,
              room_name: true,
              room_type: true,
              floor_info: true,
              bathroom_type: true,
              has_tv: true,
              has_ac: true,
              has_balcony: true
            }
          })
        : null;

    // ==========================================================
    // 9. GET BED
    // ==========================================================

    const bed =
      booking.bed_id
        ? await prisma.dy_pg_bed_info.findUnique({
            where: {
              id: booking.bed_id
            },

            select: {
              id: true,
              bed_number: true,
              bed_status: true
            }
          })
        : null;

    // ==========================================================
    // 10. GET ROOM TYPE
    // ==========================================================

    const roomType =
      room?.room_type
        ? await prisma.st_pg_room_type.findUnique({
            where: {
              id: room.room_type
            },

            select: {
              id: true,
              nbeds: true,
              occupancy: true
            }
          })
        : null;

    // ==========================================================
    // 11. GET FLOOR
    // ==========================================================

    const floor =
      room?.floor_info
        ? await prisma.st_pg_floors.findUnique({
            where: {
              id: room.floor_info
            },

            select: {
              id: true,
              floor: true
            }
          })
        : null;

    // ==========================================================
    // 12. GET ROOMMATES
    //
    // Same PG
    // Same room
    // Current booking
    // Exclude current guest
    //
    // ==========================================================

    const roommateBookings =
      await prisma.dy_pg_bookings.findMany({
        where: {
          pg_id: pgId,

          room_id: booking.room_id,

          actual_check_out_date: null,

          guest_id: {
            not: guest.id
          }
        },

        orderBy: {
          id: "asc"
        },

        select: {
          id: true,
          guest_id: true,
          bed_id: true
        }
      });

    // ==========================================================
    // 13. ROOMMATE GUEST IDS
    // ==========================================================

    const roommateGuestIds =
      roommateBookings
        .map(
          (item) =>
            item.guest_id
        )
        .filter(Boolean);

    // ==========================================================
    // 14. ROOMMATE GUESTS
    // ==========================================================

    const roommateGuests =
      roommateGuestIds.length > 0
        ? await prisma.dy_pg_guest_info.findMany({
            where: {
              id: {
                in: roommateGuestIds
              },

              pg_id: pgId,

              guest_status: 5
            },

            select: {
              id: true,
              user_id: true
            }
          })
        : [];

    // ==========================================================
    // 15. ROOMMATE USER IDS
    // ==========================================================

    const roommateUserIds =
      roommateGuests
        .map(
          (item) =>
            item.user_id
        )
        .filter(Boolean);

    // ==========================================================
    // 16. ROOMMATE USERS
    // ==========================================================

    const roommateUsers =
      roommateUserIds.length > 0
        ? await prisma.dy_user.findMany({
            where: {
              id: {
                in: roommateUserIds
              }
            },

            select: {
              id: true,
              first_name: true,
              last_name: true,
              mobile_no: true
            }
          })
        : [];

    // ==========================================================
    // 17. ROOMMATE RESPONSE
    // ==========================================================

    const roommates =
      roommateBookings.map(
        (roommateBooking) => {
          const roommateGuest =
            roommateGuests.find(
              (item) =>
                item.id ===
                roommateBooking.guest_id
            );

          const roommateUser =
            roommateUsers.find(
              (item) =>
                item.id ===
                roommateGuest?.user_id
            );

          return {
            guestId:
              roommateGuest?.id ||
              null,

            userId:
              roommateGuest?.user_id ||
              null,

            name:
              roommateUser
                ? getFullName(
                    roommateUser.first_name,
                    roommateUser.last_name
                  )
                : null,

            mobile:
              roommateUser?.mobile_no ||
              null,

            bedId:
              roommateBooking.bed_id
          };
        }
      );

    // ==========================================================
    // 18. GET PG AMENITIES
    // ==========================================================

    const amenityMaps =
      await prisma.dy_pg_amns_map.findMany({
        where: {
          pg_info: pgId
        },

        select: {
          amns_info: true
        }
      });

    // ==========================================================
    // 19. AMENITY IDS
    // ==========================================================

    const amenityIds =
      amenityMaps
        .map(
          (item) =>
            item.amns_info
        )
        .filter(Boolean);

    // ==========================================================
    // 20. GET AMENITIES
    // ==========================================================

    const amenities =
      amenityIds.length > 0
        ? await prisma.st_pg_amns.findMany({
            where: {
              id: {
                in: amenityIds
              },

              rstatus: 1
            },

            select: {
              id: true,
              amenity_name: true
            }
          })
        : [];

    // ==========================================================
    // 21. STAY DATES
    // ==========================================================

    const joinedDate =
      booking.actual_check_in_date ||
      booking.planned_check_in_date;

    const checkoutDate =
      booking.planned_check_out_date;

    // ==========================================================
    // 22. DURATION
    // ==========================================================

    const calculateDuration = (
      start,
      end
    ) => {
      if (!start) {
        return {
          months: 0,

          text: "0 months"
        };
      }

      const startDate =
        new Date(start);

      const endDate =
        end
          ? new Date(end)
          : new Date();

      let months =
        (endDate.getFullYear() -
          startDate.getFullYear()) *
          12 +
        (endDate.getMonth() -
          startDate.getMonth());

      if (
        endDate.getDate() <
        startDate.getDate()
      ) {
        months--;
      }

      months = Math.max(
        months,
        0
      );

      return {
        months,

        text:
          months === 1
            ? "1 month"
            : `${months} months`
      };
    };

    const duration =
      calculateDuration(
        joinedDate,
        checkoutDate
      );

    // ==========================================================
    // 23. STAY STATUS
    // ==========================================================

    const stayStatus =
      guest.guest_status === 5
        ? "Active"
        : "Inactive";

    // ==========================================================
    // 24. WIFI
    // ==========================================================

    const wifiIncluded =
      amenities.some(
        (item) =>
          String(
            item.amenity_name
          )
            .toLowerCase()
            .trim() === "wifi"
      );

    // ==========================================================
    // 25. HOUSEKEEPING
    // ==========================================================

    const housekeepingIncluded =
      amenities.some(
        (item) =>
          String(
            item.amenity_name
          )
            .toLowerCase()
            .trim() ===
          "housekeeping"
      );

    // ==========================================================
    // 26. FINAL RESIDENT RESPONSE
    // ==========================================================

    const residentResponse = {
      // ========================================================
      // RESIDENT
      // ========================================================

      resident:
        residentBasicResponse,

      // ========================================================
      // STAY
      // ========================================================

      stay: {
        bookingId:
          booking.id,

        room: {
          id:
            room?.id || null,

          name:
            room?.room_name || null
        },

        bed: {
          id:
            bed?.id || null,

          number:
            bed?.bed_number || null
        },

        sharingType:
          roomType?.occupancy ||
          null,

        floor:
          floor?.floor ||
          null,

        joinedOn:
          joinedDate,

        expectedCheckout:
          checkoutDate,

        actualCheckout:
          booking.actual_check_out_date,

        status:
          stayStatus,

        duration
      },

      // ========================================================
      // ROOM DETAILS
      // ========================================================

      roomDetails: {
        roomId:
          room?.id || null,

        roomName:
          room?.room_name || null,

        sharingType:
          roomType?.occupancy ||
          null,

        numberOfBeds:
          roomType?.nbeds ||
          null,

        floor:
          floor?.floor ||
          null,

        bathroomType:
          room?.bathroom_type ||
          null,

        monthlyRent:
          Number(
            booking.monthly_rent || 0
          ),

        tv:
          Boolean(
            room?.has_tv
          ),

        ac:
          Boolean(
            room?.has_ac
          ),

        balcony:
          Boolean(
            room?.has_balcony
          ),

        wifiIncluded,

        housekeepingIncluded
      },

      // ========================================================
      // ROOMMATES
      // ========================================================

      roommates,

      // ========================================================
      // AMENITIES
      // ========================================================

      amenities:
        amenities.map(
          (amenity) => ({
            id:
              amenity.id,

            name:
              amenity.amenity_name
          })
        ),

      // ========================================================
      // MANAGERS
      //
      // IMPORTANT:
      //
      // We return ALL managers mapped to this PG.
      //
      // ========================================================

      managers,

      // ========================================================
      // NOTICE / CHECKOUT
      // ========================================================

      noticeCheckout: {
        expectedCheckout:
          checkoutDate,

        noticePeriodDays:
          Number(
            booking.notice_period_time ||
            0
          ),

        checkoutRequested:
          false
      }
    };

    // ==========================================================
    // 27. FINAL RESPONSE
    // ==========================================================

    return res.status(200).json({
      success: true,

      message:
        "Resident stay details fetched successfully",

      data: {
        pg: {
          id:
            pg.id,

          name:
            pg.pg_name
        },

        totalResidents: 1,

        residents: [
          residentResponse
        ]
      }
    });

  } catch (error) {
    // ==========================================================
    // ERROR
    // ==========================================================

    console.error(
      "Resident my stay error:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to fetch resident stay details",

      error:
        error.message
    });
  }
};

export const getMyServiceRequests = async (req, res) => {
  try {
    // =========================================================
    // 1. GET USER ID
    // =========================================================

    const userId = Number(req.query.user_id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid user_id is required"
      });
    }

    // =========================================================
    // 2. GET USER DETAILS
    // =========================================================

    const user = await prisma.dy_user.findUnique({
      where: {
        id: userId
      },

      select: {
        id: true,
        first_name: true,
        last_name: true,
        email_id: true,
        mobile_no: true
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // =========================================================
    // 3. GET GUEST / RESIDENT DETAILS
    // =========================================================

    const guest =
      await prisma.dy_pg_guest_info.findFirst({
        where: {
          user_id: userId
        },

        select: {
          id: true,
          user_id: true,
          pg_id: true
        },

        orderBy: {
          id: "desc"
        }
      });

    // =========================================================
    // 4. GET LATEST BOOKING
    // =========================================================

    let booking = null;

    if (guest?.id) {
      booking =
        await prisma.dy_pg_bookings.findFirst({
          where: {
            guest_id: guest.id
          },

          select: {
            id: true,
            bkg_no: true,
            pg_id: true,
            room_id: true,
            bed_id: true
          },

          orderBy: {
            id: "desc"
          }
        });
    }

    // =========================================================
    // 5. GET ROOM
    // =========================================================

    let room = null;

    if (booking?.room_id) {
      room =
        await prisma.dy_pg_room_info.findUnique({
          where: {
            id: booking.room_id
          },

          select: {
            id: true,
            room_name: true
          }
        });
    }

    // =========================================================
    // 6. GET SERVICE REQUESTS
    //
    // requestor_info -> dy_user.id
    // service_category -> st_pg_srv_cat.id
    // service_status -> st_pg_cur_sts.id
    // request_assigned_to -> dy_user.id
    // =========================================================

    const serviceRequests =
      await prisma.dy_pg_srv_reqs.findMany({
        where: {
          requestor_info: userId
        },

        select: {
          id: true,

          requestor_info: true,

          request_assigned_to: true,

          service_title: true,

          service_description: true,

          request_create_date: true,

          request_eta_date: true,

          SLA: true,

          feedback: true,

          service_category: true,

          service_status: true,

          pg_id: true,

          feedback_summary: true,

          // ---------------------------------------------------
          // STATUS
          // ---------------------------------------------------

          st_pg_cur_sts: {
            select: {
              id: true,
              status_code: true
            }
          },

          // ---------------------------------------------------
          // SERVICE CATEGORY
          // ---------------------------------------------------

          st_pg_srv_cat: {
            select: {
              id: true,
              service_category: true,
              resolve_timeline: true
            }
          },

          // ---------------------------------------------------
          // ASSIGNED STAFF / MANAGER
          // ---------------------------------------------------

          dy_user_dy_pg_srv_reqs_request_assigned_toTody_user: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              mobile_no: true,
              email_id: true
            }
          }
        },

        orderBy: {
          id: "desc"
        }
      });

    // =========================================================
    // 7. OVERDUE CALCULATION
    // =========================================================

    const getOverdueDays = (etaDate) => {
      if (!etaDate) {
        return 0;
      }

      const eta = new Date(etaDate);

      if (Number.isNaN(eta.getTime())) {
        return 0;
      }

      const today = new Date();

      const todayStart = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      );

      const etaStart = new Date(
        eta.getFullYear(),
        eta.getMonth(),
        eta.getDate()
      );

      // ETA is today or in future
      if (etaStart >= todayStart) {
        return 0;
      }

      return Math.floor(
        (
          todayStart.getTime() -
          etaStart.getTime()
        ) /
        (1000 * 60 * 60 * 24)
      );
    };

    // =========================================================
    // 8. BUILD REQUEST DATA
    // =========================================================

    const data = serviceRequests.map((request) => {

      const overdueDays =
        getOverdueDays(
          request.request_eta_date
        );

      const status =
        request.st_pg_cur_sts;

      const category =
        request.st_pg_srv_cat;

      const assignedUser =
        request
          .dy_user_dy_pg_srv_reqs_request_assigned_toTody_user;

      // -------------------------------------------------------
      // STATUS CODE
      // -------------------------------------------------------

      const statusCode =
        status?.status_code || null;

      // -------------------------------------------------------
      // NORMALIZED STATUS
      //
      // Database:
      // 11 = Open
      // 12 = In Progress
      // 13 = Resolved
      // -------------------------------------------------------

      let statusName = "Unknown";

      if (request.service_status === 11) {
        statusName = "Open";
      }

      if (request.service_status === 12) {
        statusName = "In Progress";
      }

      if (request.service_status === 13) {
        statusName = "Resolved";
      }

      // -------------------------------------------------------
      // OVERDUE
      // -------------------------------------------------------

      const isOverdue =
        overdueDays > 0 &&
        request.service_status !== 13;

      // -------------------------------------------------------
      // RETURN REQUEST
      // -------------------------------------------------------

      return {
        id: request.id,

        title:
          request.service_title || null,

        description:
          request.service_description || null,

        createdAt:
          request.request_create_date || null,

        etaDate:
          request.request_eta_date || null,

        SLA:
          request.SLA || null,

        feedback:
          request.feedback || null,

        feedbackSummary:
          request.feedback_summary || null,

        // -----------------------------------------------------
        // CATEGORY
        // -----------------------------------------------------

        category: category
          ? {
              id: category.id,

              name:
                category.service_category || null,

              resolveTimeline:
                category.resolve_timeline || null
            }
          : null,

        categoryId:
          request.service_category || null,

        // -----------------------------------------------------
        // STATUS
        // -----------------------------------------------------

        status: {
          id:
            request.service_status || null,

          code:
            statusCode,

          name:
            statusName
        },

        // -----------------------------------------------------
        // OVERDUE
        // -----------------------------------------------------

        overdueDays,

        isOverdue,

        // -----------------------------------------------------
        // ASSIGNED USER
        // -----------------------------------------------------

        assignedTo:
          assignedUser
            ? {
                id:
                  assignedUser.id,

                firstName:
                  assignedUser.first_name || null,

                lastName:
                  assignedUser.last_name || null,

                name:
                  [
                    assignedUser.first_name,
                    assignedUser.last_name
                  ]
                    .filter(Boolean)
                    .join(" "),

                mobile:
                  assignedUser.mobile_no || null,

                email:
                  assignedUser.email_id || null
              }
            : null,

        // -----------------------------------------------------
        // PG
        // -----------------------------------------------------

        pgId:
          request.pg_id || null,

        // -----------------------------------------------------
        // ROOM
        // -----------------------------------------------------

        room:
          room
            ? {
                id:
                  room.id,

                name:
                  room.room_name || null
              }
            : null
      };
    });

    // =========================================================
    // 9. SUMMARY
    //
    // 11 = Open
    // 12 = In Progress
    // 13 = Resolved
    // =========================================================

    const summary = {
     

      open:
        data.filter(
          (item) =>
            item.status.id === 11
        ).length,

      inProgress:
        data.filter(
          (item) =>
            item.status.id === 12
        ).length,

      resolved:
        data.filter(
          (item) =>
            item.status.id === 13
        ).length,

      overdue:
        data.filter(
          (item) =>
            item.isOverdue === true
        ).length
    };

    // =========================================================
    // 10. RESPONSE
    // =========================================================

    return res.status(200).json({

      success: true,

      message:
        "My service requests fetched successfully",

      // =======================================================
      // USER
      // =======================================================

      user: {
        id:
          user.id,

        firstName:
          user.first_name || null,

        lastName:
          user.last_name || null,

        name:
          [
            user.first_name,
            user.last_name
          ]
            .filter(Boolean)
            .join(" "),

        email:
          user.email_id || null,

        mobile:
          user.mobile_no || null
      },

      // =======================================================
      // GUEST
      // =======================================================

      guest: guest
        ? {
            id:
              guest.id,

            userId:
              guest.user_id,

            pgId:
              guest.pg_id
          }
        : null,

      // =======================================================
      // BOOKING
      // =======================================================

      booking: booking
        ? {
            id:
              booking.id,

            bookingNo:
              booking.bkg_no,

            pgId:
              booking.pg_id,

            roomId:
              booking.room_id,

            bedId:
              booking.bed_id
          }
        : null,

      // =======================================================
      // ROOM
      // =======================================================

      room: room
        ? {
            id:
              room.id,

            name:
              room.room_name
          }
        : null,

      // =======================================================
      // SUMMARY
      // =======================================================

      summary,

      // =======================================================
      // REQUEST LIST
      // =======================================================

      data
    });

  } catch (error) {

    console.error(
      "My service requests error:",
      error
    );

    return res.status(500).json({

      success: false,

      message:
        "Failed to fetch my service requests",

      error:
        error.message
    });
  }
};


export const getResidentRentStatus = async (req, res) => {
  try {

    // ========================================================
    // 1. USER ID
    // ========================================================

    const userId = Number(req.query.user_id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid user_id is required"
      });
    }


    // ========================================================
    // 2. GET USER
    // ========================================================

    const user =
      await prisma.dy_user.findUnique({
        where: {
          id: userId
        },

        select: {
          id: true,
          first_name: true,
          last_name: true,
          email_id: true,
          mobile_no: true
        }
      });


    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }


    // ========================================================
    // 3. GET CURRENT GUEST / RESIDENT
    // ========================================================

    const guest =
      await prisma.dy_pg_guest_info.findFirst({
        where: {
          user_id: userId
        },

        select: {
          id: true,
          user_id: true,
          pg_id: true
        },

        orderBy: {
          id: "desc"
        }
      });


    if (!guest) {
      return res.status(404).json({
        success: false,
        message: "Resident/guest record not found"
      });
    }


    const pgId = guest.pg_id;


    // ========================================================
    // 4. GET LATEST ACTIVE BOOKING
    // ========================================================

    const booking =
      await prisma.dy_pg_bookings.findFirst({
        where: {
          guest_id: guest.id
        },

        select: {
          id: true,
          bkg_no: true,
          pg_id: true,
          room_id: true,
          bed_id: true,
          monthly_rent: true,
          secuirty_deposit: true,
          actual_check_in_date: true,
          planned_check_out_date: true,
          actual_check_out_date: true,
          bkg_status: true,

          dy_pg_room_info: {
            select: {
              id: true,
              room_name: true
            }
          },

          dy_pg_bed_info: {
            select: {
              id: true,
              bed_number: true
            }
          }
        },

        orderBy: {
          id: "desc"
        }
      });


    // ========================================================
    // 5. GET ALL INVOICES FOR THIS RESIDENT
    // ========================================================
    //
    // Booking -> Invoice -> Payments
    //
    // We get all invoices so we can build:
    //
    // - Current month
    // - Current due
    // - Recent history
    // - Last payment status
    //
    // ========================================================

    const invoices =
      await prisma.dy_invoices.findMany({
        where: {
          dy_pg_bookings: {
            guest_id: guest.id,
            pg_id: pgId
          }
        },

        select: {
          id: true,
          inv_id: true,
          booking_id: true,

          inv_amount: true,
          inv_cgst: true,
          inv_sgst: true,
          inv_total: true,

          inv_datetime: true,
          inv_duedate: true,

          inv_from_date: true,
          inv_to_date: true,

          dy_payments_info: {
            select: {
              id: true,
              payment_id: true,

              payment_status: true,

              cash_payment: true,
              actual_payment: true,
              balance: true,

              payment_date: true,
              razor_pay_payment_datetime: true,

              remarks: true,

              st_pg_cur_sts: {
                select: {
                  id: true,
                  status_code: true
                }
              }
            },

            orderBy: {
              id: "desc"
            }
          }
        },

        orderBy: {
          inv_from_date: "desc"
        }
      });


    // ========================================================
    // 6. DATE HELPERS
    // ========================================================

    const now = new Date();

    const startOfMonth =
      new Date(
        now.getFullYear(),
        now.getMonth(),
        1
      );

    const startOfNextMonth =
      new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        1
      );


    // ========================================================
    // 7. DECIMAL -> NUMBER
    // ========================================================

    const toNumber = (value) => {

      if (
        value === null ||
        value === undefined ||
        value === ""
      ) {
        return 0;
      }

      const number =
        Number(value);

      return Number.isFinite(number)
        ? number
        : 0;
    };


    // ========================================================
    // 8. GET LATEST PAYMENT
    // ========================================================
    //
    // There can be multiple payment rows for one invoice.
    //
    // For the current state, latest payment row is used.
    //
    // ========================================================

    const getLatestPayment = (invoice) => {

      if (
        !invoice?.dy_payments_info ||
        invoice.dy_payments_info.length === 0
      ) {
        return null;
      }

      return invoice.dy_payments_info[0];
    };


    // ========================================================
    // 9. CALCULATE PAYMENT STATUS
    // ========================================================
    //
    // IMPORTANT:
    //
    // Your current dump contains payment_status = 5
    // in some payment rows.
    //
    // But status 5 = Occupied.
    //
    // Therefore balance/actual_payment is used first.
    //
    // Rules:
    //
    // balance <= 0
    //     => paid
    //
    // balance > 0 + actual payment > 0
    //     => partial
    //
    // balance > 0 + actual payment = 0
    //     => due
    //
    // due date passed + balance > 0
    //     => overdue
    //
    // ========================================================

    const getPaymentStatus = (
      invoice,
      payment
    ) => {

      const total =
        toNumber(
          invoice?.inv_total
        );

      const balance =
        payment
          ? toNumber(payment.balance)
          : total;

      const actualPayment =
        payment
          ? toNumber(payment.actual_payment)
          : 0;


      const dueDate =
        invoice?.inv_duedate
          ? new Date(invoice.inv_duedate)
          : null;


      // ------------------------------------------------------
      // PAID
      // ------------------------------------------------------

      if (balance <= 0) {
        return {
          id: 19,
          code: "Paid-Full",
          name: "Paid",
          key: "paid"
        };
      }


      // ------------------------------------------------------
      // OVERDUE
      // ------------------------------------------------------

      if (
        dueDate &&
        dueDate < now &&
        balance > 0
      ) {
        return {
          id: 18,
          code: "PaymentDue",
          name: "Overdue",
          key: "overdue"
        };
      }


      // ------------------------------------------------------
      // PARTIAL
      // ------------------------------------------------------

      if (
        actualPayment > 0 &&
        balance > 0
      ) {
        return {
          id: 27,
          code: "Paid-Partial",
          name: "Partial",
          key: "partial"
        };
      }


      // ------------------------------------------------------
      // DUE
      // ------------------------------------------------------

      return {
        id: 18,
        code: "PaymentDue",
        name: "Due",
        key: "due"
      };
    };


    // ========================================================
    // 10. NORMALIZE INVOICES
    // ========================================================

    const normalizedInvoices =
      invoices.map((invoice) => {

        const payment =
          getLatestPayment(invoice);

        const paymentStatus =
          getPaymentStatus(
            invoice,
            payment
          );


        const totalAmount =
          toNumber(
            invoice.inv_total
          );


        const actualPayment =
          payment
            ? toNumber(
                payment.actual_payment
              )
            : 0;


        const balance =
          payment
            ? Math.max(
                0,
                toNumber(payment.balance)
              )
            : totalAmount;


        const dueDate =
          invoice.inv_duedate
            ? new Date(
                invoice.inv_duedate
              )
            : null;


        return {

          invoiceId:
            invoice.id,

          invoiceNo:
            invoice.inv_id,

          bookingId:
            invoice.booking_id,

          totalAmount,

          actualPayment,

          balance,

          dueDate,

          fromDate:
            invoice.inv_from_date,

          toDate:
            invoice.inv_to_date,

          invoiceDate:
            invoice.inv_datetime,

          paymentId:
            payment?.id ?? null,

          paymentNo:
            payment?.payment_id ?? null,

          paymentDate:
            payment?.payment_date ??
            payment?.razor_pay_payment_datetime ??
            null,

          paymentStatus,

          remarks:
            payment?.remarks ??
            null
        };
      });


    // ========================================================
    // 11. FIND CURRENT MONTH INVOICE
    // ========================================================

    let currentInvoice =
      normalizedInvoices.find(
        (invoice) => {

          if (
            !invoice.fromDate ||
            !invoice.toDate
          ) {
            return false;
          }

          const from =
            new Date(
              invoice.fromDate
            );

          const to =
            new Date(
              invoice.toDate
            );

          return (
            from < startOfNextMonth &&
            to >= startOfMonth
          );
        }
      );


    // ========================================================
    // 12. FALLBACK TO LATEST INVOICE
    // ========================================================
    //
    // If the database has not generated the current month's
    // invoice yet, don't fabricate an invoice.
    //
    // Use the latest invoice as current billing information.
    //
    // ========================================================

    if (!currentInvoice) {
      currentInvoice =
        normalizedInvoices[0] ||
        null;
    }


    // ========================================================
    // 13. CURRENT DUE
    // ========================================================

    const currentDue =
      currentInvoice
        ? currentInvoice.balance
        : 0;


    // ========================================================
    // 14. DUE DATE
    // ========================================================

    const dueDate =
      currentInvoice?.dueDate ||
      null;


    // ========================================================
    // 15. LAST STATUS
    // ========================================================

    const lastStatus =
      currentInvoice?.paymentStatus ||
      {
        id: null,
        code: null,
        name: "No Payment",
        key: "pending"
      };


    // ========================================================
    // 16. RENT REMINDERS
    // ========================================================
    //
    // dy_pg_alerts is currently the available reminder source.
    //
    // alert_cat = 1 is used for rent alerts in your data.
    //
    // IMPORTANT:
    // dy_pg_alerts has no created_at / sent_at column.
    //
    // Therefore we can reliably return reminder count/details,
    // but cannot claim an actual reminder timestamp.
    //
    // ========================================================

    const rentAlerts =
      await prisma.dy_pg_alerts.findMany({
        where: {
          pg_id: pgId,

          alert_cat: 1,

          OR: [
            {
              alert_receiver: userId
            },
            {
              alert_receiver: null
            }
          ]
        },

        select: {
          id: true,

          alert_title: true,

          alert_description: true,

          alert_priority: true,

          alert_status: true,

          alert_receiver: true,

          alert_receiver_role: true
        },

        orderBy: {
          id: "desc"
        }
      });


    // ========================================================
    // 17. REMINDER COUNT
    // ========================================================

    const reminderCount =
      rentAlerts.length;


    // ========================================================
    // 18. BUILD REMINDER TIMELINE
    // ========================================================
    //
    // The database does not have actual reminder dates.
    //
    // Therefore timeline is built from invoice lifecycle
    // dates, not falsely presented as notification timestamps.
    //
    // ========================================================

    const reminderTimeline = [];


    if (currentInvoice) {

      // ------------------------------------------------------
      // Invoice generated
      // ------------------------------------------------------

      if (currentInvoice.invoiceDate) {

        reminderTimeline.push({
          type: "invoice",
          title: "Rent invoice generated",
          date:
            currentInvoice.invoiceDate,
          status: "completed"
        });
      }


      // ------------------------------------------------------
      // Payment / reminder state
      // ------------------------------------------------------

      if (
        currentInvoice.paymentStatus.key ===
        "paid"
      ) {

        reminderTimeline.push({
          type: "payment",
          title: "Rent payment completed",
          date:
            currentInvoice.paymentDate,
          status: "completed"
        });

      } else {

        if (
          currentInvoice.dueDate &&
          new Date(
            currentInvoice.dueDate
          ) < now
        ) {

          reminderTimeline.push({
            type: "due",
            title: "Rent due date passed",
            date:
              currentInvoice.dueDate,
            status: "overdue"
          });

        } else {

          reminderTimeline.push({
            type: "due",
            title: "Rent due date",
            date:
              currentInvoice.dueDate,
            status: "pending"
          });
        }
      }
    }


    // ========================================================
    // 19. RECENT RENT HISTORY
    // ========================================================

    const recentRentHistory =
      normalizedInvoices
        .slice(0, 6)
        .map((invoice) => {

          const monthDate =
            invoice.fromDate
              ? new Date(
                  invoice.fromDate
                )
              : null;


          return {

            invoiceId:
              invoice.invoiceId,

            invoiceNo:
              invoice.invoiceNo,

            month:
              monthDate
                ? monthDate.toLocaleString(
                    "en-US",
                    {
                      month: "short",
                      year: "numeric"
                    }
                  )
                : null,

            fromDate:
              invoice.fromDate,

            toDate:
              invoice.toDate,

            amount:
              invoice.totalAmount,

            paidAmount:
              invoice.actualPayment,

            balance:
              invoice.balance,

            dueDate:
              invoice.dueDate,

            status:
              invoice.paymentStatus
          };
        });


    // ========================================================
    // 20. RENT SUMMARY
    // ========================================================

    const totalInvoices =
      normalizedInvoices.length;


    const paidInvoices =
      normalizedInvoices.filter(
        (invoice) =>
          invoice.paymentStatus.key ===
          "paid"
      ).length;


    const dueInvoices =
      normalizedInvoices.filter(
        (invoice) =>
          invoice.paymentStatus.key ===
          "due"
      ).length;


    const partialInvoices =
      normalizedInvoices.filter(
        (invoice) =>
          invoice.paymentStatus.key ===
          "partial"
      ).length;


    const overdueInvoices =
      normalizedInvoices.filter(
        (invoice) =>
          invoice.paymentStatus.key ===
          "overdue"
      ).length;


    const totalOutstanding =
      normalizedInvoices.reduce(
        (sum, invoice) =>
          sum + invoice.balance,
        0
      );


    const totalPaid =
      normalizedInvoices.reduce(
        (sum, invoice) =>
          sum + invoice.actualPayment,
        0
      );


    // ========================================================
    // 21. RESPONSE
    // ========================================================

    return res.status(200).json({

      success: true,

      message:
        "Resident rent status fetched successfully",


      // ======================================================
      // RESIDENT
      // ======================================================

      resident: {

        id:
          user.id,

        firstName:
          user.first_name || null,

        lastName:
          user.last_name || null,

        name:
          [
            user.first_name,
            user.last_name
          ]
            .filter(Boolean)
            .join(" "),

        email:
          user.email_id || null,

        mobile:
          user.mobile_no || null,

        guestId:
          guest.id,

        pgId:
          pgId
      },


      // ======================================================
      // BOOKING
      // ======================================================

      booking:
        booking
          ? {

              id:
                booking.id,

              bookingNo:
                booking.bkg_no,

              pgId:
                booking.pg_id,

              room: {

                id:
                  booking.room_id,

                name:
                  booking
                    .dy_pg_room_info
                    ?.room_name ||
                  null
              },

              bed: {

                id:
                  booking.bed_id,

                number:
                  booking
                    .dy_pg_bed_info
                    ?.bed_number ||
                  null
              },

              monthlyRent:
                toNumber(
                  booking.monthly_rent
                ),

              securityDeposit:
                toNumber(
                  booking.secuirty_deposit
                ),

              checkInDate:
                booking.actual_check_in_date,

              plannedCheckOutDate:
                booking.planned_check_out_date,

              actualCheckOutDate:
                booking.actual_check_out_date,

              statusId:
                booking.bkg_status
            }

          : null,


      // ======================================================
      // TOP CARDS
      // ======================================================

      rentStatus: {

        currentDue:
          currentDue,

        dueDate:
          dueDate,

        reminderCount:
          reminderCount,

        lastStatus:
          lastStatus
      },


      // ======================================================
      // CURRENT MONTH
      // ======================================================

      currentMonth: {

        month:
          currentInvoice?.fromDate
            ? new Date(
                currentInvoice.fromDate
              ).toLocaleString(
                "en-US",
                {
                  month: "short",
                  year: "numeric"
                }
              )
            : null,

        invoiceId:
          currentInvoice?.invoiceId ||
          null,

        invoiceNo:
          currentInvoice?.invoiceNo ||
          null,

        amount:
          currentInvoice?.totalAmount ||
          0,

        paidAmount:
          currentInvoice?.actualPayment ||
          0,

        balance:
          currentInvoice?.balance ||
          0,

        dueDate:
          currentInvoice?.dueDate ||
          null,

        status:
          currentInvoice?.paymentStatus ||
          {
            id: null,
            code: null,
            name: "No Payment",
            key: "pending"
          }
      },


      // ======================================================
      // REMINDERS
      // ======================================================

      reminders: {

        count:
          reminderCount,

        data:
          rentAlerts.map(
            (alert) => ({

              id:
                alert.id,

              title:
                alert.alert_title,

              description:
                alert.alert_description,

              priority:
                alert.alert_priority,

              statusId:
                alert.alert_status,

              receiver:
                alert.alert_receiver,

              receiverRole:
                alert.alert_receiver_role,

              // dy_pg_alerts does not currently contain
              // created_at / sent_at.
              date: null
            })
          )
      },


      // ======================================================
      // REMINDER TIMELINE
      // ======================================================

      reminderTimeline,


      // ======================================================
      // RECENT RENT HISTORY
      // ======================================================

      recentRentHistory,


      // ======================================================
      // AGGREGATES
      // ======================================================

      aggregates: {

        totalInvoices,

        paid:
          paidInvoices,

        due:
          dueInvoices,

        partial:
          partialInvoices,

        overdue:
          overdueInvoices,

        totalPaid,

        totalOutstanding
      },


      // ======================================================
      // ALL INVOICES
      // ======================================================

      invoices:
        normalizedInvoices.map(
          (invoice) => ({

            invoiceId:
              invoice.invoiceId,

            invoiceNo:
              invoice.invoiceNo,

            bookingId:
              invoice.bookingId,

            amount:
              invoice.totalAmount,

            paidAmount:
              invoice.actualPayment,

            balance:
              invoice.balance,

            invoiceDate:
              invoice.invoiceDate,

            fromDate:
              invoice.fromDate,

            toDate:
              invoice.toDate,

            dueDate:
              invoice.dueDate,

            paymentId:
              invoice.paymentId,

            paymentNo:
              invoice.paymentNo,

            paymentDate:
              invoice.paymentDate,

            status:
              invoice.paymentStatus,

            remarks:
              invoice.remarks
          })
        )
    });


  } catch (error) {

    console.error(
      "RESIDENT RENT STATUS ERROR:",
      error
    );


    return res.status(500).json({

      success: false,

      message:
        "Failed to fetch resident rent status",

      error:
        error.message
    });
  }
};


// ============================================================
// ANNOUNCEMENT SERVICE
// ============================================================

export const getAnnouncements = async (
  prisma,
  {
    pgId,
    userId = null,
    receiverRole = null,
    category = null,
    priority = null,
    type = "all",
    limit = 100
  }
) => {

  /*
  ============================================================
  VALIDATION
  ============================================================
  */

  if (
    !Number.isInteger(Number(pgId)) ||
    Number(pgId) <= 0
  ) {
    throw new Error("Valid pgId is required");
  }

  pgId = Number(pgId);

  limit = Number(limit);

  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100
  ) {
    limit = 100;
  }


  /*
  ============================================================
  TYPE
  ============================================================

  all
  alerts
  events
  ============================================================
  */

  const requestedType =
    String(type || "all").toLowerCase();

  if (
    ![
      "all",
      "alerts",
      "events"
    ].includes(requestedType)
  ) {
    throw new Error(
      "type must be all, alerts, or events"
    );
  }


  /*
  ============================================================
  ALERT WHERE
  ============================================================
  */

  const alertWhere = {
    pg_id: pgId
  };


  /*
  ------------------------------------------------------------
  Category filter
  ------------------------------------------------------------
  */

  if (category !== null && category !== undefined) {

    const categoryValue =
      Number(category);

    if (
      !Number.isInteger(categoryValue) ||
      categoryValue <= 0
    ) {
      throw new Error(
        "Invalid category"
      );
    }

    alertWhere.alert_cat =
      categoryValue;
  }


  /*
  ------------------------------------------------------------
  Priority filter
  ------------------------------------------------------------
  */

  if (priority !== null && priority !== undefined) {

    const priorityValue =
      Number(priority);

    if (
      !Number.isInteger(priorityValue) ||
      priorityValue <= 0
    ) {
      throw new Error(
        "Invalid priority"
      );
    }

    alertWhere.alert_priority =
      priorityValue;
  }


  /*
  ------------------------------------------------------------
  Receiver filtering
  ------------------------------------------------------------

  If userId is supplied:

      alert_receiver = userId

  OR

      alert_receiver IS NULL

  OR

      alert_receiver_role = receiverRole

  This allows common PG announcements to be shown
  together with user-specific announcements.

  ------------------------------------------------------------
  */

  if (userId !== null && userId !== undefined) {

    const numericUserId =
      Number(userId);

    if (
      !Number.isInteger(numericUserId) ||
      numericUserId <= 0
    ) {
      throw new Error(
        "Invalid userId"
      );
    }

    const receiverConditions = [
      {
        alert_receiver: null
      },
      {
        alert_receiver: numericUserId
      }
    ];

    if (
      receiverRole !== null &&
      receiverRole !== undefined
    ) {

      const numericRole =
        Number(receiverRole);

      if (
        Number.isInteger(numericRole) &&
        numericRole > 0
      ) {

        receiverConditions.push({
          alert_receiver_role:
            numericRole
        });
      }
    }

    alertWhere.OR =
      receiverConditions;
  }


  /*
  ============================================================
  EVENT WHERE
  ============================================================
  */

  const eventWhere = {
    pg_id: pgId
  };


  /*
  ============================================================
  DATABASE QUERIES
  ============================================================
  */

  let alerts = [];
  let events = [];


  /*
  ------------------------------------------------------------
  ALERTS
  ------------------------------------------------------------
  */

  if (
    requestedType === "all" ||
    requestedType === "alerts"
  ) {

    alerts =
      await prisma.dy_pg_alerts.findMany({

        where: alertWhere,

        orderBy: {
          id: "desc"
        },

        take: limit
      });
  }


  /*
  ------------------------------------------------------------
  EVENTS
  ------------------------------------------------------------
  */

  if (
    requestedType === "all" ||
    requestedType === "events"
  ) {

    events =
      await prisma.dy_pg_events_info.findMany({

        where: eventWhere,

        orderBy: {
          event_date: "desc"
        },

        take: limit
      });
  }


  /*
  ============================================================
  LOOKUP IDS
  ============================================================
  */

  const categoryIds =
    [
      ...new Set(
        alerts
          .map(item => item.alert_cat)
          .filter(Boolean)
      )
    ];

  const priorityIds =
    [
      ...new Set(
        alerts
          .map(item => item.alert_priority)
          .filter(Boolean)
      )
    ];

  const statusIds =
    [
      ...new Set(
        alerts
          .map(item => item.alert_status)
          .filter(Boolean)
      )
    ];

  const roleIds =
    [
      ...new Set(
        alerts
          .map(item => item.alert_receiver_role)
          .filter(Boolean)
      )
    ];


  /*
  ============================================================
  MASTER DATA
  ============================================================
  */

  const [
    categoryRows,
    priorityRows,
    statusRows,
    roleRows
  ] = await Promise.all([

    categoryIds.length > 0
      ? prisma.st_pg_alrt_cat.findMany({
          where: {
            id: {
              in: categoryIds
            }
          }
        })
      : [],

    priorityIds.length > 0
      ? prisma.st_pg_alert_priority.findMany({
          where: {
            id: {
              in: priorityIds
            }
          }
        })
      : [],

    statusIds.length > 0
      ? prisma.st_pg_cur_sts.findMany({
          where: {
            id: {
              in: statusIds
            }
          }
        })
      : [],

    roleIds.length > 0
      ? prisma.st_pg_role.findMany({
          where: {
            id: {
              in: roleIds
            }
          }
        })
      : []
  ]);


  /*
  ============================================================
  MAP MASTER DATA
  ============================================================
  */

  const categoryMap =
    new Map(
      categoryRows.map(item => [
        item.id,
        item
      ])
    );

  const priorityMap =
    new Map(
      priorityRows.map(item => [
        item.id,
        item
      ])
    );

  const statusMap =
    new Map(
      statusRows.map(item => [
        item.id,
        item
      ])
    );

  const roleMap =
    new Map(
      roleRows.map(item => [
        item.id,
        item
      ])
    );


  /*
  ============================================================
  FORMAT ALERTS
  ============================================================
  */

  const formattedAlerts =
    alerts.map(alert => {

      const categoryData =
        categoryMap.get(
          alert.alert_cat
        );

      const priorityData =
        priorityMap.get(
          alert.alert_priority
        );

      const statusData =
        statusMap.get(
          alert.alert_status
        );

      const roleData =
        roleMap.get(
          alert.alert_receiver_role
        );


      /*
      ----------------------------------------------------------
      IMPORTANT

      Your database calls priority 1 "Critical".

      The UI screenshot calls this "Important".

      We keep the real DB name in priorityName and expose
      isImportant separately for frontend filtering.
      ----------------------------------------------------------
      */

      const isImportant =
        alert.alert_priority === 1;


      return {

        id: alert.id,

        type: "alert",

        /*
        --------------------------------------------------------
        Content
        --------------------------------------------------------
        */

        title:
          alert.alert_title,

        description:
          alert.alert_description,

        /*
        --------------------------------------------------------
        Category
        --------------------------------------------------------
        */

        categoryId:
          alert.alert_cat,

        category:
          categoryData?.alert_category ||
          null,

        /*
        --------------------------------------------------------
        Priority
        --------------------------------------------------------
        */

        priorityId:
          alert.alert_priority,

        priority:
          priorityData?.priority ||
          null,

        priorityDescription:
          priorityData?.priority_desc ||
          null,

        isImportant,

        /*
        --------------------------------------------------------
        Receiver
        --------------------------------------------------------
        */

        receiverRoleId:
          alert.alert_receiver_role,

        receiverRole:
          roleData?.role ||
          null,

        receiverId:
          alert.alert_receiver,

        /*
        --------------------------------------------------------
        Status
        --------------------------------------------------------
        */

        statusId:
          alert.alert_status,

        status:
          statusData?.status_code ||
          null,

        /*
        --------------------------------------------------------
        PG
        --------------------------------------------------------
        */

        pgId:
          alert.pg_id,

        /*
        --------------------------------------------------------
        UI helpers
        --------------------------------------------------------
        */

        uiCategory:
          "Announcements",

        uiStatus:
          statusData?.status_code ||
          null,

        /*
        Alert has no created timestamp in DB.
        Therefore we cannot reliably mark it New/Read.
        */

        isNew: null,

        isRead: null
      };
    });


  /*
  ============================================================
  FORMAT EVENTS
  ============================================================
  */

  const formattedEvents =
    events.map(event => {

      const eventDate =
        event.event_date
          ? new Date(event.event_date)
          : null;


      /*
      ----------------------------------------------------------
      EVENT STATUS
      ----------------------------------------------------------
      */

      let eventStatus =
        "Scheduled";

      if (eventDate) {

        const now =
          new Date();

        if (
          eventDate.getTime() < now.getTime()
        ) {
          eventStatus =
            "Completed";
        }
      }


      return {

        id:
          event.id,

        type:
          "event",

        /*
        --------------------------------------------------------
        Content
        --------------------------------------------------------
        */

        title:
          event.event_title,

        description:
          event.event_description,

        /*
        --------------------------------------------------------
        Event
        --------------------------------------------------------
        */

        eventDate,

        /*
        --------------------------------------------------------
        Category
        --------------------------------------------------------
        */

        categoryId:
          null,

        category:
          "Events",

        /*
        --------------------------------------------------------
        Priority
        --------------------------------------------------------
        */

        priorityId:
          null,

        priority:
          null,

        isImportant:
          false,

        /*
        --------------------------------------------------------
        Status
        --------------------------------------------------------
        */

        status:
          eventStatus,

        statusId:
          null,

        /*
        --------------------------------------------------------
        PG
        --------------------------------------------------------
        */

        pgId:
          event.pg_id,

        /*
        --------------------------------------------------------
        UI
        --------------------------------------------------------
        */

        uiCategory:
          "Events",

        uiStatus:
          eventStatus,

        isNew:
          null,

        isRead:
          null
      };
    });


  /*
  ============================================================
  COMBINE
  ============================================================
  */

  let announcements = [
    ...formattedAlerts,
    ...formattedEvents
  ];


  /*
  ============================================================
  SORT
  ============================================================

  Events have event_date.

  Alerts do not have a timestamp.

  Therefore:
  - events are sorted by eventDate
  - alerts retain database id ordering
  ============================================================
  */

  announcements.sort(
    (a, b) => {

      const dateA =
        a.eventDate
          ? new Date(a.eventDate).getTime()
          : 0;

      const dateB =
        b.eventDate
          ? new Date(b.eventDate).getTime()
          : 0;

      return dateB - dateA;
    }
  );


  /*
  ============================================================
  SUMMARY
  ============================================================
  */

  const today =
    new Date();

  const startOfToday =
    new Date(today);

  startOfToday.setHours(
    0,
    0,
    0,
    0
  );

  const endOfToday =
    new Date(today);

  endOfToday.setHours(
    23,
    59,
    59,
    999
  );


  const weekEnd =
    new Date(
      startOfToday
    );

  weekEnd.setDate(
    weekEnd.getDate() + 7
  );


  /*
  ------------------------------------------------------------
  Important
  ------------------------------------------------------------
  */

  const importantCount =
    formattedAlerts.filter(
      item =>
        item.isImportant === true
    ).length;


  /*
  ------------------------------------------------------------
  This week
  ------------------------------------------------------------
  */

  const thisWeekCount =
    formattedEvents.filter(event => {

      if (!event.eventDate) {
        return false;
      }

      const eventDate =
        new Date(
          event.eventDate
        );

      return (
        eventDate >= startOfToday &&
        eventDate < weekEnd
      );

    }).length;


  /*
  ------------------------------------------------------------
  New

  Cannot be reliably calculated because alerts have no
  created_at / created_date and no read flag.
  ------------------------------------------------------------
  */

  const newCount = 0;


  /*
  ============================================================
  FILTER COUNTS
  ============================================================
  */

  const allCount =
    announcements.length;

  const eventsCount =
    formattedEvents.length;

  const alertsCount =
    formattedAlerts.length;


  /*
  ============================================================
  RESPONSE
  ============================================================
  */

  return {

    summary: {

      all:
        allCount,

      new:
        newCount,

      important:
        importantCount,

      thisWeek:
        thisWeekCount,

      alerts:
        alertsCount,

      events:
        eventsCount
    },

    filters: {

      all: {
        label: "All",
        count: allCount
      },

      important: {
        label: "Important",
        count: importantCount
      },

      utilities: {
        label: "Utilities",

        /*
        No Utilities category currently exists
        in the supplied alert category master.
        */

        count: 0
      },

      events: {
        label: "Events",
        count: eventsCount
      }
    },

    announcements

  };
};




// ============================================================
// GET ANNOUNCEMENTS
// ============================================================

export const getAnnouncementsController =
  async (req, res) => {

    try {

      const {
        pgId,
        userId,
        receiverRole,
        category,
        priority,
        type = "all",
        limit = 100
      } = req.query;


      /*
      ========================================================
      VALIDATE PG
      ========================================================
      */

      const parsedPgId =
        Number(pgId);

      if (
        !Number.isInteger(parsedPgId) ||
        parsedPgId <= 0
      ) {

        return res.status(400).json({

          success: false,

          message:
            "Valid pgId is required"

        });
      }


      /*
      ========================================================
      USER ID
      ========================================================
      */

      let parsedUserId =
        null;

      if (
        userId !== undefined &&
        userId !== null &&
        userId !== ""
      ) {

        parsedUserId =
          Number(userId);

        if (
          !Number.isInteger(parsedUserId) ||
          parsedUserId <= 0
        ) {

          return res.status(400).json({

            success: false,

            message:
              "Invalid userId"

          });
        }
      }


      /*
      ========================================================
      RECEIVER ROLE
      ========================================================
      */

      let parsedReceiverRole =
        null;

      if (
        receiverRole !== undefined &&
        receiverRole !== null &&
        receiverRole !== ""
      ) {

        parsedReceiverRole =
          Number(receiverRole);

        if (
          !Number.isInteger(
            parsedReceiverRole
          ) ||
          parsedReceiverRole <= 0
        ) {

          return res.status(400).json({

            success: false,

            message:
              "Invalid receiverRole"

          });
        }
      }


      /*
      ========================================================
      SERVICE
      ========================================================
      */

      const data =
        await getAnnouncements(
          prisma,
          {
            pgId:
              parsedPgId,

            userId:
              parsedUserId,

            receiverRole:
              parsedReceiverRole,

            category,

            priority,

            type,

            limit
          }
        );


      /*
      ========================================================
      RESPONSE
      ========================================================
      */

      return res.status(200).json({

        success: true,

        message:
          "Announcements fetched successfully",

        data

      });

    } catch (error) {

      console.error(
        "GET ANNOUNCEMENTS ERROR:",
        error
      );


      return res.status(500).json({

        success: false,

        message:
          error.message ||
          "Failed to fetch announcements"

      });
    }
  };




export const getResidentProfileSupport = async (req, res) => {

  try {

    // ==========================================================
    // 1. GET USER ID
    // ==========================================================

    const userId = Number(req.query.user_id);

    if (!Number.isInteger(userId) || userId <= 0) {

      return res.status(400).json({
        success: false,
        status: 400,
        error: "BAD_REQUEST",
        message: "Valid user_id is required"
      });

    }


    // ==========================================================
    // HELPER
    // ==========================================================

    const getFullName = (
      firstName,
      lastName
    ) => {

      return (
        `${firstName || ""} ${lastName || ""}`
          .trim() || null
      );

    };


    const decimalToNumber = (value) => {

      if (
        value === null ||
        value === undefined
      ) {

        return 0;

      }

      return Number(value);

    };


    // ==========================================================
    // 2. GET USER
    //
    // dy_user.id = user_id
    // ==========================================================

    const user =
      await prisma.dy_user.findUnique({

        where: {
          id: userId
        },

        select: {

          id: true,

          first_name: true,

          last_name: true,

          email_id: true,

          mobile_no: true,

          mobile_verified: true,

          email_verified: true,

          gender_id: true,

          is_active: true,

          last_updated: true

        }

      });


    // ==========================================================
    // USER NOT FOUND
    // ==========================================================

    if (!user) {

      return res.status(404).json({

        success: false,

        status: 404,

        error: "NOT_FOUND",

        message: "User not found"

      });

    }


    // ==========================================================
    // 3. GET USER PROFILE
    //
    // dy_user_profile.user_id = dy_user.id
    // ==========================================================

    const profile =
      await prisma.dy_user_profile.findFirst({

        where: {

          user_id: userId

        },

        orderBy: {

          id: "desc"

        },

        select: {

          id: true,

          current_city: true,

          conv_mode_id: true,

          alt_email_id: true,

          alt_mobile_no: true,

          allow_promotion_campaign: true,

          Interests: true,

          last_updated: true,

          is_active: true

        }

      });


    // ==========================================================
    // 4. GET ACTIVE GUEST
    //
    // dy_pg_guest_info.user_id = user_id
    //
    // guest_status = 5 => Active
    // ==========================================================

    const guest =
      await prisma.dy_pg_guest_info.findFirst({

        where: {

          user_id: userId,

          guest_status: 5

        },

        orderBy: {

          id: "desc"

        },

        select: {

          id: true,

          guest_type: true,

          guest_status: true,

          perm_address: true,

          pg_id: true,

          user_id: true,

          emergency_contact: true,

          emergency_contact_name: true

        }

      });


    // ==========================================================
    // GUEST NOT FOUND
    // ==========================================================

    if (!guest) {

      return res.status(404).json({

        success: false,

        status: 404,

        error: "NOT_FOUND",

        message:
          "Active guest information not found for this user"

      });

    }


    // ==========================================================
    // 5. GET PG ID
    //
    // pg_id comes from dy_pg_guest_info
    //
    // Frontend only passes user_id.
    // ==========================================================

    const pgId = Number(guest.pg_id);


    if (!Number.isInteger(pgId) || pgId <= 0) {

      return res.status(400).json({

        success: false,

        status: 400,

        error: "BAD_REQUEST",

        message:
          "Invalid PG information for this guest"

      });

    }


    // ==========================================================
    // 6. GET PG INFORMATION
    //
    // dy_pg_info.id = guest.pg_id
    //
    // IMPORTANT:
    //
    // pg_owner is NOT used for Manager.
    //
    // Manager is obtained from:
    //
    // dy_pg_usr_map
    // +
    // dy_user_roles
    // +
    // dy_user
    //
    // ==========================================================

    const pg =
      await prisma.dy_pg_info.findUnique({

        where: {

          id: pgId

        },

        select: {

          id: true,

          pg_id: true,

          pg_name: true,

          pg_address: true,

          pg_landmark: true,

          pg_pincode: true,

          pg_primary_contact_no: true,

          pg_alternate_contact_no: true,

          pg_email: true,

          pg_status: true

        }

      });


    // ==========================================================
    // PG NOT FOUND
    // ==========================================================

    if (!pg) {

      return res.status(404).json({

        success: false,

        status: 404,

        error: "NOT_FOUND",

        message:
          "PG not found for this guest"

      });

    }


    // ==========================================================
    // 7. GET CURRENT BOOKING
    //
    // guest.id = booking.guest_id
    //
    // actual_check_out_date IS NULL
    // means current stay.
    // ==========================================================

    const booking =
      await prisma.dy_pg_bookings.findFirst({

        where: {

          pg_id: pgId,

          guest_id: guest.id,

          actual_check_out_date: null

        },

        orderBy: {

          id: "desc"

        },

        select: {

          id: true,

          bkg_no: true,

          pg_id: true,

          room_id: true,

          bed_id: true,

          planned_check_in_date: true,

          actual_check_in_date: true,

          planned_check_out_date: true,

          actual_check_out_date: true,

          bkg_status: true,

          monthly_rent: true,

          notice_period_time: true

        }

      });


    // ==========================================================
    // 8. GET ROOM
    // ==========================================================

    let room = null;


    if (booking?.room_id) {

      room =
        await prisma.dy_pg_room_info.findUnique({

          where: {

            id: booking.room_id

          },

          select: {

            id: true,

            room_name: true,

            room_type: true,

            floor_info: true,

            bathroom_type: true,

            has_tv: true,

            has_ac: true,

            has_balcony: true

          }

        });

    }


    // ==========================================================
    // 9. GET BED
    // ==========================================================

    let bed = null;


    if (booking?.bed_id) {

      bed =
        await prisma.dy_pg_bed_info.findUnique({

          where: {

            id: booking.bed_id

          },

          select: {

            id: true,

            room_info: true,

            bed_number: true,

            bed_status: true

          }

        });

    }


    // ==========================================================
    // 10. GET MANAGERS
    //
    // IMPORTANT:
    //
    // DO NOT USE:
    //
    // pg.pg_owner
    //
    //
    // Manager is determined by:
    //
    // dy_pg_usr_map
    //       |
    //       | pg_id
    //       ↓
    // user_id
    //       |
    //       ↓
    // dy_user_roles
    //       |
    //       | role_id = 3
    //       | is_active = 1
    //       ↓
    // dy_user
    //
    // ==========================================================


    // ----------------------------------------------------------
    // STEP 10.1
    //
    // Get users mapped to this PG
    //
    // dy_pg_usr_map.pg_id = pgId
    // ----------------------------------------------------------

    const pgUserMappings =
      await prisma.dy_pg_usr_map.findMany({

        where: {

          pg_id: pgId

        },

        select: {

          user_id: true

        }

      });


    // ----------------------------------------------------------
    // STEP 10.2
    //
    // Extract unique user IDs
    // ----------------------------------------------------------

    const mappedUserIds = [

      ...new Set(

        pgUserMappings

          .map(
            item => item.user_id
          )

          .filter(
            id =>
              id !== null &&
              id !== undefined
          )

      )

    ];


    // ----------------------------------------------------------
    // STEP 10.3
    //
    // Find users who have Manager role
    //
    // role_id = 3
    // is_active = 1
    //
    // ----------------------------------------------------------

    const managerRoleUsers =
      mappedUserIds.length > 0

        ? await prisma.dy_user_roles.findMany({

            where: {

              user_id: {

                in: mappedUserIds

              },

              role_id: 3,

              is_active: 1

            },

            select: {

              user_id: true

            },

            orderBy: {

              id: "asc"

            }

          })

        : [];


    // ----------------------------------------------------------
    // STEP 10.4
    //
    // Manager user IDs
    // ----------------------------------------------------------

    const managerUserIds = [

      ...new Set(

        managerRoleUsers

          .map(
            item => item.user_id
          )

          .filter(Boolean)

      )

    ];


    // ----------------------------------------------------------
    // STEP 10.5
    //
    // Get manager users
    // ----------------------------------------------------------

    const managerUsers =
      managerUserIds.length > 0

        ? await prisma.dy_user.findMany({

            where: {

              id: {

                in: managerUserIds

              }

            },

            select: {

              id: true,

              first_name: true,

              last_name: true,

              mobile_no: true,

              email_id: true

            }

          })

        : [];


    // ----------------------------------------------------------
    // STEP 10.6
    //
    // Manager response
    // ----------------------------------------------------------

    const managers =
      managerUsers.map(

        manager => ({

          id: manager.id,

          name:
            getFullName(
              manager.first_name,
              manager.last_name
            ),

          mobile:
            manager.mobile_no || null,

          email:
            manager.email_id || null

        })

      );


    // ----------------------------------------------------------
    // STEP 10.7
    //
    // First manager for Manager Contact card
    //
    // Screenshot shows one Manager Contact.
    //
    // But we also return all managers.
    // ----------------------------------------------------------

    const managerContact =
      managers.length > 0
        ? managers[0]
        : null;


    // ==========================================================
    // 11. GET SERVICE REQUESTS
    //
    // requestor_info = user_id
    // pg_id = current PG
    //
    // This is used for:
    //
    // Raise a Support Ticket
    // ==========================================================

    const serviceRequests =
      await prisma.dy_pg_srv_reqs.findMany({

        where: {

          requestor_info: userId,

          pg_id: pgId

        },

        orderBy: {

          id: "desc"

        },

        select: {

          id: true,

          requestor_info: true,

          request_assigned_to: true,

          service_title: true,

          service_description: true,

          request_create_date: true,

          request_eta_date: true,

          SLA: true,

          feedback: true,

          service_category: true,

          service_status: true,

          pg_id: true,

          feedback_summary: true,

          st_pg_cur_sts: {

            select: {

              id: true,

              status_code: true,

              rstatus: true

            }

          }

        }

      });


    // ==========================================================
    // 12. SUPPORT REQUEST AGGREGATES
    // ==========================================================

    const totalRequests =
      serviceRequests.length;


    const openRequests =
      serviceRequests.filter(

        item =>
          item.service_status ===
          STATUS.TICKET_RAISED

      ).length;


    const inProgressRequests =
      serviceRequests.filter(

        item =>
          item.service_status ===
          STATUS.TICKET_IN_PROGRESS

      ).length;


    const resolvedRequests =
      serviceRequests.filter(

        item =>
          item.service_status ===
          STATUS.TICKET_RESOLVED

      ).length;


    // ==========================================================
    // 13. FORMAT SUPPORT TICKETS
    // ==========================================================

    const supportTickets =
      serviceRequests.map(

        item => ({

          id: item.id,

          requestorInfo:
            item.requestor_info,

          assignedTo:
            item.request_assigned_to,

          title:
            item.service_title || null,

          description:
            item.service_description || null,

          createdAt:
            item.request_create_date || null,

          eta:
            item.request_eta_date || null,

          sla:
            item.SLA || null,

          categoryId:
            item.service_category || null,

          statusId:
            item.service_status || null,

          status:
            item.st_pg_cur_sts?.status_code ||
            null,

          statusDescription:
            item.st_pg_cur_sts?.rstatus ??
            null,

          feedback:
            item.feedback || null,

          feedbackSummary:
            item.feedback_summary || null

        })

      );


    // ==========================================================
    // 14. GET NOTIFICATIONS / ALERTS
    //
    // User-specific alerts:
    //
    // alert_receiver = userId
    //
    // PG-wide alerts:
    //
    // alert_receiver IS NULL
    //
    // ==========================================================

    const alerts =
      await prisma.dy_pg_alerts.findMany({

        where: {

          pg_id: pgId,

          OR: [

            {
              alert_receiver: userId
            },

            {
              alert_receiver: null
            }

          ]

        },

        orderBy: {

          id: "desc"

        },

        select: {

          id: true,

          alert_cat: true,

          alert_receiver_role: true,

          alert_receiver: true,

          alert_title: true,

          alert_description: true,

          alert_priority: true,

          pg_id: true,

          alert_status: true,

          st_pg_alrt_cat: {

            select: {

              id: true,

              alert_category: true

            }

          },

          st_pg_alert_priority: {

            select: {

              id: true,

              priority: true,

              priority_desc: true

            }

          },

          st_pg_cur_sts: {

            select: {

              id: true,

              status_code: true,

              rstatus: true

            }

          }

        }

      });


    // ==========================================================
    // 15. NOTIFICATION AGGREGATES
    // ==========================================================

    const totalNotifications =
      alerts.length;


    const importantNotifications =
      alerts.filter(

        item => {

          const priority =
            String(
              item.st_pg_alert_priority?.priority ||
              ""
            ).toLowerCase();

          return (
            priority === "important"
          );

        }

      ).length;


    const activeNotifications =
      alerts.filter(

        item =>
          item.st_pg_cur_sts?.rstatus === 1

      ).length;


    // ==========================================================
    // 16. FORMAT NOTIFICATIONS
    // ==========================================================

    const notifications =
      alerts.map(

        item => ({

          id: item.id,

          title:
            item.alert_title || null,

          description:
            item.alert_description || null,

          categoryId:
            item.alert_cat || null,

          category:
            item.st_pg_alrt_cat
              ?.alert_category ||
            null,

          priorityId:
            item.alert_priority || null,

          priority:
            item.st_pg_alert_priority
              ?.priority ||
            null,

          priorityDescription:
            item.st_pg_alert_priority
              ?.priority_desc ||
            null,

          receiver:
            item.alert_receiver,

          receiverRole:
            item.alert_receiver_role,

          statusId:
            item.alert_status || null,

          status:
            item.st_pg_cur_sts
              ?.status_code ||
            null

        })

      );


    // ==========================================================
    // 17. FINAL PROFILE DATA
    // ==========================================================

    const residentName =
      getFullName(
        user.first_name,
        user.last_name
      );


    // ==========================================================
    // 18. FINAL RESPONSE
    // ==========================================================

    return res.status(200).json({

      success: true,

      message:
        "Resident profile and support details fetched successfully",

      data: {

        // ======================================================
        // PROFILE
        // ======================================================

        profile: {

          userId:
            user.id,

          guestId:
            guest.id,

          name:
            residentName,

          firstName:
            user.first_name || null,

          lastName:
            user.last_name || null,

          mobile:
            user.mobile_no || null,

          email:
            user.email_id || null,

          mobileVerified:
            Boolean(
              user.mobile_verified
            ),

          emailVerified:
            Boolean(
              user.email_verified
            ),

          isActive:
            Boolean(
              user.is_active
            ),

          profile: {

            profileId:
              profile?.id || null,

            currentCity:
              profile?.current_city || null,

            alternateEmail:
              profile?.alt_email_id || null,

            alternateMobile:
              profile?.alt_mobile_no || null,

            interests:
              profile?.Interests || null,

            allowPromotionCampaign:
              Boolean(
                profile?.allow_promotion_campaign
              )

          }

        },


        // ======================================================
        // CURRENT STAY
        // ======================================================

        stay: booking

          ? {

              bookingId:
                booking.id,

              bookingNo:
                booking.bkg_no || null,

              room: {

                id:
                  room?.id || null,

                name:
                  room?.room_name || null

              },

              bed: {

                id:
                  bed?.id || null,

                number:
                  bed?.bed_number || null,

                status:
                  bed?.bed_status || null

              },

              checkIn:
                booking.actual_check_in_date ||
                booking.planned_check_in_date ||
                null,

              expectedCheckout:
                booking.planned_check_out_date ||
                null,

              actualCheckout:
                booking.actual_check_out_date ||
                null,

              bookingStatus:
                booking.bkg_status || null,

              monthlyRent:
                decimalToNumber(
                  booking.monthly_rent
                ),

              noticePeriod:
                booking.notice_period_time ||
                null

            }

          : null,


        // ======================================================
        // EMERGENCY CONTACT
        // ======================================================

        emergencyContact: {

          name:
            guest.emergency_contact_name ||
            null,

          mobile:
            guest.emergency_contact ||
            null

        },


        // ======================================================
        // MANAGER
        //
        // IMPORTANT:
        //
        // This comes from:
        //
        // dy_pg_usr_map
        // +
        // dy_user_roles
        // +
        // dy_user
        //
        // NOT from pg_owner.
        // ======================================================

        managerContact:
          managerContact,


        // ======================================================
        // ALL MANAGERS
        //
        // Useful if a PG has more than one active manager.
        // ======================================================

        managers: {

          count:
            managers.length,

          items:
            managers

        },


        // ======================================================
        // PG INFORMATION
        // ======================================================

        pg: {

          id:
            pg.id,

          pgCode:
            pg.pg_id || null,

          name:
            pg.pg_name || null,

          address:
            pg.pg_address || null,

          landmark:
            pg.pg_landmark || null,

          pincode:
            pg.pg_pincode || null,

          primaryContact:
            pg.pg_primary_contact_no ||
            null,

          alternateContact:
            pg.pg_alternate_contact_no ||
            null,

          email:
            pg.pg_email || null,

          status:
            pg.pg_status || null

        },


        // ======================================================
        // SUPPORT
        // ======================================================

        support: {

          summary: {

            totalRequests:
              totalRequests,

            openRequests:
              openRequests,

            inProgressRequests:
              inProgressRequests,

            resolvedRequests:
              resolvedRequests

          },

          tickets:
            supportTickets

        },


        // ======================================================
        // NOTIFICATIONS
        // ======================================================

        notifications: {

          summary: {

            total:
              totalNotifications,

            important:
              importantNotifications,

            active:
              activeNotifications

          },

          items:
            notifications

        },


        // ======================================================
        // SCREEN ACTIONS
        // ======================================================

        supportLinks: {

          personalDetails: true,

          emergencyContact: true,

          managerContact:
            managers.length > 0,

          pgRulesAndPolicies: false,

          faq: false,

          raiseSupportTicket: true

        },


        // ======================================================
        // IMPORTANT CONTACTS
        // ======================================================

        importantContacts: {

          manager:
            managerContact,

          pgPrimary: {

            name:
              pg.pg_name || "PG",

            mobile:
              pg.pg_primary_contact_no ||
              null,

            email:
              pg.pg_email ||
              null

          },

          pgAlternate: {

            name:
              "PG Alternate",

            mobile:
              pg.pg_alternate_contact_no ||
              null

          },

          security:
            null,

          housekeeping:
            null

        },


        // ======================================================
        // SETTINGS
        // ======================================================

        settings: {

          notifications:
            null,

          language:
            null,

          privacy:
            null,

          logout: {

            supportedByApi:
              false,

            note:
              "Logout should be handled by the authentication layer"

          }

        }

      }

    });


  } catch (error) {

    console.error(
      "Resident profile/support aggregate error:",
      error
    );


    return res.status(500).json({

      success: false,

      status: 500,

      error:
        "INTERNAL_SERVER_ERROR",

      message:
        "Failed to fetch resident profile and support details",

      details:
        error.message

    });

  }

};

