export function candidateOrigin(item) {
  if (item.importedVia === "agent") return "Agent";
  if (item.searchDiscovery?.provider === "brave") return "Brave";
  if (item.importedVia === "official_discovery") return "Official Discovery";
  if (item.importedVia === "manual") return "Manual";
  return "مصدر سابق غير محدد";
}
