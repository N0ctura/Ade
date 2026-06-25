import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";

// Register a system font so text renders correctly
GlobalFonts.registerFromPath(
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
  "BadgeFont"
);

/**
 * Fetches a remote image and overlays a numbered badge in the top-left corner.
 * Returns a PNG Buffer ready to be sent as a Discord attachment.
 */
export async function addNumberBadge(imageUrl: string, number: number): Promise<Buffer> {
  const img = await loadImage(imageUrl);

  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext("2d");

  // Draw the original image
  ctx.drawImage(img, 0, 0);

  // Badge sizing relative to image
  const badgeRadius = Math.round(Math.min(img.width, img.height) * 0.1);
  const margin = Math.round(badgeRadius * 0.5);
  const cx = margin + badgeRadius;
  const cy = margin + badgeRadius;
  const fontSize = Math.round(badgeRadius * 1.1);

  // Drop shadow
  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowBlur = 10;

  // Circle background
  ctx.beginPath();
  ctx.arc(cx, cy, badgeRadius, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(15, 15, 15, 0.85)";
  ctx.fill();

  ctx.shadowBlur = 0;

  // White border
  ctx.lineWidth = Math.round(badgeRadius * 0.12);
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.stroke();

  // Number
  ctx.font = `bold ${fontSize}px BadgeFont`;
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(number), cx, cy);

  return canvas.toBuffer("image/png");
}
