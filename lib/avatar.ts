import { supabase } from "./supabase";

/** Shrinks the photo to 256x256 (small + fast), uploads it, and returns its public link. */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file.");

  const bitmap = await createImageBitmap(file);
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  // Crop to a centered square.
  const side = Math.min(bitmap.width, bitmap.height);
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);

  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not read image."))), "image/jpeg", 0.85),
  );

  const path = `${userId}/${Date.now()}.jpg`;
  const { error } = await supabase.storage.from("avatars").upload(path, blob, { contentType: "image/jpeg" });
  if (error) throw error;
  return supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
}
