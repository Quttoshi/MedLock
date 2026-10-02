// Downloaded imaging studies are always a .zip rebuilt from storage.
export const imagingDownloadName = (filename) => `${(filename || "study").replace(/\.[^.]+$/, "")}.zip`;
