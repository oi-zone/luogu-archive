export function canExposePaste(
  currentIsPublic: boolean | null | undefined,
  requestedSnapshotIsPublic = true,
) {
  return currentIsPublic === true && requestedSnapshotIsPublic;
}
