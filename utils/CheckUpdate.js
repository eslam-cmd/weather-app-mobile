export const GITHUB_REPO_API =
  "https://api.github.com/repos/eslam-cmd/weather-app-mobile/releases/latest";

export const fetchLatestVersion = async () => {
  try {
    const response = await fetch(GITHUB_REPO_API);
    const data = await response.json();

    const latestVersion = data.tag_name; // مثال: "2.0.0"
    const downloadUrl = data.assets[0]?.browser_download_url;

    const [major] = latestVersion.split(".").map(Number);

    return {
      latestVersion,
      downloadUrl,
      forceUpdate: major > 1, // أي قفزة من 1.x إلى 2.x تصبح إجبارية
    };
  } catch (err) {
    console.log("Update check failed:", err);
    return null;
  }
};

export const isUpdateNeeded = (latest, current) => {
  const a = latest.split(".").map(Number);
  const b = current.split(".").map(Number);

  for (let i = 0; i < a.length; i++) {
    if (a[i] > b[i]) return true;
    if (a[i] < b[i]) return false;
  }
  return false;
};
