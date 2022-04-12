
import { Step } from '../Step'

export interface Verb {
    run?: (step: Step) => void
}
