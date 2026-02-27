import { getDb } from '../../db'
import { registerSqliteHandlers } from '../../handlers/sqlite'
import { registerVectorsHandlers } from '../../handlers/vectors'
import { registerDataHandlers } from '../../handlers/data'
import { registerGenresHandlers } from './genres'
import { registerProjectsHandlers } from './projects'
import { registerSeriesHandlers } from './series'
import { registerCharactersHandlers } from './characters'
import { registerPropsHandlers } from './props'
import { registerScenesHandlers } from './scenes'
import { registerShotsHandlers } from './shots'

export function registerDatabaseHandlers() {
  getDb()
  registerSqliteHandlers()
  registerGenresHandlers()
  registerProjectsHandlers()
  registerSeriesHandlers()
  registerCharactersHandlers()
  registerPropsHandlers()
  registerScenesHandlers()
  registerShotsHandlers()
  registerVectorsHandlers()
  registerDataHandlers()
}
