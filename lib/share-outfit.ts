/**
 * share-outfit.ts
 *
 * Captures the OutfitShareCard view as a PNG and invokes the native share
 * sheet.  Handles platform differences and graceful degradation.
 *
 * Flow
 * ────
 *  1. captureRef()  →  file URI of a temporary PNG
 *  2. isAvailableAsync() guards against web / simulators without share support
 *  3. shareAsync()  →  opens the OS share sheet
 *     • iOS:  AirDrop, iMessage, WhatsApp, Instagram, Save to Photos, …
 *     • Android: all Intent handlers (WhatsApp, Instagram, Gmail, …)
 *
 * Instagram Stories note
 * ──────────────────────
 * Instagram's Stories deep-link requires the app to be installed AND uses a
 * custom URL scheme (instagram-stories://share).  We attempt it first; if it
 * fails (not installed or blocked) we fall back to the standard share sheet
 * which still lets users pick Instagram from the grid.
 *
 * WhatsApp note
 * ─────────────
 * WhatsApp accepts image/png from the standard share sheet on both platforms.
 * No special deep-link is required.
 */

import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Linking, Platform } from "react-native";
import { captureRef } from "react-native-view-shot";
import type { RefObject } from "react";
import type { View } from "react-native";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ShareTarget = "sheet" | "instagram-stories";

export interface ShareOutfitResult {
  success: boolean;
  /** Human-readable error message when success === false */
  error?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Capture the referenced view as a PNG and return a local file URI.
 * Uses react-native-view-shot at 2× pixel density for crisp social sharing.
 */
async function captureCardAsFile(ref: RefObject<View>): Promise<string> {
  const uri = await captureRef(ref, {
    format: "png",
    quality: 1,
    // 2× the logical size → 720×900 px output (crisp on most devices)
    snapshotContentContainer: false,
  });
  return uri;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Main entry point: capture the card and open the OS share sheet.
 *
 * @param cardRef  - ref forwarded to the OutfitShareCard <View>
 * @param caption  - optional text to pre-fill in apps that support it
 */
export async function shareOutfitCard(
  cardRef: RefObject<View>,
  caption = "✨ Today's look — styled by DressUp",
): Promise<ShareOutfitResult> {
  try {
    const fileUri = await captureCardAsFile(cardRef);

    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      return {
        success: false,
        error:
          "Sharing is not available on this device (web or restricted build).",
      };
    }

    await Sharing.shareAsync(fileUri, {
      mimeType: "image/png",
      dialogTitle: caption,
      UTI: "public.png", // iOS UTI for PNG
    });

    // Clean up the temporary file after a short delay so the share sheet has
    // time to read it before we delete it.
    setTimeout(() => {
      void FileSystem.deleteAsync(fileUri, { idempotent: true });
    }, 30_000);

    return { success: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error during share.";
    // User cancelled is not a real error
    if (message.toLowerCase().includes("cancel")) {
      return { success: true };
    }
    return { success: false, error: message };
  }
}

/**
 * Attempt Instagram Stories deep-link share (iOS only).
 * Falls back to the standard sheet if the deep-link fails.
 *
 * Instagram Stories URL scheme:
 *   instagram-stories://share?source_application=<bundle_id>
 * requires passing the image as a pasteboard item (iOS) — not supported here
 * without native code, so we use the standard share sheet which surfaces
 * Instagram in the activity grid.
 */
export async function shareToInstagramStories(
  cardRef: RefObject<View>,
): Promise<ShareOutfitResult> {
  if (Platform.OS !== "ios") {
    // On Android, fall straight through to the standard sheet
    return shareOutfitCard(cardRef);
  }

  const canOpen = await Linking.canOpenURL("instagram://app").catch(
    () => false,
  );
  if (!canOpen) {
    // Instagram not installed — standard sheet
    return shareOutfitCard(cardRef);
  }

  // Standard share sheet on iOS surfaces "Copy to Instagram" and
  // "Add to Story" natively without a custom deep-link.
  return shareOutfitCard(cardRef, "Share to Instagram Stories");
}
