import { uuidv7 } from 'uuidv7'

/**
 * UUIDv7: time-sortable and generated client-side, because an offline device
 * cannot ask a server for an identifier.
 */
export const newEventId = (): string => uuidv7()
