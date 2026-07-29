/**
 * Trigger a browser "Save as" for a Blob we already have in memory (e.g. an evidence file
 * fetched from the backend). Creates a temporary object URL, clicks a hidden link, then
 * revokes the URL so it does not leak.
 */
export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename || "attachment";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
