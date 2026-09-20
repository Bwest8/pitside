# PitSide

Controller for the Pit Boss Sportsman 820 Wi-Fi (`PB0820SPW`).

5° setpoint, Prime, P-set in Smoke, two meat probes.

## Home server

Same network as the grill. Published on port **42069**.

```sh
git clone https://github.com/Bwest8/pitside.git
cd pitside
docker compose up -d --build
```

Open `http://<host>:42069`.

ZimaOS: Apps → Install a customized app → import `docker-compose.yml`.
