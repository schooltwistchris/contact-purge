import { useColorScheme } from "react-native";

import colors from "@/constants/colors";

type Palette = typeof colors.light;

// Returns the active palette tokens plus scheme-independent values like
// `radius`. Falls back to light when no `dark` key is present.
export function useColors() {
  const scheme = useColorScheme();
  const hasDark = "dark" in colors;
  const palette: Palette =
    scheme === "dark" && hasDark
      ? ((colors as unknown as { dark: Palette }).dark)
      : colors.light;
  return { ...palette, radius: colors.radius };
}
