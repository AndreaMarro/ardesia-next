import {createHash} from 'node:crypto';
import initial from '../migrations/001_initial.sql?raw';
import recordings from '../migrations/002_recordings.sql?raw';
import learningFeedback from '../migrations/003_learning_feedback.sql?raw';
import extensions from '../migrations/004_extensions.sql?raw';
import courses from '../migrations/005_courses.sql?raw';
import tutor from '../migrations/006_tutor.sql?raw';
import materials from '../migrations/007_materials.sql?raw';
import tutorEconomics from '../migrations/008_tutor_economics.sql?raw';
import notebooks from '../migrations/009_notebooks.sql?raw';
import runtimeSchemaRead from '../migrations/010_runtime_schema_read.sql?raw';

// Operator execution and runtime readiness consume the same checked-in SQL bytes.
// Raw imports also retain that identity in the compiled, standalone Node function.
export const migrations = [initial, recordings, learningFeedback, extensions, courses,
  tutor, materials, tutorEconomics, notebooks, runtimeSchemaRead].map((sql, index) => ({
  version: index + 1, sql, digest: createHash('sha256').update(sql, 'utf8').digest('hex'),
}));
