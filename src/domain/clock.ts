export interface Clock {
  now(): Date
}

export const systemClock: Clock = {
  now: () => new Date(),
}

/** For tests and for any code that must not read the wall clock. */
export const fixedClock = (iso: string): Clock => ({
  now: () => new Date(iso),
})
