import { useSyncExternalStore } from "react";
import { subscribeUploads, getUploadSnapshot, getServerUploadSnapshot, type UploadTask } from "@/lib/upload-manager";

/** Subscribe to the global background upload queue. */
export function useUploads(): UploadTask[] {
  return useSyncExternalStore(subscribeUploads, getUploadSnapshot, getServerUploadSnapshot);
}
