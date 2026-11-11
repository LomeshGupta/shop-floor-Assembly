import type { ApiError } from "./types";

export function apiError(
  code: ApiError["code"],
  message: string,
  opts?: { detail?: string; httpStatus?: number }
): ApiError {
  return { code, message, detail: opts?.detail, httpStatus: opts?.httpStatus };
}

/** Maps a raw HTTP status returned by Business Central to an actionable error. */
export function apiErrorFromHttpStatus(status: number, detail?: string): ApiError {
  switch (status) {
    case 400:
      return apiError("VALIDATION_ERROR", "Business Central rejected the request. Check the submitted values and API parameters.", { detail, httpStatus: status });
    case 401:
      return apiError("UNAUTHORIZED", "Business Central authentication failed. Verify the Entra application, token scope, and tenant configuration.", { detail, httpStatus: status });
    case 403:
      return apiError("FORBIDDEN", "Business Central denied access. Check the Entra application permissions and the permission sets assigned in Business Central.", { detail, httpStatus: status });
    case 404:
      return apiError("NOT_FOUND", "Business Central could not find the requested endpoint or record. For OData codeunit actions, verify the exact Web Services Service Name and that Published is enabled in this environment.", { detail, httpStatus: status });
    case 409:
      return apiError("CONFLICT", "This record was updated elsewhere. Refresh the assignment and try again.", { detail, httpStatus: status });
    case 429:
      return apiError("RATE_LIMITED", "Business Central is busy right now. Please retry shortly.", { detail, httpStatus: status });
    default:
      if (status >= 500) {
        return apiError("SERVER_ERROR", "Business Central encountered an error while processing the request.", { detail, httpStatus: status });
      }
      return apiError("VALIDATION_ERROR", "Business Central rejected this request. Check the API parameters and service configuration.", { detail, httpStatus: status });
  }
}

export function networkError(detail?: string): ApiError {
  return apiError("NETWORK_ERROR", "Could not reach Business Central. Check the configured tenant, environment, and network connection.", { detail });
}

export function notImplementedError(featureName: string): ApiError {
  return apiError("NOT_IMPLEMENTED", "This feature isn't available yet in this environment.", {
    detail: `${featureName} requires a custom Business Central API / AL extension that has not been configured. See the deployment guide.`,
  });
}
