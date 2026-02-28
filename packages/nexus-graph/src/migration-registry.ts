import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { NEXUS_DIRS } from '@nexus/core';

export interface MigrationEntry {
  id: string;
  timestamp: string;
  description: string;
  type: 'schema' | 'data' | 'config';
  status: 'pending' | 'applied' | 'rolled-back' | 'failed';
  sqlFile?: string;
  rollbackFile?: string;
  appliedAt?: string;
  appliedBy?: string;
  checksum?: string;
}

export class MigrationRegistry {
  constructor(private readonly cwd: string = process.cwd()) {}

  private registryPath(): string {
    return path.join(this.cwd, NEXUS_DIRS.ARCHITECTURE, 'migration_map.json');
  }

  async load(): Promise<MigrationEntry[]> {
    const p = this.registryPath();
    if (!existsSync(p)) return [];
    const raw = await readFile(p, 'utf-8');
    return JSON.parse(raw) as MigrationEntry[];
  }

  async save(migrations: MigrationEntry[]): Promise<void> {
    await mkdir(path.dirname(this.registryPath()), { recursive: true });
    await writeFile(this.registryPath(), JSON.stringify(migrations, null, 2), 'utf-8');
  }

  async register(entry: Omit<MigrationEntry, 'timestamp'>): Promise<void> {
    const migrations = await this.load();
    const existing = migrations.findIndex((m) => m.id === entry.id);
    const migration = { ...entry, timestamp: new Date().toISOString() };

    if (existing >= 0) {
      migrations[existing] = migration;
    } else {
      migrations.push(migration);
    }
    await this.save(migrations);
  }

  async markApplied(id: string, appliedBy: string): Promise<void> {
    const migrations = await this.load();
    const m = migrations.find((m) => m.id === id);
    if (!m) throw new Error(`Migration ${id} not found`);
    m.status = 'applied';
    m.appliedAt = new Date().toISOString();
    m.appliedBy = appliedBy;
    await this.save(migrations);
  }

  async getPending(): Promise<MigrationEntry[]> {
    const migrations = await this.load();
    return migrations.filter((m) => m.status === 'pending');
  }

  async getApplied(): Promise<MigrationEntry[]> {
    const migrations = await this.load();
    return migrations.filter((m) => m.status === 'applied');
  }

  // Check if a migration was already applied (prevents double-apply)
  async wasApplied(id: string): Promise<boolean> {
    const migrations = await this.load();
    const m = migrations.find((m) => m.id === id);
    return m?.status === 'applied';
  }
}
