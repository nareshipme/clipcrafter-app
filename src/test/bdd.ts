// BDD helpers — wrap vitest describe/it with Given/When/Then semantics

export const Feature = (name: string, fn: () => void) => describe(`Feature: ${name}`, fn);
export const Scenario = (name: string, fn: () => void) => describe(`Scenario: ${name}`, fn);
export const Given = (desc: string, fn: () => void | Promise<void>) => it(`Given ${desc}`, fn);
export const When = (desc: string, fn: () => void | Promise<void>) => it(`When ${desc}`, fn);
export const Then = (desc: string, fn: () => void | Promise<void>) => it(`Then ${desc}`, fn);
export const And = (desc: string, fn: () => void | Promise<void>) => it(`And ${desc}`, fn);
