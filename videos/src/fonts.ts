import { loadFont as loadLora } from "@remotion/google-fonts/Lora";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

// Lora is the closest practical Google Font to the Iowan Old Style used by
// the mobile app. Brand wordmark uses Iowan locally; for video rendering we
// need a font that's reliably available on the headless render machine.
const lora = loadLora("normal", {
  weights: ["400", "500", "600"],
  subsets: ["latin"],
});

const inter = loadInter("normal", {
  weights: ["400", "500"],
  subsets: ["latin"],
});

export const serif = lora.fontFamily;
export const sans = inter.fontFamily;
