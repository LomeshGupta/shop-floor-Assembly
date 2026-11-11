import "server-only";
import { randomUUID } from "crypto";
import type {
  ApiError,
  ApiResult,
  Assignment,
  AssignmentLine,
  LoginResult,
  OperatorRole,
  PostOutputInput,
  AssignmentComponent,
  AssignmentTimeEntry,
  SaveConsumptionInput,
  RequestReplacementInput,
} from "../types";
import type { ShopFloorService } from "./types";

/**
 * In-memory demo adapter. Mirrors the shape of real BC data (and the real
 * adapter's authorization rules) closely enough that the whole app — login,
 * assignment list, start/stop timer, post output, supervisor cancel — works
 * end to end with BC_MODE=demo and no Business Central tenant at all.
 *
 * Demo credentials are plaintext here on purpose: this is a sandbox, not a
 * security boundary, and must never be reachable when BC_MODE is sandbox or
 * production (service.ts enforces that by construction — see getShopFloorService()).
 */

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function apiError(code: ApiError["code"], message: string): ApiError {
  return { code, message };
}

interface DemoOperator {
  operatorCode: string;
  password: string;
  displayName: string;
  role: OperatorRole;
  mustChangePassword: boolean;
}

const DEMO_OPERATORS: DemoOperator[] = [
  { operatorCode: "RAJU01", password: "demo1234", displayName: "Raju Kumar", role: "Operator", mustChangePassword: false },
  { operatorCode: "SITA01", password: "demo1234", displayName: "Sita Devi", role: "Operator", mustChangePassword: false },
  { operatorCode: "SUP01", password: "demo1234", displayName: "Vikram Singh (Supervisor)", role: "Supervisor", mustChangePassword: false },
];

const demoAssignments = new Map<string, Assignment>([
  [
    "SFA000001",
    {
      number: "SFA000001",
      assemblyOrderNo: "AO-10231",
      itemNo: "BIKE-FRAME-RED",
      description: "Red Frame Bicycle — Model X",
      locationCode: "MAIN",
      assignedOperatorCode: "RAJU01",
      assignedQtyBase: 20,
      postedQtyBase: 0,
      remainingQtyBase: 20,
      status: "Open",
      jobWorkReportNo: "",
      totalElapsedTimeSec: 0,
      lastModifiedAt: new Date().toISOString(),
      outputQtyToSubmitBase: 0,
      outputIsFinal: false,
      outputReportedAt: "",
      outputReportedBy: "",
    },
  ],
  [
    "SFA000002",
    {
      number: "SFA000002",
      assemblyOrderNo: "AO-10245",
      itemNo: "BIKE-FRAME-BLU",
      description: "Blue Frame Bicycle — Model X",
      locationCode: "MAIN",
      assignedOperatorCode: "SITA01",
      assignedQtyBase: 15,
      postedQtyBase: 6,
      remainingQtyBase: 9,
      status: "In Progress",
      jobWorkReportNo: "",
      totalElapsedTimeSec: 5400,
      lastModifiedAt: new Date().toISOString(),
      outputQtyToSubmitBase: 0,
      outputIsFinal: false,
      outputReportedAt: "",
      outputReportedBy: "",
    },
  ],
]);

const demoLines = new Map<string, AssignmentLine[]>([
  [
    "SFA000002",
    [
      {
        assignmentNo: "SFA000002",
        lineNo: 10000,
        postedQtyBase: 6,
        postingReference: "AO-10245-POST1",
        postingDate: new Date().toISOString().slice(0, 10),
        postedByOperatorCode: "SITA01",
        postedAt: new Date().toISOString(),
        isFinalPosting: false,
        isPostedToBC: true,
      },
    ],
  ],
]);

const demoComponents = new Map<string, AssignmentComponent[]>([
  [
    "SFA000001",
    [
      { assignmentNo: "SFA000001", lineNo: 10000, originalItemNo: "STEEL-PIPE", itemNo: "STEEL-PIPE", description: "Steel Pipe", unitOfMeasureCode: "PCS", lineUnitOfMeasureCode: "PCS", expectedQtyBase: 20, consumedQtyBase: 0, lastPostedConsumedQtyBase: 0, totalPostedConsumedQtyBase: 0, consumptionEntered: false, consumptionRemarks: "", replacementStatus: "None", requestedReplacementItemNo: "", replacementReason: "" },
      { assignmentNo: "SFA000001", lineNo: 20000, originalItemNo: "BOLT-M8", itemNo: "BOLT-M8", description: "Bolt M8", unitOfMeasureCode: "PCS", lineUnitOfMeasureCode: "PCS", expectedQtyBase: 80, consumedQtyBase: 0, lastPostedConsumedQtyBase: 0, totalPostedConsumedQtyBase: 0, consumptionEntered: false, consumptionRemarks: "", replacementStatus: "None", requestedReplacementItemNo: "", replacementReason: "" },
    ],
  ],
  [
    "SFA000002",
    [
      { assignmentNo: "SFA000002", lineNo: 10000, originalItemNo: "STEEL-PIPE", itemNo: "STEEL-PIPE", description: "Steel Pipe", unitOfMeasureCode: "PCS", lineUnitOfMeasureCode: "PCS", expectedQtyBase: 15, consumedQtyBase: 0, lastPostedConsumedQtyBase: 0, totalPostedConsumedQtyBase: 0, consumptionEntered: false, consumptionRemarks: "", replacementStatus: "None", requestedReplacementItemNo: "", replacementReason: "" },
      { assignmentNo: "SFA000002", lineNo: 20000, originalItemNo: "BOLT-M8", itemNo: "BOLT-M8", description: "Bolt M8", unitOfMeasureCode: "PCS", lineUnitOfMeasureCode: "PCS", expectedQtyBase: 60, consumedQtyBase: 0, lastPostedConsumedQtyBase: 0, totalPostedConsumedQtyBase: 0, consumptionEntered: false, consumptionRemarks: "", replacementStatus: "None", requestedReplacementItemNo: "", replacementReason: "" },
    ],
  ],
]);

const demoTimeEntries = new Map<string, AssignmentTimeEntry[]>([
  ["SFA000002", [{
    entryNo: 1,
    assignmentNo: "SFA000002",
    operatorCode: "SITA01",
    startedAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
    stoppedAt: "",
    elapsedSeconds: 0,
    isOpen: true,
  }]],
]);
let nextDemoTimeEntryNo = 2;

const demoIdempotencyKeys = new Set<string>();

// Demo "sessions": token -> operatorCode. In-memory only, resets on server restart.
const demoSessions = new Map<string, string>();

function findOperator(sessionToken: string): DemoOperator | null {
  const operatorCode = demoSessions.get(sessionToken);
  if (!operatorCode) return null;
  return DEMO_OPERATORS.find((o) => o.operatorCode === operatorCode) ?? null;
}

export const demoAdapter: ShopFloorService = {
  async login(operatorCode, password): Promise<ApiResult<LoginResult>> {
    await delay(300);
    const match = DEMO_OPERATORS.find(
      (op) => op.operatorCode.toLowerCase() === operatorCode.trim().toLowerCase(),
    );
    if (!match || match.password !== password) {
      return { ok: false, error: apiError("UNAUTHORIZED", "Invalid operator code or password.") };
    }
    const sessionToken = randomUUID();
    demoSessions.set(sessionToken, match.operatorCode);
    return {
      ok: true,
      data: {
        operatorCode: match.operatorCode,
        displayName: match.displayName,
        role: match.role,
        mustChangePassword: match.mustChangePassword,
        sessionToken,
      },
    };
  },

  async logout(sessionToken): Promise<ApiResult<void>> {
    demoSessions.delete(sessionToken);
    return { ok: true, data: undefined };
  },

  async getMyAssignments(sessionToken): Promise<ApiResult<Assignment[]>> {
    await delay(250);
    const operator = findOperator(sessionToken);
    if (!operator) return { ok: false, error: apiError("UNAUTHORIZED", "Your session has expired. Please log in again.") };
    const mine = [...demoAssignments.values()].filter(
      (a) => operator.role !== "Operator" || a.assignedOperatorCode === operator.operatorCode,
    );
    return { ok: true, data: mine };
  },

  async getAssignment(sessionToken, assignmentNo): Promise<ApiResult<Assignment>> {
    await delay(200);
    const operator = findOperator(sessionToken);
    if (!operator) return { ok: false, error: apiError("UNAUTHORIZED", "Your session has expired. Please log in again.") };
    const assignment = demoAssignments.get(assignmentNo);
    if (!assignment) return { ok: false, error: apiError("NOT_FOUND", "That assignment could not be found.") };
    if (operator.role === "Operator" && assignment.assignedOperatorCode !== operator.operatorCode) {
      return { ok: false, error: apiError("FORBIDDEN", "You are not the assigned operator for this assignment.") };
    }
    return { ok: true, data: assignment };
  },

  async startWork(sessionToken, assignmentNo): Promise<ApiResult<Assignment>> {
    await delay(250);
    const operator = findOperator(sessionToken);
    if (!operator) return { ok: false, error: apiError("UNAUTHORIZED", "Your session has expired. Please log in again.") };
    const assignment = demoAssignments.get(assignmentNo);
    if (!assignment) return { ok: false, error: apiError("NOT_FOUND", "That assignment could not be found.") };
    if (assignment.assignedOperatorCode !== operator.operatorCode) {
      return { ok: false, error: apiError("FORBIDDEN", "You are not the assigned operator for this assignment.") };
    }
    if (!["Open", "Paused"].includes(assignment.status)) {
      return { ok: false, error: apiError("CONFLICT", `Cannot start work while status is ${assignment.status}.`) };
    }
    const entries = demoTimeEntries.get(assignmentNo) ?? [];
    if (entries.some((entry) => entry.isOpen)) return { ok: false, error: apiError("CONFLICT", "A timer is already running for this assignment.") };
    entries.push({
      entryNo: nextDemoTimeEntryNo++,
      assignmentNo,
      operatorCode: operator.operatorCode,
      startedAt: new Date().toISOString(),
      stoppedAt: "",
      elapsedSeconds: 0,
      isOpen: true,
    });
    demoTimeEntries.set(assignmentNo, entries);
    assignment.status = "In Progress";
    assignment.lastModifiedAt = new Date().toISOString();
    return { ok: true, data: assignment };
  },

  async stopWork(sessionToken, assignmentNo, pause): Promise<ApiResult<Assignment>> {
    await delay(250);
    const operator = findOperator(sessionToken);
    if (!operator) return { ok: false, error: apiError("UNAUTHORIZED", "Your session has expired. Please log in again.") };
    const assignment = demoAssignments.get(assignmentNo);
    if (!assignment) return { ok: false, error: apiError("NOT_FOUND", "That assignment could not be found.") };
    if (assignment.assignedOperatorCode !== operator.operatorCode) {
      return { ok: false, error: apiError("FORBIDDEN", "You are not the assigned operator for this assignment.") };
    }
    const entries = demoTimeEntries.get(assignmentNo) ?? [];
    const openEntry = [...entries].reverse().find((entry) => entry.isOpen && entry.operatorCode === operator.operatorCode);
    if (!openEntry) return { ok: false, error: apiError("CONFLICT", "No running timer was found for this assignment.") };
    const stoppedAt = new Date();
    openEntry.stoppedAt = stoppedAt.toISOString();
    openEntry.elapsedSeconds = Math.max(0, Math.floor((stoppedAt.getTime() - new Date(openEntry.startedAt).getTime()) / 1000));
    openEntry.isOpen = false;
    assignment.totalElapsedTimeSec = entries.reduce((total, entry) => total + entry.elapsedSeconds, 0);
    assignment.status = pause ? "Paused" : "Open";
    assignment.lastModifiedAt = stoppedAt.toISOString();
    return { ok: true, data: assignment };
  },

  async reportOutput(sessionToken, input: PostOutputInput): Promise<ApiResult<Assignment>> {
    await delay(300);
    const operator = findOperator(sessionToken);
    if (!operator) return { ok: false, error: apiError("UNAUTHORIZED", "Your session has expired. Please log in again.") };
    const assignment = demoAssignments.get(input.assignmentNo);
    if (!assignment) return { ok: false, error: apiError("NOT_FOUND", "That assignment could not be found.") };
    if (assignment.assignedOperatorCode !== operator.operatorCode) return { ok: false, error: apiError("FORBIDDEN", "You are not the assigned operator for this assignment.") };
    if (!Number.isFinite(input.qtyToPostBase) || input.qtyToPostBase <= 0 || input.qtyToPostBase > assignment.remainingQtyBase) {
      return { ok: false, error: apiError("VALIDATION_ERROR", "Enter a valid output quantity within the remaining assigned quantity.") };
    }
    if (assignment.outputQtyToSubmitBase > 0) return { ok: false, error: apiError("CONFLICT", "Output is already awaiting submission from Business Central.") };
    assignment.outputQtyToSubmitBase = input.qtyToPostBase;
    assignment.outputIsFinal = input.isFinal;
    assignment.outputReportedAt = new Date().toISOString();
    assignment.outputReportedBy = operator.operatorCode;
    assignment.lastModifiedAt = new Date().toISOString();
    const history = demoLines.get(input.assignmentNo) ?? [];
    const nextLineNo = history.reduce((max, row) => Math.max(max, row.lineNo), 0) + 10000;
    history.push({
      assignmentNo: input.assignmentNo,
      lineNo: nextLineNo,
      postedQtyBase: 0,
      postingReference: "",
      postingDate: "",
      postedByOperatorCode: "",
      postedAt: "",
      isFinalPosting: input.isFinal,
      reportedQtyBase: input.qtyToPostBase,
      reportedByOperatorCode: operator.operatorCode,
      reportedAt: assignment.outputReportedAt,
      isPostedToBC: false,
    });
    demoLines.set(input.assignmentNo, history);
    return { ok: true, data: assignment };
  },

  async getAssignmentComponents(sessionToken, assignmentNo): Promise<ApiResult<AssignmentComponent[]>> {
    await delay(150);
    const operator = findOperator(sessionToken);
    if (!operator) return { ok: false, error: apiError("UNAUTHORIZED", "Your session has expired. Please log in again.") };
    const assignment = demoAssignments.get(assignmentNo);
    if (!assignment) return { ok: false, error: apiError("NOT_FOUND", "That assignment could not be found.") };
    if (operator.role === "Operator" && assignment.assignedOperatorCode !== operator.operatorCode) return { ok: false, error: apiError("FORBIDDEN", "You are not assigned to this job.") };
    return { ok: true, data: demoComponents.get(assignmentNo) ?? [] };
  },

  async saveConsumption(sessionToken, input: SaveConsumptionInput): Promise<ApiResult<AssignmentComponent>> {
    await delay(200);
    const operator = findOperator(sessionToken);
    if (!operator) return { ok: false, error: apiError("UNAUTHORIZED", "Your session has expired. Please log in again.") };
    const assignment = demoAssignments.get(input.assignmentNo);
    if (!assignment || assignment.assignedOperatorCode !== operator.operatorCode) return { ok: false, error: apiError("FORBIDDEN", "You are not assigned to this job.") };
    if (assignment.status === "Completed" || assignment.status === "Cancelled" || assignment.outputQtyToSubmitBase > 0) return { ok: false, error: apiError("CONFLICT", "Consumption cannot be changed after output has been staged or the assignment is closed.") };
    const line = (demoComponents.get(input.assignmentNo) ?? []).find((component) => component.lineNo === input.lineNo);
    if (!line) return { ok: false, error: apiError("NOT_FOUND", "The BOM component could not be found.") };
    if (!Number.isFinite(input.qtyConsumedBase) || input.qtyConsumedBase < 0) return { ok: false, error: apiError("VALIDATION_ERROR", "Consumed quantity cannot be negative.") };
    const totalPosted = line.totalPostedConsumedQtyBase ?? line.lastPostedConsumedQtyBase;
    const remainingAllowance = Math.max(0, line.expectedQtyBase - totalPosted);
    if (input.qtyConsumedBase > remainingAllowance + 0.00001) {
      return { ok: false, error: apiError("VALIDATION_ERROR", `Consumption exceeds the remaining expected allowance of ${remainingAllowance} ${line.unitOfMeasureCode}.`) };
    }
    line.totalPostedConsumedQtyBase = totalPosted;
    line.consumedQtyBase = input.qtyConsumedBase;
    line.consumptionEntered = true;
    line.consumptionRemarks = input.remarks;
    return { ok: true, data: line };
  },

  async requestReplacement(sessionToken, input: RequestReplacementInput): Promise<ApiResult<AssignmentComponent>> {
    await delay(200);
    const operator = findOperator(sessionToken);
    if (!operator) return { ok: false, error: apiError("UNAUTHORIZED", "Your session has expired. Please log in again.") };
    const assignment = demoAssignments.get(input.assignmentNo);
    if (!assignment || assignment.assignedOperatorCode !== operator.operatorCode) return { ok: false, error: apiError("FORBIDDEN", "You are not assigned to this job.") };
    if (assignment.status === "Completed" || assignment.status === "Cancelled" || assignment.outputQtyToSubmitBase > 0) return { ok: false, error: apiError("CONFLICT", "Replacement requests cannot be changed after output has been staged or the assignment is closed.") };
    const line = (demoComponents.get(input.assignmentNo) ?? []).find((component) => component.lineNo === input.lineNo);
    if (!line) return { ok: false, error: apiError("NOT_FOUND", "The BOM component could not be found.") };
    if (!input.replacementItemNo.trim() || input.replacementItemNo.trim() === line.itemNo) return { ok: false, error: apiError("VALIDATION_ERROR", "Enter a different replacement item number.") };
    if (!input.reason.trim()) return { ok: false, error: apiError("VALIDATION_ERROR", "Enter a reason for the replacement request.") };
    if (line.replacementStatus === "Pending") return { ok: false, error: apiError("CONFLICT", "A replacement request is already pending for this component.") };
    line.replacementStatus = "Pending";
    line.requestedReplacementItemNo = input.replacementItemNo.trim().toUpperCase();
    line.replacementReason = input.reason;
    return { ok: true, data: line };
  },

  async getAssignmentHistory(sessionToken, assignmentNo): Promise<ApiResult<AssignmentLine[]>> {
    await delay(200);
    const operator = findOperator(sessionToken);
    if (!operator) return { ok: false, error: apiError("UNAUTHORIZED", "Your session has expired. Please log in again.") };
    const assignment = demoAssignments.get(assignmentNo);
    if (!assignment) return { ok: false, error: apiError("NOT_FOUND", "That assignment could not be found.") };
    if (operator.role === "Operator" && assignment.assignedOperatorCode !== operator.operatorCode) return { ok: false, error: apiError("FORBIDDEN", "You are not assigned to this job.") };
    return { ok: true, data: (demoLines.get(assignmentNo) ?? []).map((row) => ({ ...row })) };
  },

  async getAssignmentTimeEntries(sessionToken, assignmentNo): Promise<ApiResult<AssignmentTimeEntry[]>> {
    await delay(150);
    const operator = findOperator(sessionToken);
    if (!operator) return { ok: false, error: apiError("UNAUTHORIZED", "Your session has expired. Please log in again.") };
    const assignment = demoAssignments.get(assignmentNo);
    if (!assignment) return { ok: false, error: apiError("NOT_FOUND", "That assignment could not be found.") };
    if (operator.role === "Operator" && assignment.assignedOperatorCode !== operator.operatorCode) return { ok: false, error: apiError("FORBIDDEN", "You are not assigned to this job.") };
    const entries = (demoTimeEntries.get(assignmentNo) ?? []).filter((entry) => operator.role !== "Operator" || entry.operatorCode === operator.operatorCode);
    return { ok: true, data: entries.map((entry) => ({ ...entry })) };
  },

  async cancelAssignment(sessionToken, assignmentNo, reason): Promise<ApiResult<Assignment>> {
    await delay(250);
    const operator = findOperator(sessionToken);
    if (!operator) return { ok: false, error: apiError("UNAUTHORIZED", "Your session has expired. Please log in again.") };
    if (operator.role === "Operator") {
      return { ok: false, error: apiError("FORBIDDEN", "Your role does not permit this action.") };
    }
    const assignment = demoAssignments.get(assignmentNo);
    if (!assignment) return { ok: false, error: apiError("NOT_FOUND", "That assignment could not be found.") };
    if (assignment.status === "Completed") {
      return { ok: false, error: apiError("CONFLICT", "This assignment is already completed and cannot be cancelled.") };
    }
    void reason; // demo: not persisted anywhere to show, BC's Audit Log is the real record of this
    assignment.status = "Cancelled";
    assignment.lastModifiedAt = new Date().toISOString();
    return { ok: true, data: assignment };
  },
};
