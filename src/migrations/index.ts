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
import * as migration_20260111_183034_added_container_states from './20260111_183034_added_container_states';
import * as migration_20260111_import_podyane_and_triaditsa_containers from './20260111_import_podyane_and_triaditsa_containers';
import * as migration_20260115_192810 from './20260115_192810';
import * as migration_20260115_194957_signal_container_state from './20260115_194957_signal_container_state';
import * as migration_20260117_101146_bins from './20260117_101146_bins';
import * as migration_20260128_import_izgrev_containers from './20260128_import_izgrev_containers';
import * as migration_20260128_import_slatina_containers from './20260128_import_slatina_containers';
import * as migration_20260202_190836_assignments from './20260202_190836_assignments';
import * as migration_20260209_174317_container_location from './20260209_174317_container_location';
import * as migration_20260209_181419_signals_point_location from './20260209_181419_signals_point_location';
import * as migration_20260209_223000_add_spatial_indexes from './20260209_223000_add_spatial_indexes';
import * as migration_20260302_134729_import_vitosha_ilinden_oborishte from './20260302_134729_import_vitosha_ilinden_oborishte';
import * as migration_20260308_135208_container_cleanup_job from './20260308_135208_container_cleanup_job';
import * as migration_20260308_135243_added_pending_container from './20260308_135243_added_pending_container';
import * as migration_20260311_070751_districs_and_zones from './20260311_070751_districs_and_zones';
import * as migration_20260312_201438_add_unique_observation from './20260312_201438_add_unique_observation';
import * as migration_20260313_000000_import_containers_10_districts from './20260313_000000_import_containers_10_districts';
import * as migration_20260408_000000_import_containers_poduyane from './20260408_000000_import_containers_poduyane';
import * as migration_20260329_122904 from './20260329_122904';
import * as migration_20260329_163904_geocode_address_cache from './20260329_163904_geocode_address_cache';
import * as migration_20260331_165728 from './20260331_165728';
import * as migration_20260401_162923 from './20260401_162923';
import * as migration_20260419_000000_fix_observation_fk_cascade from './20260419_000000_fix_observation_fk_cascade';

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
    up: migration_20260111_183034_added_container_states.up,
    down: migration_20260111_183034_added_container_states.down,
    name: '20260111_183034_added_container_states',
  },
  {
    up: migration_20260111_import_podyane_and_triaditsa_containers.up,
    down: migration_20260111_import_podyane_and_triaditsa_containers.down,
    name: '20260111_import_podyane_and_triaditsa_containers',
  },
  {
    up: migration_20260115_192810.up,
    down: migration_20260115_192810.down,
    name: '20260115_192810',
  },
  {
    up: migration_20260115_194957_signal_container_state.up,
    down: migration_20260115_194957_signal_container_state.down,
    name: '20260115_194957_signal_container_state',
  },
  {
    up: migration_20260117_101146_bins.up,
    down: migration_20260117_101146_bins.down,
    name: '20260117_101146_bins',
  },
  {
    up: migration_20260128_import_izgrev_containers.up,
    down: migration_20260128_import_izgrev_containers.down,
    name: '20260128_import_izgrev_containers',
  },
  {
    up: migration_20260128_import_slatina_containers.up,
    down: migration_20260128_import_slatina_containers.down,
    name: '20260128_import_slatina_containers',
  },
  {
    up: migration_20260202_190836_assignments.up,
    down: migration_20260202_190836_assignments.down,
    name: '20260202_190836_assignments',
  },
  {
    up: migration_20260209_174317_container_location.up,
    down: migration_20260209_174317_container_location.down,
    name: '20260209_174317_container_location',
  },
  {
    up: migration_20260209_181419_signals_point_location.up,
    down: migration_20260209_181419_signals_point_location.down,
    name: '20260209_181419_signals_point_location',
  },
  {
    up: migration_20260209_223000_add_spatial_indexes.up,
    down: migration_20260209_223000_add_spatial_indexes.down,
    name: '20260209_223000_add_spatial_indexes',
  },
  {
    up: migration_20260302_134729_import_vitosha_ilinden_oborishte.up,
    down: migration_20260302_134729_import_vitosha_ilinden_oborishte.down,
    name: '20260302_134729_import_vitosha_ilinden_oborishte',
  },
  {
    up: migration_20260308_135208_container_cleanup_job.up,
    down: migration_20260308_135208_container_cleanup_job.down,
    name: '20260308_135208_container_cleanup_job',
  },
  {
    up: migration_20260308_135243_added_pending_container.up,
    down: migration_20260308_135243_added_pending_container.down,
    name: '20260308_135243_added_pending_container',
  },
  {
    up: migration_20260311_070751_districs_and_zones.up,
    down: migration_20260311_070751_districs_and_zones.down,
    name: '20260311_070751_districs_and_zones',
  },
  {
    up: migration_20260312_201438_add_unique_observation.up,
    down: migration_20260312_201438_add_unique_observation.down,
    name: '20260312_201438_add_unique_observation',
  },
  {
    up: migration_20260313_000000_import_containers_10_districts.up,
    down: migration_20260313_000000_import_containers_10_districts.down,
    name: '20260313_000000_import_containers_10_districts',
  },
  {
    up: migration_20260329_122904.up,
    down: migration_20260329_122904.down,
    name: '20260329_122904',
  },
  {
    up: migration_20260329_163904_geocode_address_cache.up,
    down: migration_20260329_163904_geocode_address_cache.down,
    name: '20260329_163904_geocode_address_cache',
  },
  {
    up: migration_20260331_165728.up,
    down: migration_20260331_165728.down,
    name: '20260331_165728',
  },
  {
    up: migration_20260401_162923.up,
    down: migration_20260401_162923.down,
    name: '20260401_162923',
  },
  {
    up: migration_20260419_000000_fix_observation_fk_cascade.up,
    down: migration_20260419_000000_fix_observation_fk_cascade.down,
    name: '20260419_000000_fix_observation_fk_cascade',
  },
  {
    up: migration_20260408_000000_import_containers_poduyane.up,
    down: migration_20260408_000000_import_containers_poduyane.down,
    name: '20260408_000000_import_containers_poduyane',
  },
];
