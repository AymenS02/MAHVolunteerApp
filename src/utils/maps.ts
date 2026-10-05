import { Linking, Platform } from "react-native";

// Opens a free-text address in the phone's maps app: Apple Maps on iOS, the
// default maps app (usually Google Maps) on Android. Falls back to Google
// Maps on the web if that fails.
export const openInMaps = async (location: string) => {
  const query = encodeURIComponent(location);
  const native = Platform.select({
    ios: `https://maps.apple.com/?q=${query}`,
    android: `geo:0,0?q=${query}`,
  });
  const web = `https://www.google.com/maps/search/?api=1&query=${query}`;

  try {
    await Linking.openURL(native ?? web);
  } catch {
    await Linking.openURL(web);
  }
};
