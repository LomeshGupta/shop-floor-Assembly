import "server-only";
import type { ShopFloorService } from "./types";
import { shopFloorApiRequest, callODataAction } from "../client";
import { getBcConfig } from "../config";
import { getOperatorSession } from "../../session/session";
import type {
  ApiResult,
  Assignment,
  AssignmentLine,
  AssignmentComponent,
  AssignmentTimeEntry,
  LoginResult,
  PostOutputInput,
  SaveConsumptionInput,
  RequestReplacementInput,
} from "../types";

/**
 * Real Business Central adapter (BC_MODE=sandbox | production).
 *
 * Reads go through the auto-published API pages (78550-78554). Login and
 * write operations use OData V4 unbound actions exposed by the two published
 * codeunit web services (78568 and 78569). Their exact Service Name values
 * are configured in BC_AUTH_SERVICE_NAME / BC_ACTIONS_SERVICE_NAME.
 */

interface BcApiPageResponse<T> {
  value: T[];
}

interface BcAssignmentDto {
  systemId: string;
  number: string;
  assemblyOrderNo: string;
  itemNo: string;
  description: string;
  locationCode: string;
  assignedOperatorCode: string;
  assignedQtyBase: number;
  postedQtyBase: number;
  remainingQtyBase: number;
  status: string;
  jobWorkReportNo: string;
  totalElapsedTimeSec: number;
  lastModifiedAt: string;
  outputQtyToSubmitBase?: number;
  outputIsFinal?: boolean;
  outputReportedAt?: string;
  outputReportedBy?: string;
}

function toAssignment(dto: BcAssignmentDto): Assignment {
  return {
    number: dto.number,
    assemblyOrderNo: dto.assemblyOrderNo,
    itemNo: dto.itemNo,
    description: dto.description,
    locationCode: dto.locationCode,
    assignedOperatorCode: dto.assignedOperatorCode,
    assignedQtyBase: dto.assignedQtyBase,
    postedQtyBase: dto.postedQtyBase,
    remainingQtyBase: dto.remainingQtyBase,
    status: normalizeAssignmentStatus(dto.status) as Assignment["status"],
    jobWorkReportNo: dto.jobWorkReportNo,
    totalElapsedTimeSec: dto.totalElapsedTimeSec,
    lastModifiedAt: dto.lastModifiedAt,
    outputQtyToSubmitBase: dto.outputQtyToSubmitBase ?? 0,
    outputIsFinal: dto.outputIsFinal ?? false,
    outputReportedAt: dto.outputReportedAt ?? "",
    outputReportedBy: dto.outputReportedBy ?? "",
  };
}

function normalizeAssignmentStatus(value: string): Assignment["status"] {
  const decoded = value
    .replace(/_x([0-9a-f]{4})_/gi, (_match, hex: string) =>
      String.fromCharCode(parseInt(hex, 16)),
    )
    .trim()
    .toLowerCase();

  switch (decoded) {
    case "open":
      return "Open";

    case "in progress":
      return "In Progress";

    case "paused":
      return "Paused";

    case "completed":
      return "Completed";

    case "cancelled":
    case "canceled":
      return "Cancelled";

    default:
      console.error("Unknown assignment status:", value);
      return "Open";
  }
}

function odataString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

interface ActionResponse {
  success: boolean;
  number?: string;
  status?: string;
  postedQtyBase?: number;
  remainingQtyBase?: number;
  totalElapsedTimeSec?: number;
  outputQtyToSubmitBase?: number;
  outputIsFinal?: boolean;
  outputReportedAt?: string;
  outputReportedBy?: string;
  message?: string;
}

function mergeActionResponse(
  base: Assignment,
  action: ActionResponse,
): Assignment {
  return {
    ...base,
    status: action.status
      ? normalizeAssignmentStatus(action.status)
      : base.status,
    postedQtyBase: action.postedQtyBase ?? base.postedQtyBase,
    remainingQtyBase: action.remainingQtyBase ?? base.remainingQtyBase,
    totalElapsedTimeSec: action.totalElapsedTimeSec ?? base.totalElapsedTimeSec,
    outputQtyToSubmitBase: action.outputQtyToSubmitBase ?? base.outputQtyToSubmitBase,
    outputIsFinal: action.outputIsFinal ?? base.outputIsFinal,
    outputReportedAt: action.outputReportedAt ?? base.outputReportedAt,
    outputReportedBy: action.outputReportedBy ?? base.outputReportedBy,
  };
}

export const businessCentralAdapter: ShopFloorService = {
  async login(operatorCode, password): Promise<ApiResult<LoginResult>> {
    const config = getBcConfig();
    if (config.mode === "demo")
      throw new Error("login() called with BC_MODE=demo on the real adapter.");

    const result = await callODataAction<{
      success: boolean;
      operatorCode?: string;
      displayName?: string;
      role?: string;
      mustChangePassword?: boolean;
      sessionToken?: string;
      message?: string;
    }>(config.authServiceName, "Login", { operatorCode, password });

    if (!result.ok) return result;
    if (!result.data.success || !result.data.sessionToken) {
      return {
        ok: false,
        error: {
          code: "UNAUTHORIZED",
          message: result.data.message ?? "Invalid operator code or password.",
        },
      };
    }

    const allowedRoles: LoginResult["role"][] = [
      "Operator",
      "Supervisor",
      "Admin",
    ];
    if (
      !result.data.operatorCode ||
      !result.data.displayName ||
      !result.data.role ||
      !allowedRoles.includes(result.data.role as LoginResult["role"])
    ) {
      return {
        ok: false,
        error: {
          code: "SERVER_ERROR",
          message:
            "Business Central authenticated the operator but returned incomplete shop-floor profile data.",
        },
      };
    }

    return {
      ok: true,
      data: {
        operatorCode: result.data.operatorCode,
        displayName: result.data.displayName,
        role: result.data.role as LoginResult["role"],
        mustChangePassword: Boolean(result.data.mustChangePassword),
        sessionToken: result.data.sessionToken,
      },
    };
  },

  async logout(sessionToken): Promise<ApiResult<void>> {
    const config = getBcConfig();
    if (config.mode === "demo")
      throw new Error("logout() called with BC_MODE=demo on the real adapter.");
    // Logout has no meaningful business response; treat any non-network failure
    // as "fine, the cookie is being cleared client-side regardless."
    await callODataAction(config.authServiceName, "Logout", {
      sessionToken,
    }).catch(() => undefined);
    return { ok: true, data: undefined };
  },

  async getMyAssignments(sessionToken): Promise<ApiResult<Assignment[]>> {
    // A plain API-page GET has no knowledge of the operator session, so first
    // verify the signed server-side cookie and require its opaque BC token to
    // match the caller. Operators see only their own assignments; supervisors
    // and admins can see the full assignment queue. Mutating actions still
    // re-resolve and authorize the operator inside AL.
    const session = await getOperatorSession();
    if (!session || session.sessionToken !== sessionToken) {
      return {
        ok: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Your session has expired. Please log in again.",
        },
      };
    }
    const operatorFilter =
      session.role === "Operator"
        ? `$filter=${encodeURIComponent(`assignedOperatorCode eq ${odataString(session.operatorCode)}`)}`
        : "";
    const result = await shopFloorApiRequest<
      BcApiPageResponse<BcAssignmentDto>
    >({
      path: `shopFloorAssignments${operatorFilter ? `?${operatorFilter}` : ""}`,
    });
    if (!result.ok) return result;
    return { ok: true, data: (result.data.value ?? []).map(toAssignment) };
  },

  async getAssignment(
    sessionToken,
    assignmentNo,
  ): Promise<ApiResult<Assignment>> {
    const session = await getOperatorSession();
    if (!session || session.sessionToken !== sessionToken) {
      return {
        ok: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Your session has expired. Please log in again.",
        },
      };
    }

    const filter = encodeURIComponent(`number eq ${odataString(assignmentNo)}`);
    const result = await shopFloorApiRequest<
      BcApiPageResponse<BcAssignmentDto>
    >({
      path: `shopFloorAssignments?$filter=${filter}&$top=1`,
    });
    if (!result.ok) return result;
    const found = result.data.value?.[0];
    if (!found)
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "That assignment could not be found.",
        },
      };
    if (
      session.role === "Operator" &&
      found.assignedOperatorCode !== session.operatorCode
    ) {
      return {
        ok: false,
        error: {
          code: "FORBIDDEN",
          message: "You are not assigned to this job.",
        },
      };
    }
    return { ok: true, data: toAssignment(found) };
  },

  async startWork(sessionToken, assignmentNo): Promise<ApiResult<Assignment>> {
    return runAction(sessionToken, assignmentNo, "StartWork", { assignmentNo });
  },

  async stopWork(
    sessionToken,
    assignmentNo,
    pause,
  ): Promise<ApiResult<Assignment>> {
    return runAction(sessionToken, assignmentNo, "StopWork", {
      assignmentNo,
      pause,
    });
  },

  async reportOutput(
    sessionToken,
    input: PostOutputInput,
  ): Promise<ApiResult<Assignment>> {
    return runAction(sessionToken, input.assignmentNo, "ReportOutput", {
      assignmentNo: input.assignmentNo,
      qtyToPostBase: input.qtyToPostBase,
      isFinal: input.isFinal,
      idempotencyKey: input.idempotencyKey,
    });
  },

  async getAssignmentComponents(
    sessionToken,
    assignmentNo,
  ): Promise<ApiResult<AssignmentComponent[]>> {
    const assignment = await this.getAssignment(sessionToken, assignmentNo);
    if (!assignment.ok) return assignment;
    const config = getBcConfig();
    const result = await callODataAction<{
      success: boolean;
      components?: AssignmentComponent[];
      message?: string;
    }>(config.actionsServiceName, "GetAssignmentComponents", {
      sessionToken,
      assignmentNo,
    });
    if (!result.ok) return result;
    if (!result.data.success) {
      return { ok: false, error: { code: "VALIDATION_ERROR", message: result.data.message ?? "Could not load assignment components." } };
    }
    return { ok: true, data: result.data.components ?? [] };
  },

  async saveConsumption(
    sessionToken,
    input: SaveConsumptionInput,
  ): Promise<ApiResult<AssignmentComponent>> {
    const assignment = await this.getAssignment(sessionToken, input.assignmentNo);
    if (!assignment.ok) return assignment;
    return runComponentAction(sessionToken, "SaveConsumption", input);
  },

  async requestReplacement(
    sessionToken,
    input: RequestReplacementInput,
  ): Promise<ApiResult<AssignmentComponent>> {
    const assignment = await this.getAssignment(sessionToken, input.assignmentNo);
    if (!assignment.ok) return assignment;
    return runComponentAction(sessionToken, "RequestReplacement", input);
  },

  async getAssignmentHistory(
    sessionToken,
    assignmentNo,
  ): Promise<ApiResult<AssignmentLine[]>> {
    const assignment = await this.getAssignment(sessionToken, assignmentNo);
    if (!assignment.ok) return assignment;

    const filter = encodeURIComponent(
      `assignmentNo eq ${odataString(assignmentNo)}`,
    );
    const result = await shopFloorApiRequest<BcApiPageResponse<AssignmentLine>>(
      {
        path: `shopFloorAssignmentLines?$filter=${filter}&$orderby=lineNo asc`,
      },
    );
    if (!result.ok) return result;
    return { ok: true, data: result.data.value ?? [] };
  },

  async getAssignmentTimeEntries(
    sessionToken,
    assignmentNo,
  ): Promise<ApiResult<AssignmentTimeEntry[]>> {
    const assignment = await this.getAssignment(sessionToken, assignmentNo);
    if (!assignment.ok) return assignment;

    const session = await getOperatorSession();
    if (!session || session.sessionToken !== sessionToken) {
      return {
        ok: false,
        error: { code: "UNAUTHORIZED", message: "Your session has expired. Please log in again." },
      };
    }

    const filters = [`assignmentNo eq ${odataString(assignmentNo)}`];
    if (session.role === "Operator") {
      filters.push(`operatorCode eq ${odataString(session.operatorCode)}`);
    }
    const result = await shopFloorApiRequest<BcApiPageResponse<AssignmentTimeEntry>>({
      path: `shopFloorTimeEntries?$filter=${encodeURIComponent(filters.join(" and "))}`,
    });
    if (!result.ok) return result;
    const entries = (result.data.value ?? []).sort((a, b) =>
      new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
    );
    return { ok: true, data: entries };
  },

  async cancelAssignment(
    sessionToken,
    assignmentNo,
    reason,
  ): Promise<ApiResult<Assignment>> {
    return runAction(sessionToken, assignmentNo, "CancelAssignment", {
      assignmentNo,
      reason,
    });
  },
};

async function runAction(
  sessionToken: string,
  assignmentNo: string,
  procedureName: "StartWork" | "StopWork" | "ReportOutput" | "CancelAssignment",
  extraParams: Record<string, unknown>,
): Promise<ApiResult<Assignment>> {
  const config = getBcConfig();
  if (config.mode === "demo")
    throw new Error(
      `${procedureName}() called with BC_MODE=demo on the real adapter.`,
    );

  const actionResult = await callODataAction<ActionResponse>(
    config.actionsServiceName,
    procedureName,
    {
      sessionToken,
      ...extraParams,
    },
  );
  if (!actionResult.ok) return actionResult;
  if (!actionResult.data.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message:
          actionResult.data.message ??
          "Business Central rejected this request.",
      },
    };
  }

  // The action response is a small delta, not the full record — fetch the
  // current assignment to return a complete, consistent object to the UI.
  const filter = encodeURIComponent(`number eq ${odataString(assignmentNo)}`);
  const fresh = await shopFloorApiRequest<BcApiPageResponse<BcAssignmentDto>>({
    path: `shopFloorAssignments?$filter=${filter}&$top=1`,
  });
  if (!fresh.ok) {
    // We know the action succeeded even though the follow-up read failed;
    // fall back to synthesizing from the action response alone rather than
    // reporting the whole operation as failed.
    return {
      ok: true,
      data: mergeActionResponse(
        {
          number: assignmentNo,
          assemblyOrderNo: "",
          itemNo: "",
          description: "",
          locationCode: "",
          assignedOperatorCode: "",
          assignedQtyBase: 0,
          postedQtyBase: 0,
          remainingQtyBase: 0,
          status: "Open",
          jobWorkReportNo: "",
          totalElapsedTimeSec: 0,
          lastModifiedAt: new Date().toISOString(),
          outputQtyToSubmitBase: 0,
          outputIsFinal: false,
          outputReportedAt: "",
          outputReportedBy: "",
        },
        actionResult.data,
      ),
    };
  }
  const found = fresh.data.value?.[0];
  if (!found)
    return {
      ok: false,
      error: {
        code: "NOT_FOUND",
        message: "That assignment could not be found after the update.",
      },
    };
  return { ok: true, data: toAssignment(found) };
}


async function runComponentAction(
  sessionToken: string,
  procedureName: "SaveConsumption" | "RequestReplacement",
  input: SaveConsumptionInput | RequestReplacementInput,
): Promise<ApiResult<AssignmentComponent>> {
  const config = getBcConfig();
  const actionResult = await callODataAction<{
    success: boolean;
    component?: AssignmentComponent;
    message?: string;
  }>(config.actionsServiceName, procedureName, { sessionToken, ...input });
  if (!actionResult.ok) return actionResult;
  if (!actionResult.data.success || !actionResult.data.component) {
    return {
      ok: false,
      error: { code: "VALIDATION_ERROR", message: actionResult.data.message ?? "Business Central rejected the component update." },
    };
  }
  return { ok: true, data: actionResult.data.component };
}
