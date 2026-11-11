import type {
  ApiResult,
  Assignment,
  AssignmentLine,
  AssignmentComponent,
  AssignmentTimeEntry,
  SaveConsumptionInput,
  RequestReplacementInput,
  LoginResult,
  PostOutputInput,
} from "../types";

/**
 * Everything the UI/API-route layer needs from "Business Central", expressed
 * as a single interface. The UI never imports the demo or real adapter
 * directly — it imports `getShopFloorService()` from `../service`, which
 * picks the right implementation based on BC_MODE.
 *
 * Every method except `login` takes `sessionToken` — the opaque BC session
 * token from Codeunit 78568.Login — rather than an operator code, because
 * BC itself (not this layer) is what re-derives "who is calling" from it.
 * An adapter implementation must never accept an operator identity as a
 * trusted bare parameter for anything that writes data.
 */
export interface ShopFloorService {
  /** Calls Codeunit 78568 "Shop Floor Authentication API".Login. */
  login(operatorCode: string, password: string): Promise<ApiResult<LoginResult>>;

  /** Calls Codeunit 78568.Logout. Best-effort — the PWA clears its own cookie regardless. */
  logout(sessionToken: string): Promise<ApiResult<void>>;

  /** Lists assignments for the calling operator (BC API page 78551, filtered server-side by the resolved operator). */
  getMyAssignments(sessionToken: string): Promise<ApiResult<Assignment[]>>;

  getAssignment(
    sessionToken: string,
    assignmentNo: string,
  ): Promise<ApiResult<Assignment>>;

  /** Codeunit 78569 "Shop Floor Assembly Actions API".StartWork. */
  startWork(
    sessionToken: string,
    assignmentNo: string,
  ): Promise<ApiResult<Assignment>>;

  /** Codeunit 78569.StopWork. */
  stopWork(
    sessionToken: string,
    assignmentNo: string,
    pause: boolean,
  ): Promise<ApiResult<Assignment>>;

  /** Records output for review; final posting is initiated from Business Central. */
  reportOutput(
    sessionToken: string,
    input: PostOutputInput,
  ): Promise<ApiResult<Assignment>>;

  getAssignmentComponents(
    sessionToken: string,
    assignmentNo: string,
  ): Promise<ApiResult<AssignmentComponent[]>>;

  saveConsumption(
    sessionToken: string,
    input: SaveConsumptionInput,
  ): Promise<ApiResult<AssignmentComponent>>;

  requestReplacement(
    sessionToken: string,
    input: RequestReplacementInput,
  ): Promise<ApiResult<AssignmentComponent>>;

  getAssignmentHistory(
    sessionToken: string,
    assignmentNo: string,
  ): Promise<ApiResult<AssignmentLine[]>>;

  getAssignmentTimeEntries(
    sessionToken: string,
    assignmentNo: string,
  ): Promise<ApiResult<AssignmentTimeEntry[]>>;

  /** Codeunit 78569.CancelAssignment. Supervisor/Admin only — BC re-checks role regardless of what the PWA believes. */
  cancelAssignment(
    sessionToken: string,
    assignmentNo: string,
    reason: string,
  ): Promise<ApiResult<Assignment>>;
}
