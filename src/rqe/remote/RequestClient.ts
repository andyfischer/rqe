
import type { Stream } from '../Stream'

export interface RequestClient<RequestType> {
    sendRequest(request: RequestType, output: Stream): void
}
