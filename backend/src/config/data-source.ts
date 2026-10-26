// "firebase" remains a supported alias for older deployments.
export function isModuleSource(source: string | undefined): boolean {
  return source === "module" || source === "firebase";
}
