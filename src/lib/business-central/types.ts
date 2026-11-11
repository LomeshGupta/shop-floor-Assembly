/**
 * Domain types for the Shop Floor Assembly PWA.
 *
 * Replaces the earlier Production Order domain. This app is now a thin
 * operator UI over standard Business Central Assembly Orders via the
 * Velvotix Shop Floor Assembly extension (see OBJECT-ID-ALLOCATION.md in
 * that extension's repo). Field names mirror the extension's API pages and
 * ServiceEnabled action codeunits field-for-field.
 */

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError };

export interface ApiError {
  code:
    | "UNAUTHORIZED"
    | "FORBIDDEN"
    | "NOT_FOUND"
    | "CONFLICT"
    | "RATE_LIMITED"
    | "VALIDATION_ERROR"
    | "NOT_IMPLEMENTED"
    | "SERVER_ERROR"
    | "NETWORK_ERROR"
    | "CONFIG_ERROR"
    | "LOCKED";
  message: string;
  detail?: string;
  httpStatus?: number;
}

export type OperatorRole = "Operator" | "Supervisor" | "Admin";

/**
 * The operator identity exposed to client code (via /api/auth/session).
 * Deliberately never includes the BC session token — that stays in the
 * HTTP-only cookie and server-side code only; see lib/session/session.ts.
 */
export interface Operator {
  operatorCode: string;
  displayName: string;
  role: OperatorRole;
  mustChangePassword: boolean;
}

export type AssignmentStatus =
  | "Open"
  | "In Progress"
  | "Paused"
  | "Completed"
  | "Cancelled";

export interface Assignment {
  number: string;
  assemblyOrderNo: string;
  itemNo: string;
  description: string;
  locationCode: string;
  assignedOperatorCode: string;
  assignedQtyBase: number;
  postedQtyBase: number;
  remainingQtyBase: number;
  status: AssignmentStatus;
  jobWorkReportNo: string;
  totalElapsedTimeSec: number;
  lastModifiedAt: string;
  outputQtyToSubmitBase: number;
  outputIsFinal: boolean;
  outputReportedAt?: string;
  outputReportedBy?: string;
}

export interface AssignmentComponent {
  assignmentNo: string;
  lineNo: number;
  originalItemNo: string;
  itemNo: string;
  description: string;
  unitOfMeasureCode: string;
  lineUnitOfMeasureCode: string;
  expectedQtyBase: number;
  consumedQtyBase: number;
  lastPostedConsumedQtyBase: number;
  /** Cumulative operator-entered consumption successfully posted to BC. */
  totalPostedConsumedQtyBase?: number;
  consumptionEntered: boolean;
  consumptionRemarks: string;
  replacementStatus: "None" | "Pending" | "Approved" | "Rejected";
  requestedReplacementItemNo: string;
  replacementReason: string;
}

export interface AssignmentLine {
  assignmentNo: string;
  lineNo: number;
  postedQtyBase: number;
  postingReference: string;
  postingDate: string;
  postedByOperatorCode: string;
  postedAt: string;
  isFinalPosting: boolean;
  reportedQtyBase?: number;
  reportedByOperatorCode?: string;
  reportedAt?: string;
  isPostedToBC?: boolean;
}


export interface AssignmentTimeEntry {
  entryNo: number;
  assignmentNo: string;
  operatorCode: string;
  startedAt: string;
  stoppedAt: string;
  elapsedSeconds: number;
  isOpen: boolean;
}

export interface LoginResult extends Operator {
  /** BC session token (Codeunit 78568 "Shop Floor Authentication API".Login). Server-only; never sent to the browser as JSON. */
  sessionToken: string;
}

export interface PostOutputInput {
  assignmentNo: string;
  qtyToPostBase: number;
  isFinal: boolean;
  /** Client-generated UUID so a retried/duplicated submit never double-posts. */
  idempotencyKey: string;
}

export interface SaveConsumptionInput {
  assignmentNo: string;
  lineNo: number;
  qtyConsumedBase: number;
  remarks: string;
}

export interface RequestReplacementInput {
  assignmentNo: string;
  lineNo: number;
  replacementItemNo: string;
  reason: string;
}
