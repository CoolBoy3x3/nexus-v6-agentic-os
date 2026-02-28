export async function buildIndex(): Promise<void> {
  console.log('\nRebuilding .nexus/03-index/ ...');
  console.log('This command rebuilds: files.json, symbols.json, ownership.json, test_map.json, migration_map.json');
  console.log('\nFull symbol extraction requires @nexus/graph (Phase 3).');
  console.log('Use /nexus:map-codebase in your AI runtime for AI-powered analysis.\n');
}
