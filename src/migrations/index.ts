import * as migration_20251004_195801 from './20251004_195801';
import * as migration_20251008_201710 from './20251008_201710';
import * as migration_20251009_191551 from './20251009_191551';
import * as migration_20251025_import_containers from './20251025_import_containers';
import * as migration_20251025_import_votes from './20251025_import_votes';
import * as migration_20251027_212945 from './20251027_212945';
import * as migration_20251028_212230_enabled_import_export_plugin from './20251028_212230_enabled_import_export_plugin';
import * as migration_20251028_213708_import_containers_again from './20251028_213708_import_containers_again';
import * as migration_20251028_213810_import_signals_again from './20251028_213810_import_signals_again';
import * as migration_20251122_091224 from './20251122_091224';
import * as migration_20251122_140508_upload_photo_observation from './20251122_140508_upload_photo_observation';
import * as migration_20260104_174157 from './20260104_174157';
import * as migration_20260107_191231_reporterid from './20260107_191231_reporterid';
import * as migration_20260111_174909_container_states from './20260111_174909_container_states';
import * as migration_20260111_import_podyane_and_triaditsa_containers from './20260111_import_podyane_and_triaditsa_containers';

export const migrations = [
  {
    up: migration_20251004_195801.up,
    down: migration_20251004_195801.down,
    name: '20251004_195801',
  },
  {
    up: migration_20251008_201710.up,
    down: migration_20251008_201710.down,
    name: '20251008_201710',
  },
  {
    up: migration_20251009_191551.up,
    down: migration_20251009_191551.down,
    name: '20251009_191551',
  },
  {
    up: migration_20251025_import_containers.up,
    down: migration_20251025_import_containers.down,
    name: '20251025_import_containers',
  },
  {
    up: migration_20251025_import_votes.up,
    down: migration_20251025_import_votes.down,
    name: '20251025_import_votes',
  },
  {
    up: migration_20251027_212945.up,
    down: migration_20251027_212945.down,
    name: '20251027_212945',
  },
  {
    up: migration_20251028_212230_enabled_import_export_plugin.up,
    down: migration_20251028_212230_enabled_import_export_plugin.down,
    name: '20251028_212230_enabled_import_export_plugin',
  },
  {
    up: migration_20251028_213708_import_containers_again.up,
    down: migration_20251028_213708_import_containers_again.down,
    name: '20251028_213708_import_containers_again',
  },
  {
    up: migration_20251028_213810_import_signals_again.up,
    down: migration_20251028_213810_import_signals_again.down,
    name: '20251028_213810_import_signals_again',
  },
  {
    up: migration_20251122_091224.up,
    down: migration_20251122_091224.down,
    name: '20251122_091224',
  },
  {
    up: migration_20251122_140508_upload_photo_observation.up,
    down: migration_20251122_140508_upload_photo_observation.down,
    name: '20251122_140508_upload_photo_observation',
  },
  {
    up: migration_20260104_174157.up,
    down: migration_20260104_174157.down,
    name: '20260104_174157',
  },
  {
    up: migration_20260107_191231_reporterid.up,
    down: migration_20260107_191231_reporterid.down,
    name: '20260107_191231_reporterid',
  },
  {
    up: migration_20260111_174909_container_states.up,
    down: migration_20260111_174909_container_states.down,
    name: '20260111_174909_container_states',
  },
  {
    up: migration_20260111_import_podyane_and_triaditsa_containers.up,
    down: migration_20260111_import_podyane_and_triaditsa_containers.down,
    name: '20260111_import_podyane_and_triaditsa_containers'
  },
];
