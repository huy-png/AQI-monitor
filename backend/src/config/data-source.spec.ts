import { isModuleSource } from "./data-source";
describe("backend module data source", () => {
  it.each(["module", "firebase"])("enables module ingestion for %s", source => {
    expect(isModuleSource(source)).toBe(true);
  });
  it.each(["mongodb", "mock", undefined])("keeps other sources out of module mode: %s", source => {
    expect(isModuleSource(source)).toBe(false);
  });
});
