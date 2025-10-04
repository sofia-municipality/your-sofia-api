import * as migration_20251004_195801 from './20251004_195801';

export const migrations = [
  {
    up: migration_20251004_195801.up,
    down: migration_20251004_195801.down,
    name: '20251004_195801'
  },
];
