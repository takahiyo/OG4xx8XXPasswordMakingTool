const isDev = location.hostname.startsWith("dev.");

const AppConfig = {
  API_ENDPOINT: isDev
    ? "https://og4xx8xxpasswordmakingtool-dev.taka-hiyo.workers.dev/"
    : "https://og4xx8xxpasswordmakingtool.taka-hiyo.workers.dev/",

  UI: {
    MAX_WIDTH: "400px",
    COLORS: {
      PRIMARY: "#007bff",
      PRIMARY_ACTIVE: "#0056b3",
      BG: "#f8f9fa",
      ERROR: "#e74c3c"
    }
  }
};
