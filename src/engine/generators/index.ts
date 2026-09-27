import type { CategoryId, Generator } from '../types'
import { sequenceGenerator } from './sequence'
import { matrixGenerator } from './matrix'
import { spatialGenerator } from './spatial'
import { logicGenerator } from './logic'
import { verbalGenerator } from './verbal'
import { quantGenerator } from './quant'

export const GENERATORS: Record<CategoryId, Generator> = {
  sequence: sequenceGenerator,
  matrix: matrixGenerator,
  spatial: spatialGenerator,
  logic: logicGenerator,
  verbal: verbalGenerator,
  quant: quantGenerator,
}
