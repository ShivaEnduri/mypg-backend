import express from "express";

import {
  getOwnerDashboard,getOwnerRentStatus,getBedMap,
getIssuesAndResidentHappiness,getServiceRequestDetails,
getTodayDashboardTasksformanager,getCheckInCheckoutAggregate,
getResidentHome,getResidentMyStay,getMyServiceRequests,getResidentRentStatus
,updateCheckInCheckoutStatus ,getResidentProfileSupport,getAnnouncementsController

} from "../controller/aggregateControllers.js";



const router =
  express.Router();

// ============================================================
// OWNER DASHBOARD
// ============================================================

router.get(
  "/owner/getAllRecords",
 
  getOwnerDashboard
);

router.get(
  "/owner/rentStatus/getAllRecords",
   getOwnerRentStatus
 
  
);
router.get(
  "/owner/getbedmaps/getAllRecords",
   getBedMap
 
  
);




router.get(
  "/owner/getIssuesAndResidentHappiness/getAllRecords",
   getIssuesAndResidentHappiness
 
  
);


router.get(
  "/servicerequest/getAllRecords",
   getServiceRequestDetails
 
  
);

router.get(
  "/manager/getTodayDashboardTasksformanager/getAllRecords",
  getTodayDashboardTasksformanager
 
  
);


router.get(
  "/manager/getCheckInCheckoutAggregate/getAllRecords",
  getCheckInCheckoutAggregate
 
  
);

router.get(
  "/resident/getResidentHome/getAllRecords",
getResidentHome
 
  
);
router.get(
  "/resident/getResidentMyStay/getAllRecords",
getResidentMyStay
 
  
);


router.get(
  "/resident/getMyServiceRequests/getAllRecords",
getMyServiceRequests
 
  
);

router.get(
  "/resident/getResidentRentStatus/getAllRecords",
getResidentRentStatus
 
  
);

router.put(
  "/manager/updateCheckInCheckout/updateRecord",
updateCheckInCheckoutStatus 
 
  
);


router.get(
  "/resident/getResidentProfileSupport/getAllRecords",
getResidentProfileSupport
 
  
);


router.get(
  "/resident/getAnnouncements/getAllRecords",
getAnnouncementsController
 
  
);










export default router;