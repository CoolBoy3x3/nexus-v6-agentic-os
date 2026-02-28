import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { NEXUS_FILES } from '@nexus/core';

export interface APIContract {
  id: string;
  version: string;
  endpoint: string;
  method: string;
  requestSchema: Record<string, unknown>;
  responseSchema: Record<string, unknown>;
  owner: string;
  consumers: string[];
  registeredAt: string;
  updatedAt: string;
}

export interface ContractDiff {
  contractId: string;
  changeType: 'added' | 'removed' | 'modified';
  field?: string;
  oldValue?: unknown;
  newValue?: unknown;
  breaking: boolean;
  reason: string;
}

export class ContractRegistry {
  constructor(private readonly cwd: string = process.cwd()) {}

  private contractsPath(): string {
    return path.join(this.cwd, NEXUS_FILES.API_CONTRACTS);
  }

  async load(): Promise<Record<string, APIContract>> {
    const p = this.contractsPath();
    if (!existsSync(p)) return {};
    const raw = await readFile(p, 'utf-8');
    return JSON.parse(raw) as Record<string, APIContract>;
  }

  async save(contracts: Record<string, APIContract>): Promise<void> {
    await mkdir(path.dirname(this.contractsPath()), { recursive: true });
    await writeFile(this.contractsPath(), JSON.stringify(contracts, null, 2), 'utf-8');
  }

  async register(contract: Omit<APIContract, 'registeredAt' | 'updatedAt'>): Promise<void> {
    const contracts = await this.load();
    const now = new Date().toISOString();
    contracts[contract.id] = {
      ...contract,
      registeredAt: contracts[contract.id]?.registeredAt ?? now,
      updatedAt: now,
    };
    await this.save(contracts);
  }

  async diff(oldContracts: Record<string, APIContract>, newContracts: Record<string, APIContract>): Promise<ContractDiff[]> {
    const diffs: ContractDiff[] = [];
    const allIds = new Set([...Object.keys(oldContracts), ...Object.keys(newContracts)]);

    for (const id of allIds) {
      const oldC = oldContracts[id];
      const newC = newContracts[id];

      if (!oldC && newC) {
        diffs.push({ contractId: id, changeType: 'added', breaking: false, reason: 'New contract added' });
        continue;
      }
      if (oldC && !newC) {
        diffs.push({ contractId: id, changeType: 'removed', breaking: true, reason: 'Contract removed — breaks existing consumers' });
        continue;
      }
      if (!oldC || !newC) continue; // both undefined — shouldn't happen but satisfies TypeScript

      // Both oldC and newC exist — check for modifications
      // Check method change
      if (oldC.method !== newC.method) {
        diffs.push({ contractId: id, changeType: 'modified', field: 'method', oldValue: oldC.method, newValue: newC.method, breaking: true, reason: 'HTTP method changed' });
      }

      // Check endpoint change
      if (oldC.endpoint !== newC.endpoint) {
        diffs.push({ contractId: id, changeType: 'modified', field: 'endpoint', oldValue: oldC.endpoint, newValue: newC.endpoint, breaking: true, reason: 'Endpoint URL changed' });
      }

      // Check version change
      if (oldC.version !== newC.version) {
        diffs.push({ contractId: id, changeType: 'modified', field: 'version', oldValue: oldC.version, newValue: newC.version, breaking: false, reason: 'Version bumped' });
      }
    }

    return diffs;
  }

  detectBreakingChanges(diffs: ContractDiff[]): ContractDiff[] {
    return diffs.filter((d) => d.breaking);
  }
}
