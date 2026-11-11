import "server-only";
import { getBcConfig } from "./config";
import type { ShopFloorService } from "./adapters/types";
import { demoAdapter } from "./adapters/demo";
import { businessCentralAdapter } from "./adapters/business-central";
import type { ApiError } from "./types";

function configurationFailure(error: unknown): ShopFloorService {
  const detail = error instanceof Error ? error.message : String(error);
  const result = <T>() => ({
    ok: false as const,
    error: {
      code: "CONFIG_ERROR" as const,
      message: "Business Central is not configured correctly. Check the server environment variables.",
      detail,
    } satisfies ApiError,
  });

  return {
    async login() { return result(); },
    async logout() { return result(); },
    async getMyAssignments() { return result(); },
    async getAssignment() { return result(); },
    async startWork() { return result(); },
    async stopWork() { return result(); },
    async reportOutput() { return result(); },
    async getAssignmentComponents() { return result(); },
    async saveConsumption() { return result(); },
    async requestReplacement() { return result(); },
    async getAssignmentHistory() { return result(); },
    async getAssignmentTimeEntries() { return result(); },
    async cancelAssignment() { return result(); },
  };
}

/**
 * The only adapter-selection point. A bad deployment configuration is returned
 * as a typed API error instead of escaping a Next.js route as an unhandled 500.
 */
export function getShopFloorService(): ShopFloorService {
  try {
    const config = getBcConfig();
    return config.mode === "demo" ? demoAdapter : businessCentralAdapter;
  } catch (error) {
    console.error(JSON.stringify({
      at: new Date().toISOString(),
      scope: "business-central-config",
      message: error instanceof Error ? error.message : String(error),
    }));
    return configurationFailure(error);
  }
}
