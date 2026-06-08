/**
 * Placeholder for official Ejar platform API integration.
 * v1 uses manual entry / CSV import in EjarIntegration.
 */

export type EjarApiContractPayload = {
  ejarNumber: string;
  tenantIdNo?: string;
  tenantName?: string;
  startDate?: string;
  endDate?: string;
  rentAmount?: number;
  unitName?: string;
};

export async function fetchEjarContract(_ejarNumber: string): Promise<EjarApiContractPayload | null> {
  return null;
}

export async function pushEjarContract(_payload: EjarApiContractPayload): Promise<{ ok: boolean; message: string }> {
  return { ok: false, message: 'Ejar API not configured — use manual registration in the Ejar portal.' };
}
