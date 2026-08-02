// import { launchBrowser } from "./browser";
// import { extractPricingText } from "./scrapper";
// import { analyzePricingByLLM } from "./llm";
// import {
//   createJob,
//   updateJobFinalPaymentStatus,
//   updateJobPravaSession,
// } from "./jobStore";
// import { eventLogger } from "./eventLogger";
// import { createPravaSessionFromPlannerJob } from "./pravaSession";
// import {
//   watchAndTriggerMerchantPayment,
//   type MerchantPaymentWatcherResult,
// } from "./merchantPayment";

// export type DependencyEventPayload = {
//   dependency_merchant: string;
//   dependency_working_status: string;
//   merchant_billing_url: string;
//   client_username: string;
//   client_token: string;
// };

// type PlannerNormalizedEvent = DependencyEventPayload & {
//   dependency?: string;
//   billing_url?: string;
//   dependency_status?: string;
// };

// export type PlannerResult = {
//   success: true;
//   jobId: string;
//   purchasePlan: {
//     merchantName: string;
//     exactCost: number;
//     recommendedPlan: {
//       name: string;
//       rationale: string;
//     };
//   };
//   pravaSession?: {
//     sessionId?: string;
//     sessionToken?: string;
//     iframeUrl?: string;
//   };
//   pravaSessionError?: string;
//   merchantPaymentOutcome?: MerchantPaymentWatcherResult;
//   elapsedMs: number;
// };

// export async function planner(
//   event: PlannerNormalizedEvent,
// ): Promise<PlannerResult> {
//   const startTime = Date.now();

//   console.log("[planner/start]");

//   // ###############################################################################################################
//   // Stage 0: Normalize incoming event shape so downstream steps use one contract.
//   // ###############################################################################################################

//   const normalizedEvent = {
//     ...event,
//     dependency: event.dependency ?? event.dependency_merchant,
//     billing_url: event.billing_url ?? event.merchant_billing_url,
//     dependency_status:
//       event.dependency_status ?? event.dependency_working_status,
//   };

//   // ###############################################################################################################
//   // Stage 1: Announce workflow start and launch browser for target billing page.
//   // ###############################################################################################################

//   eventLogger.info("New incident - Planner activated", {
//     stage: "planner_start",
//     dependency: normalizedEvent.dependency,
//     billing_url: normalizedEvent.billing_url,
//   });

//   eventLogger.info("Launching merchant pricing page in browser.", {
//     stage: "browser_launch",
//     url: normalizedEvent.billing_url,
//   });
//   const page = await launchBrowser(normalizedEvent.billing_url);

//   // ###############################################################################################################
//   // Stage 2: Scrape page pricing text and close browser resources immediately after capture.
//   // ###############################################################################################################

//   eventLogger.info("Scraping page.", { stage: "scraping" });
//   const pricingText = await extractPricingText(page);
//   eventLogger.info("Scraping successfull.", {
//     stage: "scrape_complete",
//     scrapedTextLength: typeof pricingText === "string" ? pricingText.length : 0,
//   });

//   await page.context().close();
//   eventLogger.info("Closing browser context now.", { stage: "browser_closed" });

//   // ###############################################################################################################
//   // Stage 3: Send scraped text to analyzer and record model decision details.
//   // ###############################################################################################################

//   eventLogger.info("Sending scrapped data to LLM for analysis.", {
//     stage: "llm_analysis",
//     scrapedTextLength: typeof pricingText === "string" ? pricingText.length : 0,
//   });
//   const purchasePlan = await analyzePricingByLLM(pricingText, normalizedEvent);
//   eventLogger.info("Fetched LLMs analyzed data.", {
//     stage: "llm_response",
//     plan: purchasePlan?.recommendedPlan?.name,
//     exactCost: purchasePlan?.exactCost,
//     merchant: purchasePlan?.merchantName,
//   });
//   eventLogger.success(
//     `LLM selected plan: ${purchasePlan.recommendedPlan?.name} @ ${purchasePlan.exactCost}`,
//     {
//       stage: "llm_decision",
//       plan: purchasePlan.recommendedPlan?.name,
//       cost: purchasePlan.exactCost,
//       merchant: purchasePlan.merchantName,
//     },
//   );

//   // ###############################################################################################################
//   // Stage 4: Persist job record for dashboard/traceability and finalize result metadata.
//   // ###############################################################################################################

//   const job = await createJob({
//     event: normalizedEvent,
//     purchasePlan,
//   });
//   eventLogger.info(`Job created with id: ${job.id}`, {
//     stage: "job_created",
//     jobId: job.id,
//   });

//   // ###############################################################################################################
//   // Stage 5: Use the planner job output to create a Prava payment session.
//   // ###############################################################################################################

//   let pravaSession: PlannerResult["pravaSession"];
//   let pravaSessionError: string | undefined;

//   try {
//     eventLogger.info(`Creating Prava session from job@${job.id}.`, {
//       stage: "prava_session_create",
//       jobId: job.id,
//     });

//     const session = await createPravaSessionFromPlannerJob(job);
//     pravaSession = {
//       sessionId: session.session_id,
//       sessionToken: session.session_token,
//       iframeUrl: session.iframe_url,
//     };
//     await updateJobPravaSession(job.id, pravaSession);
//     eventLogger.success("Prava session initialized.", {
//       stage: "prava_session_created",
//       jobId: job.id,
//       sessionId: session.session_id,
//     });
//   } catch (error) {
//     // Keep planner successful even if session creation fails; surface error in response payload.
//     pravaSessionError =
//       error instanceof Error ? error.message : "Unknown Prava session error";
//     await updateJobPravaSession(job.id, undefined, pravaSessionError);
//     eventLogger.error("Failed to create Prava session.", {
//       stage: "prava_session_error",
//       jobId: job.id,
//       error: pravaSessionError,
//     });
//   }

//   // Stage 6: Await credential watcher — poll Prava until credentials are ready, then trigger merchant automation.
//   const merchantCheckoutUrl =
//     process.env.MERCHANT_CHECKOUT_URL ??
//     "http://localhost:3001/checkout?plan=Developer&client_id=client_auth_12345";

//   let merchantPaymentOutcome: MerchantPaymentWatcherResult;

//   if (pravaSession?.sessionId) {
//     eventLogger.info("Watching for credential generation.", {
//       stage: "merchant_payment_watcher_start",
//       sessionId: pravaSession.sessionId,
//       merchantCheckoutUrl,
//     });
//     merchantPaymentOutcome = await watchAndTriggerMerchantPayment({
//       sessionId: pravaSession.sessionId,
//       merchantCheckoutUrl,
//     });
//   } else {
//     merchantPaymentOutcome = { outcome: "skipped" };
//   }

//   await updateJobFinalPaymentStatus(job.id, merchantPaymentOutcome.outcome);

//   eventLogger.success("Planner complete", {
//     stage: "planner_complete",
//     jobId: job.id,
//     elapsedMs: Date.now() - startTime,
//   });
  
//   console.log("[planner/end]");

//   const result: PlannerResult = {
//     success: true,
//     jobId: job.id,
//     purchasePlan,
//     elapsedMs: Date.now() - startTime,
//   };

//   if (pravaSession) {
//     result.pravaSession = pravaSession;
//   }

//   if (pravaSessionError) {
//     result.pravaSessionError = pravaSessionError;
//   }

//   result.merchantPaymentOutcome = merchantPaymentOutcome;

  

//   return result;
// }

// export const runPlanner = planner;

// #######################################################################################################
// Development mode: planner execution is temporarily disabled. Uncomment the following line to enable it.
// #######################################################################################################

import { launchBrowser } from "./browser";
import { extractPricingText } from "./scrapper";
import { analyzePricingByLLM } from "./llm";
import {
  createJob,
  updateJobFinalPaymentStatus,
} from "./jobStore";
import { eventLogger } from "./eventLogger";
import { type MerchantPaymentWatcherResult } from "./merchantPayment";

export type DependencyEventPayload = {
  dependency_merchant: string;
  dependency_working_status: string;
  merchant_billing_url: string;
  client_username: string;
  client_token: string;
};

type PlannerNormalizedEvent = DependencyEventPayload & {
  dependency?: string;
  billing_url?: string;
  dependency_status?: string;
};

export type PlannerResult = {
  success: true;
  jobId: string;
  purchasePlan: {
    merchantName: string;
    exactCost: number;
    recommendedPlan: {
      name: string;
      rationale: string;
    };
  };
  pravaSession?: {
    sessionId?: string;
    sessionToken?: string;
    iframeUrl?: string;
  };
  pravaSessionError?: string;
  merchantPaymentOutcome?: MerchantPaymentWatcherResult;
  elapsedMs: number;
};

export async function planner(
  event: PlannerNormalizedEvent,
): Promise<PlannerResult> {
  const startTime = Date.now();

  console.log("[planner/start]");

  // ###############################################################################################################
  // Stage 0: Normalize incoming event shape so downstream steps use one contract.
  // ###############################################################################################################

  const normalizedEvent = {
    ...event,
    dependency: event.dependency ?? event.dependency_merchant,
    billing_url: event.billing_url ?? event.merchant_billing_url,
    dependency_status:
      event.dependency_status ?? event.dependency_working_status,
  };

  // ###############################################################################################################
  // Stage 1: Announce workflow start and launch browser for target billing page.
  // ###############################################################################################################

  eventLogger.info("New incident - Planner activated", {
    stage: "planner_start",
    dependency: normalizedEvent.dependency,
    billing_url: normalizedEvent.billing_url,
  });

  eventLogger.info("Launching merchant pricing page in browser.", {
    stage: "browser_launch",
    url: normalizedEvent.billing_url,
  });
  const page = await launchBrowser(normalizedEvent.billing_url);

  // ###############################################################################################################
  // Stage 2: Scrape page pricing text and close browser resources immediately after capture.
  // ###############################################################################################################

  eventLogger.info("Scraping page.", { stage: "scraping" });
  const pricingText = await extractPricingText(page);
  eventLogger.info("Scraping successfull.", {
    stage: "scrape_complete",
    scrapedTextLength: typeof pricingText === "string" ? pricingText.length : 0,
  });

  await page.context().close();
  eventLogger.info("Closing browser context now.", { stage: "browser_closed" });

  // ###############################################################################################################
  // Stage 3: Send scraped text to analyzer and record model decision details.
  // ###############################################################################################################

  eventLogger.info("Sending scrapped data to LLM for analysis.", {
    stage: "llm_analysis",
    scrapedTextLength: typeof pricingText === "string" ? pricingText.length : 0,
  });
  const purchasePlan = await analyzePricingByLLM(pricingText, normalizedEvent);
  eventLogger.info("Fetched LLMs analyzed data.", {
    stage: "llm_response",
    plan: purchasePlan?.recommendedPlan?.name,
    exactCost: purchasePlan?.exactCost,
    merchant: purchasePlan?.merchantName,
  });
  eventLogger.success(
    `LLM selected plan: ${purchasePlan.recommendedPlan?.name} @ ${purchasePlan.exactCost}`,
    {
      stage: "llm_decision",
      plan: purchasePlan.recommendedPlan?.name,
      cost: purchasePlan.exactCost,
      merchant: purchasePlan.merchantName,
    },
  );

  // ###############################################################################################################
  // Stage 4: Persist job record for dashboard/traceability and finalize result metadata.
  // ###############################################################################################################

  const job = await createJob({
    event: normalizedEvent,
    purchasePlan,
  });
  eventLogger.info(`Job created with id: ${job.id}`, {
    stage: "job_created",
    jobId: job.id,
  });

  // ###############################################################################################################
  // Stage 5: Temporarily disabled during development.
  // ###############################################################################################################

  let pravaSession: PlannerResult["pravaSession"];
  const pravaSessionError =
    "Temporarily skipped Prava session creation during development.";

  eventLogger.info("Skipping Prava session creation for development.", {
    stage: "prava_session_skipped_dev",
    jobId: job.id,
  });

  // ###############################################################################################################
  // Stage 6: Temporarily disabled during development.
  // ###############################################################################################################

  const merchantPaymentOutcome: MerchantPaymentWatcherResult = {
    outcome: "skipped_dev_mode",
  };

  eventLogger.info("Skipping merchant payment watcher for development.", {
    stage: "merchant_payment_watcher_skipped_dev",
    jobId: job.id,
  });

  await updateJobFinalPaymentStatus(job.id, merchantPaymentOutcome.outcome);

  eventLogger.success("Planner complete", {
    stage: "planner_complete",
    jobId: job.id,
    elapsedMs: Date.now() - startTime,
  });
  
  console.log("[planner/end]");

  const result: PlannerResult = {
    success: true,
    jobId: job.id,
    purchasePlan,
    elapsedMs: Date.now() - startTime,
  };

  if (pravaSession) {
    result.pravaSession = pravaSession;
  }

  if (pravaSessionError) {
    result.pravaSessionError = pravaSessionError;
  }

  result.merchantPaymentOutcome = merchantPaymentOutcome;

  return result;
}

export const runPlanner = planner;
