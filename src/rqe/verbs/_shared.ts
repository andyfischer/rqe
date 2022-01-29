
import { PrepareParams } from '../Planning'
import { Step } from '../Step'

export interface Verb {
    prepare?: (params: PrepareParams) => void
    run?: (step: Step) => void
}
