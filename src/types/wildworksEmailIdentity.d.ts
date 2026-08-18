declare module "../lib/wildworksEmailIdentity.mjs" {
  export function parseWildWorksSenderAddress(value: unknown): string | null;
  export function wildWorksSenderConfigurationError(
    env?: NodeJS.ProcessEnv,
  ): string | null;
}
