# PitSide

Home command deck for a **Pit Boss Sportsman 820 Wi-Fi** (`PB0820SPW`). 5° setpoint, Prime, P-set in Smoke, two probe jacks — nothing the PBC board does not have.

## Run it on a ZimaBlade

Keep the Blade and the grill on the same Wi-Fi. Phones on that network open the deck.

### ZimaOS / CasaOS

1. Copy this folder onto the Blade.
2. **Apps → + → Install a customized app** → import `docker-compose.yml`.
3. Start the app. Open it from your phone at `http://<blade-address>:8080`.

Or from a shell on the Blade:

```sh
git clone https://github.com/Bwest8/pitside.git
cd pitside
docker compose up -d --build
```

Then open `http://<blade-address>:8080`.

### What this does today

- Live 5° deck matched to the 820 (factory knob still jumps 50° after 250).
- Prime, Smoke P-set, Probe 1 / Probe 2, hopper.
- **Sync** matches the deck to what the controller LCD shows.

A phone browser still cannot talk to the grill by itself. The ZimaBlade *can*, because it sits on the LAN. Put the 820’s address in **Setup → Grill LAN address**. Direct SET from the container is the next step if you want it.

### Docker without CasaOS

```sh
docker compose up -d --build
```

The container listens on port 8080.
