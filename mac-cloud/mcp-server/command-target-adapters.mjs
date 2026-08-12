const denied = (message, code = 'TARGET_DENIED') => Object.assign(new Error(message), { code });

export class CommandTargetAdapter {
  constructor({ name, remote = false, enabled = true } = {}) {
    if (!name) throw new Error('Command target adapter name is required');
    this.name = name;
    this.remote = remote;
    this.enabled = enabled;
  }

  validate() {
    throw new Error('Command target adapter validation is not implemented');
  }

  async execute() {
    throw new Error('Command target adapter execution is not implemented');
  }
}

export class MacCommandTargetAdapter extends CommandTargetAdapter {
  constructor({ tenantId } = {}) {
    super({ name: 'mac' });
    this.tenantId = tenantId;
  }

  validate({ target }) {
    if (!this.tenantId) throw denied('Mac command tenant is not configured', 'MAC_TENANT_NOT_CONFIGURED');
    if (target.adapter !== 'mac' || target.tenantId !== this.tenantId || target.projectId) {
      throw denied('Mac command target does not match the configured tenant');
    }
    return { adapter: this, target: { ...target } };
  }

  async execute({ transaction, action, input, command }) {
    if (!transaction) throw new Error('Mac command transaction is required');
    return action.execute(transaction, input, command);
  }
}

export class DisabledPostgresTenantCommandAdapter extends CommandTargetAdapter {
  constructor() {
    super({ name: 'postgres-tenant', remote: true, enabled: false });
  }

  validate() {
    throw denied('PostgreSQL tenant command adapter is disabled', 'ADAPTER_DISABLED');
  }

  async execute() {
    throw denied('PostgreSQL tenant command adapter is disabled', 'ADAPTER_DISABLED');
  }
}

/*
 * Future PostgreSQL tenant adapters must:
 * - resolve a stable server-side tenant ID and verify book/schema/capabilities;
 * - use a transaction-scoped `SET LOCAL app.tenant_id = $1` before any query;
 * - connect with a role covered by RLS and without BYPASSRLS/superuser rights;
 * - fail closed when RLS, version, or capability checks cannot be proven.
 * This scaffold is intentionally not registered by the router.
 */

export function createCommandTargetRouter({ macAdapter, buyerAdapter } = {}) {
  const adapters = new Map([
    ['mac', macAdapter],
    ['buyer', buyerAdapter],
  ]);
  return {
    resolve({ target, actionId }) {
      const adapter = adapters.get(target?.adapter);
      if (!adapter || adapter.enabled === false) throw denied('Command target adapter is unavailable', 'ADAPTER_DISABLED');
      return adapter.validate({ target, actionId });
    },
  };
}
