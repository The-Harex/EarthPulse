import { defineRailway, image, preserve, project, service, volume } from "railway/iac";

export default defineRailway(() => {
  const postgisVolume = volume("postgis-volume", { alerts: { usage: { "100": {}, "80": {}, "95": {} } }, allowOnlineResize: true, region: "us-west2", sizeMB: 50000 });
  const PostGIS = service("PostGIS", {
    source: image("postgis/postgis:16-3.4"),
    replicas: { "us-west2": 1 },
    networking: { privateNetworkEndpoint: "postgis" },
    volumeMounts: { "/var/lib/postgresql/data": postgisVolume },
    env: { DATABASE_URL: preserve(), PGDATA: preserve(), POSTGRES_DB: preserve(), POSTGRES_PASSWORD: preserve(), POSTGRES_USER: preserve() },
  });
  const EarthPulse = service("EarthPulse", {
    replicas: { "us-west2": 1 },
    networking: { privateNetworkEndpoint: "earthpulse" },
    env: { DATABASE_SSL: preserve(), DATABASE_URL: preserve(), PROVIDER_USER_AGENT: preserve(), WEB_ORIGIN: preserve() },
  });

  return project("EarthPulse", {
    resources: [PostGIS, EarthPulse, postgisVolume],
  });
});
