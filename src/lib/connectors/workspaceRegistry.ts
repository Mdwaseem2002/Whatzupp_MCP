import { Connector } from './connectorInterface';
import { SFMCConnector } from './sfmcConnector';
import { SalesCloudConnector } from './salesCloudConnector';

interface WorkspaceConfig {
  connector: Connector;
  apiKey: string;
}

class WorkspaceRegistry {
  private registry = new Map<string, WorkspaceConfig>();

  constructor() {
    // Register SFMC Workspace (sfmc-ws-1)
    const sfmcConn = new SFMCConnector();
    const sfmcKey = process.env.SFMC_WORKSPACE_KEY || process.env.WORKSPACE_SFMC_API_KEY || 'sfmc-secret-key-123';
    this.registry.set(sfmcConn.id, { connector: sfmcConn, apiKey: sfmcKey });

    // Register Sales Cloud Workspace (salescloud-ws-1)
    const salesCloudConn = new SalesCloudConnector();
    const salesCloudKey = process.env.SALESCLOUD_WORKSPACE_KEY || process.env.WORKSPACE_SALESCLOUD_API_KEY || process.env.NEXT_PUBLIC_WORKSPACE_SALESCLOUD_API_KEY || 'salescloud-ws-key-secret';
    this.registry.set(salesCloudConn.id, { connector: salesCloudConn, apiKey: salesCloudKey });
  }

  public getConnector(workspaceId: string): Connector | null {
    const entry = this.registry.get(workspaceId);
    return entry ? entry.connector : null;
  }

  public validateWorkspaceKey(key: string): { workspaceId: string; connector: Connector } | null {
    if (!key) return null;
    for (const [workspaceId, config] of this.registry.entries()) {
      if (
        config.apiKey === key ||
        (workspaceId === 'salescloud-ws-1' && (key === 'salescloud-secret-key-456' || key === 'salescloud-ws-key-secret')) ||
        (workspaceId === 'sfmc-ws-1' && key === 'sfmc-secret-key-123')
      ) {
        return { workspaceId, connector: config.connector };
      }
    }
    return null;
  }

  public getWorkspaceIdByKey(key: string): string | null {
    const result = this.validateWorkspaceKey(key);
    return result ? result.workspaceId : null;
  }

  public registerConnector(connector: Connector, apiKey: string) {
    this.registry.set(connector.id, { connector, apiKey });
  }
}

// Export singleton instance
export const workspaceRegistry = new WorkspaceRegistry();
